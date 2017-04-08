#!/usr/bin/env node
// const slackbots = require("slackbots")
const backend = require("./lib/backend")
const config = require("./config")
const b = new backend.Backend(config)

const commands = exports.commands = []

function format(d) {
  const t = typeof d
  if (t === "object" && d.fields) {
    const prefix = typeof d.getId === "function" ? d.getId() + " = " : ""
    return prefix + JSON.stringify(d.fields, null, 2)
  } else if (d != null) {
    return d.toString()
  }
}

function command(name, fn) {
  exports[name] = fn
  commands.push(name)
  return fn
}

function session(index = "-1") {
  index = parseInt(index, 10)
  return b.table("Sessions").then(sessions => {
    if (index < 0) index += sessions.length
    const s = sessions[index]
    if (!s) {
      throw new Error(`No sessions found`)
    }
    return s
  })
}

function member(email) {
  return b.table("Members").then(members => {
    const m = members.find(m => m.get("Email") === email)
    if (!m) {
      throw new Error(`No member with email '${email}'`)
    }
    return m
  })
}

command("session", session)
command("member", member)
command("list", (table) => b.table(table, null, false))
command("reload", (...tables) => b.tables(...tables))
for (let table of backend.TABLES) {
  command(table.toLowerCase(), () => b.table(table))
}

command("start", (location = "Unknown") => b.create('Sessions', {
  Start: new Date().toISOString(),
  Location: location,
}))

command("drink", (memberEmail, volume = "40", type = "Beer") => b.create('Drinks', {
  Time: new Date().toISOString(),
  Session: [session().getId()],
  Member: [member(memberEmail).getId()],
  Volume: parseInt(volume, 10),
  Type: type,
}))

command("sum", (what = "-1") => {
  const isSession = what.indexOf('@') < 0
  return Promise.all([
    isSession ? session(what) : member(what),
    b.table('Members'),
  ]).then(res => {
    const parent = res[0]
    const members = res[1]
    return b.table("Drinks", {
      filterByFormula: `${b.type(parent)} = '${b.normalizeDate(parent.get('Start'))}'`,
    }).then(drinks => {
      // TODO
      const partitions = drinks.reduce((memo, drink) => {
        const key = drink.fields[isSession ? 'Members' : 'Sessions'][0]
        if (!memo[key]) {
          memo[key] = []
          memo[key].Value = 0
          memo[key].Key = key
          memo[key].Entity = members.find(member => member.getId() === key)
          console.log(memo[key])
        }
        memo[key].push(drink)
        memo[key].Value += drink.fields.Volume
        return memo
      }, {})

      const ranked = Object.keys(partitions)
        .map(key => partitions[key])
        .sort((a, b) => b.Value - a.Value)

      return ranked
    })
  })
})

command("help", () => {
  const cmds = commands
    .sort((a, b) => a.localeCompare(b))
    .map(cmd => {
      // Ugly and not at all guaranteed to work, but still fun :)
      const args = exports[cmd].toString()
        .replace(/^function[^(]*/, "")
        .replace(/(\s*=>\s*|{)[\s\S]+/, "")
        .replace(/^\s*\(|\)\s*$/g, "")
        .split(/\s*,\*/)
        .join(", ")
      return `  ${cmd}(${args})`
    }).join("\n")
  return `* Usage: pbot COMMAND [ARGS...]\n* Available commands:\n${cmds}`
})

exports.execute = function(args) {
  const commandName = args.shift() || "help"

  // if (parseInt(commandName, 10) == commandName) {
    // args.unshift(commandName)
    // commandName = "drink"
  // }

  const command = exports[commandName]

  if (commands.indexOf(commandName) < 0 || typeof command !== "function") {
    console.error(`* Error: Unknown command '${commandName}'`)
    process.exit(1)
  }
  if (command.length > args.length) {
    console.error(`* Error: Insufficient number of arguments for '${commandName}' (${command.length} required)`)
    process.exit(1)
  }

  return Promise.resolve()
    .then(() => command.apply(null, args))
    .then(result => {
      if (!Array.isArray(result)) result = [result]
      console.log(result.map(format).join("\n\n"))
    })
    .catch(err => {
      console.error("* Error:\n" + err.stack)
      if (err.inputData) console.error("* Input data was:\n" + JSON.stringify(err.inputData, null, 2))
    })
}

if (require.main === module) {
  exports.execute(process.argv.slice(2))
}
