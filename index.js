#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import { Backend } from './lib/backend.js'
import { execute } from './lib/commands.js'
import * as format from './lib/format.js'

const args = process.argv.slice(2)

// Available options (with defaults)
const options = {
  config: './config.json',
  fancy: false,
}

// Parse leading `--option(=value)` flags into `options` object
let optionMatch
while (args[0] && (optionMatch = args[0].match(/--(\w+)(?:=(.*))/))) {
  const option = optionMatch[1]
  /** @type {string | boolean} */
  let value = optionMatch[2]
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

function log(...args) {
  console.log(format.log(...args))
}

const configPath = path.resolve(options.config)
import(configPath, { with: { type: 'json' } }).then((configModule) => {
  const config = configModule.default
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object')
  }

  const backend = new Backend(Object.assign({ log }, config))

  // CLI mode
  if (args[0] !== 'bot') {
    format.setFancy(options.fancy)

    function output(res) {
      return console.log(format.fancy(res))
    }

    const context = { backend, log, output }

    execute
      .call(context, args)
      .then((res) => {
        output(res)
      })
      .catch((err) => {
        log('Error:', err.stack || err)
        if (err.inputData) log('Input data was:', err.inputData)
        process.exit(1)
      })
    return
  }

  // Bot server mode
  import('./lib/bot.js').then(({ startBot }) =>
    startBot({
      token: config.discordToken,
      defaultChannel: config.discordDefaultChannel,
      execute,
      backend,
      log,
    }),
  )
})
