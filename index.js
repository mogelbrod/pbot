#!/usr/bin/env node
// const slackbots = require("slackbots")
const backend = require("./lib/backend")
const config = require("./config")
const b = new backend.Backend(config)

const commands = exports.commands = []

const DRINK_TYPES = {
  Beer: {
    emoji: "🍺",
    multiplier: 1.0,
  },
  Wine: {
    emoji: "🍷",
    multiplier: 2.0,
  },
  Unknown: {
    emoji: "🍼",
    multiplier: 1.0,
  },
}

function toDrinkType(drink) {
  if (typeof drink === "object") {
    drink = drink.Type
  }
  return DRINK_TYPES[drink] || DRINK_TYPES.Unknown
}

function format(d) {
  const prefix = (typeof d === "object" && d._id) ? d._id + " = " : ""
  return prefix + JSON.stringify(d, null, 2)
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

function member(query) {
  query = query.toLowerCase()
  const fields = ['Name', 'Email']
  return b.table("Members").then(members => {
    const matched = members.filter(m => fields.some(f => m[f].toLowerCase().indexOf(query) >= 0))
    switch (matched.length) {
      case 0: throw new Error(`No member matching query '${query}'`)
      case 1: return matched[0]
    }
    const which = matched.map(m => m.Email).join(', ')
    throw new Error(`Multiple members matching '${query}': ${which}`)
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
  Session: [session()._id],
  Member: [member(memberEmail)._id],
  Volume: parseInt(volume, 10),
  Type: type,
}))

command("sum", (what = "-1") => {
  const isSession = what == parseInt(what, 10)
  return Promise.all([
    isSession ? session(what) : member(what),
    b.table('Members'),
  ]).then(res => {
    const parent = res[0]
    const members = res[1]
    return b.table("Drinks", {
      filterByFormula: `${parent._type} = '${b.normalizeDate(parent.Start)}'`,
    }).then(drinks => {
      // TODO
      const partitions = drinks.reduce((memo, drink) => {
        const key = drink[isSession ? 'Members' : 'Sessions'][0]
        if (!memo[key]) {
          memo[key] = []
          memo[key].Value = 0
          memo[key].Key = key
          memo[key].Entity = members.find(member => member._id === key)
        }
        memo[key].push(drink)
        memo[key].Value += drink.Volume * toDrinkType(drink).multiplier
        return memo
      }, {})

      return Object.keys(partitions)
        .map(key => partitions[key])
        .sort((a, b) => b.Value - a.Value)
        .map(row => [
          row.Entity.Name,
          row.Value,
          row.map(drink => {
            const type = toDrinkType(drink)
            return drink.Volume + type.emoji
          }).join('  ')
        ])
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
