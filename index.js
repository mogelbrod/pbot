#!/usr/bin/env node
// const promisify = require('js-promisify')
const slackbots = require('slackbots')
const Airtable = require('airtable')
const config = require('./config')
const air = new Airtable({apiKey: config.airtable}).base('appJdrJKPgnOISywb')

const state = exports.state = {
  Sessions: [],
  Members: [],
  Drinks: [],
}

const REQUIRED_TABLES = ['Sessions', 'Members']
const LIST_ARGS = {
  Sessions: {sort: [{field: 'Start', direction: 'asc'}]}
}

function list(table, args = LIST_ARGS[table]) {
  return new Promise((resolve, reject) => {
    air(table).select(args).eachPage((items, next) => {
      state[table] = items
      console.log(`* Got ${items.length} rows from ${table}`)
      resolve(items)
    })
  })
}

function create(table, data) {
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

function currentSession() {
  return state.Sessions[state.Sessions.length - 1]
}

function findMember(email) {
  return state.Members.find(m => m.get('Email') === email)
}

exports.init = () => Promise.all(REQUIRED_TABLES.map(t => list(t)))
exports.currentSession = currentSession
exports.findMember = findMember

exports.list = list

exports.start = (location = "Unknown") => create('Sessions', {
  Start: new Date().toISOString(),
  Location: location,
})

exports.drink = (memberEmail, volume = "40", type = "Beer") => create('Drinks', {
  Time: new Date().toISOString(),
  Session: [currentSession().getId()],
  Member: [findMember(memberEmail).getId()],
  Volume: parseInt(volume, 10),
  Type: type,
})

exports.execute = function(args) {
  const commandName = args.shift()
  const command = exports[commandName]
  if (typeof command !== "function" || ['state', 'init', 'execute'].indexOf(command) >= 0) {
    console.error(`* Error: Unknown command '${commandName}'`)
    process.exit(1)
  }
  if (command.length > args.length) {
    console.error(`* Error: Insufficient number of arguments for '${commandName}' (${command.length} required)`)
    process.exit(1)
  }

  console.info(`* Running command '${commandName}' with args '${args.join(' ')}'`)

  return exports.init()
    .then(() => command.apply(null, args))
    .then(result => {
      if (!Array.isArray(result)) result = [result]
      console.log(result.map(r => JSON.stringify(r.fields, null, 2)).join("\n\n"))
    })
    .catch(err => {
      console.error("* Error:\n" + err)
      if (err.inputData) console.error("* Input data was:\n" + JSON.stringify(err.inputData, null, 2))
    })
}

if (require.main === module) {
  exports.execute(process.argv.slice(2))
}
