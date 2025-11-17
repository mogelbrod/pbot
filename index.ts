#!/usr/bin/env -S npx tsx
import path from 'path'
import { airtableBackend } from './lib/backends/airtable.js'
import { baserowBackend } from './lib/backends/baserow.js'
import { execute, type CommandContext } from './lib/commands.js'
import * as format from './lib/format.js'
import type { Config } from './lib/types.js'
import { createGoogleAuth } from './lib/google/auth.js'

const args = process.argv.slice(2)

/** Available options (with defaults) */
const options = {
  config: './config.json',
  fancy: false,
}

// Parse leading `--option(=value)` flags into `options` object
let optionMatch: RegExpMatchArray | null
while (args[0] && (optionMatch = args[0].match(/--(\w+)(?:=(.*))/))) {
  const option = optionMatch[1] as keyof typeof options
  let value: string | boolean | undefined = optionMatch[2]
  switch (typeof options[option]) {
    case 'boolean':
      value = value === 'true' || value === '1'
      break
    case 'string':
      ;(options as any)[option] = value
      break
    default:
      throw new Error(`Unknown option '${option}'`)
  }
  args.shift()
}

function log(...args: any[]) {
  console.log(format.log(...args))
}

const configPath = path.resolve(options.config)

void import(configPath, { with: { type: 'json' } }).then(
  (configModule: { default: Config }) => {
    if (!configModule.default || typeof configModule.default !== 'object') {
      throw new Error('Config must be an object')
    }
    const config = Object.assign(
      {
        log,
        googleAuthToken: (): Promise<string> => {
          return Promise.reject(
            new Error(
              'Google auth not configured (`config.google.serviceAccount` missing)',
            ),
          )
        },
      },
      configModule.default,
    ) satisfies Config

    const requiredFields = [
      'discord.token',
      'discord.defaultChannel',
      'backend',
      (config.backend || 'baserow') + '.token',
    ]
    const missingFields = requiredFields.filter((field) => {
      const parts = field.split('.')
      let obj: any = config
      for (const part of parts) {
        if (obj && typeof obj === 'object' && part in obj) {
          obj = obj[part]
        } else {
          return true
        }
      }
      return false
    })
    if (missingFields.length) {
      throw new Error(
        `Missing required config.json value(s):\n\t${missingFields.join('\n\t')}`,
      )
    }

    const backends = {
      baserow: baserowBackend,
      airtable: airtableBackend,
    } as const

    const backendFactory = backends[config.backend!]
    if (!backendFactory) {
      throw new Error(
        `Unsupported backend: ${config.backend}, expected one of: ${Object.keys(backends).join(', ')}`,
      )
    }

    log(`Initializing ${config.backend} backend`)
    const backend = backendFactory(config)
    const context: CommandContext = {
      backend,
      config,
      log,
      output(res) {
        return console.log(format.fancy(res))
      },
    }

    // Configure Google auth if service account is provided
    const googleSA = config.google?.serviceAccount
    if (googleSA) {
      log(`Initializing Google auth using service account`)
      delete config.google!.serviceAccount
      const { clientPromise, getToken } = createGoogleAuth(googleSA)
      config.googleAuthToken = getToken
      clientPromise
        .then(() => log(`Initialized Google auth`))
        .catch((error) => log(`Google auth error:`, error))
    }

    // CLI mode
    if (args[0] !== 'bot') {
      format.setFancy(options.fancy)

      execute
        .call(context, args)
        .then((res) => context.output(res))
        .catch((err) => {
          log('Error:', err.stack || err)
          if (err.inputData) log('Input data was:', err.inputData)
          process.exit(1)
        })
      return
    }

    // Bot server mode
    return import('./lib/bot.js').then(({ startBot }) =>
      startBot({
        token: config.discord!.token,
        defaultChannel: config.discord!.defaultChannel,
        context,
        execute,
      }),
    )
  },
)
