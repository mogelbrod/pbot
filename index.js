#!/usr/bin/env node
const {Backend} = require("./lib/backend")
const Commands = require("./lib/commands")
const format = require("./lib/format")
const config = require("./config")

const args = process.argv.slice(2)
const backend = new Backend(config)
const commands = new Commands(backend)

// CLI mode
if (require.main === module && args[0] !== "run") {
  commands.execute(args).then(res => {
    if (!Array.isArray(res)) res = [res]
    console.log(res.map(d => {
      const t = typeof d
      const prefix = (t === "object" && d._id) ? d._id + " = " : ""
      return prefix + (t === "string" ? d : JSON.stringify(d, null, 2))
    }).join("\n\n"))
    process.exit(0)
  }).catch(err => {
    console.error("* Error:\n" + err.stack)
    if (err.inputData) console.error("* Input data was:\n" + JSON.stringify(err.inputData, null, 2))
    process.exit(1)
  })
  return
}

// Bot server mode
const bot = require("./lib/bot")({
  token: config.slackToken,
  defaultChannel: "test",
  backend,
  commands,
  log: (...args) => console.log(format.log(...args))
})
