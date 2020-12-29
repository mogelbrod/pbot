#!/usr/bin/env node
const path = require('path')
const { Backend } = require('./lib/backend')
const commands = require('./lib/commands')
const format = require('./lib/format')

const args = process.argv.slice(2)

// Available options (with defaults)
const options = {
  config: './config.json',
  fancy: false,
}

// Parse leading `--option(=value)` flags into `options` object
let optionMatch
while (args[0] && (optionMatch = args[0].match(/--(\w+)(?:=(.*))/))) {
  let option = optionMatch[1]
  let value = optionMatch[2]
  switch (typeof options[option]) {
    case 'undefined':
      throw new Error(`Unknown option '${option}'`)
    case 'boolean':
      value = (value === 'true' || value === '1')
      break
  }
  options[option] = value
  args.shift()
}

const config = require(path.resolve(options.config))
const backend = new Backend(Object.assign({ log }, config))

function log(...args) {
  console.log(format.log(...args))
}

// CLI mode
if (require.main === module && args[0] !== 'bot') {
  format.setFancy(options.fancy)

  function output(res) {
    return console.log(format.fancy(res))
  }

  const context = { backend, log, output }

  commands.execute.call(context, args).then(res => {
    output(res)
  }).catch(err => {
    log('Error:', (err.stack || err))
    if (err.inputData) log('Input data was:', err.inputData)
    process.exit(1)
  })
  return
}

// Bot server mode
const bot = require('./lib/bot')({
  token: config.slackToken,
  defaultChannel: 'C4WM49V1A',
  execute: commands.execute,
  backend,
  log,
})
