#!/usr/bin/env -S npx tsx
import path from 'path'
import { airtableBackend } from './lib/backends/airtable.js'
import { execute, type CommandContext } from './lib/commands.js'
import * as format from './lib/format.js'

const args = process.argv.slice(2)

/** Available options (with defaults) */
const options = {
  config: './config.json',
  fancy: false,
}

// Parse leading `--option(=value)` flags into `options` object
let optionMatch: RegExpMatchArray | null
while (args[0] && (optionMatch = args[0].match(/--(\w+)(?:=(.*))/))) {
  const option = optionMatch[1]
  let value: string | boolean | undefined = optionMatch[2]
  switch (typeof options[option]) {
    case 'undefined':
      throw new Error(`Unknown option '${option}'`)
    case 'boolean':
      value = value === 'true' || value === '1'
      break
  }
  options[option] = value
  args.shift()
}

function log(...args: any[]) {
  console.log(format.log(...args))
}

const configPath = path.resolve(options.config)

void import(configPath, { with: { type: 'json' } }).then(
  (configModule: any) => {
    if (!configModule.default || typeof configModule.default !== 'object') {
      throw new Error('Config must be an object')
    }
    const config = Object.assign({ log }, configModule.default)
    const backend = airtableBackend(config)
    const context: CommandContext = {
      backend,
      config,
      log,
      output(res) {
        return console.log(format.fancy(res))
      },
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
        token: config.discordToken,
        defaultChannel: config.discordDefaultChannel,
        context,
        execute,
      }),
    )
  },
)
