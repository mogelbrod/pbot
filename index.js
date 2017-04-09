#!/usr/bin/env node
// const slackbots = require("slackbots")
const {Backend} = require("./lib/backend")
const Commands = require("./lib/commands")
const config = require("./config")

if (require.main === module) {
  new Commands(new Backend(config)).execute(process.argv.slice(2))
    .then(res => {
      if (!Array.isArray(res)) res = [res]
      console.log(res.map(d => {
        const prefix = (typeof d === "object" && d._id) ? d._id + " = " : ""
        return prefix + JSON.stringify(d, null, 2)
      }).join("\n\n"))
    }).catch(err => {
      console.error("* Error:\n" + err.stack)
      if (err.inputData) console.error("* Input data was:\n" + JSON.stringify(err.inputData, null, 2))
    })
}
