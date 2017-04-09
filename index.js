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
  commands.execute.call({backend, log}, args).then(res => {
    if (!Array.isArray(res)) res = [res]
    console.log(res.map(d => {
      const t = typeof d
      const prefix = (t === "object" && d._id) ? d._id + " = " : ""
      return prefix + (t === "string" ? d : JSON.stringify(d, null, 2))
    }).join("\n\n"))
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
