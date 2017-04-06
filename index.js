#!/usr/bin/env node
// const promisify = require('js-promisify')
const slackbots = require('slackbots')
const Airtable = require('airtable')
const config = require('./config')
const air = new Airtable({apiKey: config.key}).base(config.base)

const TABLES = ['Members', 'Sessions', 'Drinks']
const REQUIRED_TABLES = ['Sessions', 'Members']
const LIST_ARGS = {
  Sessions: {sort: [{field: 'Start'}]},
  Members: {sort: [{field: 'Name'}]},
  Drinks: {sort: [{field: 'Time'}]},
}

const state = exports.state = TABLES.reduce((s, table) => (s[table] = [], s), {})
const commands = exports.commands = []

function tableName(table) {
  return table.replace(/^(.)(.+?)s?$/, (_, c, rest) => c.toUpperCase() + rest + 's')
}

function format(d) {
  if (typeof d === "object" && d.fields) {
    return JSON.stringify(d.fields, null, 2)
  }
  return d.toString()
}

function command(name, dependencies, fn) {
  if (!fn) {
    fn = dependencies
    dependencies = REQUIRED_TABLES
  }
  fn.dependencies = dependencies
  exports[name] = fn
  exports.commands.push(name)
  return fn
}

function list(table, args = null) {
  table = tableName(table)
  args = LIST_ARGS[table]
  return new Promise((resolve, reject) => {
    air(table).select(args).eachPage((items, next) => {
      state[table] = items
      console.log(`* Got ${items.length} rows from ${table}`)
      resolve(items)
    }, err => (err ? reject(err) : null))
  })
}

function reload(...tables) {
  return Promise.all(tables.map(t => list(t)))
}

function create(table, data) {
  table = tableName(table)
  return new Promise((resolve, reject) => {
    air(table).create(data, (err, res) => {
      if (err) {
        err.inputData = data
        return reject(err)
      }
      state[table].push(res)
      resolve(res)
    })
  })
}

function session(index = "-1") {
  index = parseInt(index, 10)
  if (index < 0) index += state.Sessions.length
  const s = state.Sessions[index]
  if (!s) {
    throw new Error(`No sessions found`)
  }
  return s
}

function member(email) {
  const m = state.Members.find(m => m.get('Email') === email)
  if (!m) {
    throw new Error(`No member with email '${email}'`)
  }
  return m
}

command('session', ['Sessions'], session)
command('member', ['Members'], member)
command('list', [], list)
command('reload', [], reload)
for (let table of TABLES) {
  command(table.toLowerCase(), [], () => list(table))
}

command('start', (location = "Unknown") => create('Sessions', {
  Start: new Date().toISOString(),
  Location: location,
}))

command('drink', (memberEmail, volume = "40", type = "Beer") => create('Drinks', {
  Time: new Date().toISOString(),
  Session: [session().getId()],
  Member: [member(memberEmail).getId()],
  Volume: parseInt(volume, 10),
  Type: type,
}))

command('help', [], () => {
  return `* Available commands:\n` + exports.commands
    .sort((a, b) => a.localeCompare(b))
    .map(cmd => {
      // Ugly and not at all guaranteed to work, but still fun :)
      const args = exports[cmd].toString()
        .replace(/^function[^(]*/, '')
        .replace(/(\s*=>\s*|{)[\s\S]+/, '')
        .replace(/^\s*\(|\)\s*$/g, '')
        .split(/\s*,\*/)
        .join(', ')
      return `  ${cmd}(${args})`
    }).join("\n")
})

exports.execute = function(args) {
  const commandName = args.shift()

  // if (parseInt(commandName, 10) == commandName) {
    // args.unshift(commandName)
    // commandName = "drink"
  // }

  if (!commandName) {
    console.error(`* Usage: pbot COMMAND [ARGS...]}`)
    console.error(`* Available commands:`)
    process.exit(1)
  }

  const command = exports[commandName]

  if (exports.commands.indexOf(commandName) < 0 || typeof command !== "function") {
    console.error(`* Error: Unknown command '${commandName}'`)
    process.exit(1)
  }
  if (command.length > args.length) {
    console.error(`* Error: Insufficient number of arguments for '${commandName}' (${command.length} required)`)
    process.exit(1)
  }

  return (reload(...command.dependencies))
    .then(() => command.apply(null, args))
    .then(result => {
      if (!Array.isArray(result)) result = [result]
      console.log(result.map(format).join("\n\n"))
    })
    .catch(err => {
      console.error("* Error:\n" + err)
      if (err.inputData) console.error("* Input data was:\n" + JSON.stringify(err.inputData, null, 2))
    })
}

if (require.main === module) {
  exports.execute(process.argv.slice(2))
}
