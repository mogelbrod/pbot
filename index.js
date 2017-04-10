#!/usr/bin/env node
const {Backend} = require("./lib/backend")
const commands = require("./lib/commands")
const format = require("./lib/format")
const config = require("./config")

const args = process.argv.slice(2)
const log = (...args) => console.log(format.log(...args))

const backend = new Backend(Object.assign({log}, config))

// CLI mode
if (require.main === module && args[0] !== "run") {
  format.basicOutput = ["1", "true"].indexOf(process.env.FANCY) < 0
  commands.execute.call({backend, log}, args).then(res => {
    console.log(format.fancy(res))
    process.exit(0)
  }).catch(err => {
    log("Error:", (err.stack || err))
    if (err.inputData) log("Input data was:", err.inputData)
    process.exit(1)
  })
  return
}

// Bot server mode
const bot = require("./lib/bot")({
  token: config.slackToken,
  defaultChannel: "C4WM49V1A",
  execute: commands.execute,
  backend,
  log,
})
