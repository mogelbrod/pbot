const format = require("./format")

exports.available = []

/**
 * Parse and execute the given input.
 *
 * @param {Array[string]|string} input - Raw input string or tokens array.
 * @return {Promise} Execution result
 */
exports.execute = function execute(input) {
  if (typeof this !== "object" || this === global || !this.backend) {
    throw new Error("Must provide a valid execution context as `this`")
  }

  return Promise.resolve().then(() => {
    if (typeof input === "string") {
      input = format.tokenize(input)
    }

    const commandName = input.shift() || "help"

    // if (parseInt(commandName, 10) == commandName) {
    // input.unshift(commandName)
    // commandName = "drink"
    // }

    const command = exports[commandName]

    if (exports.available.indexOf(commandName) < 0 || typeof command !== "function") {
      throw new Error(`Unknown command \`${commandName}\``)
    }
    if (command.length > input.length) {
      throw new Error(`Insufficient number of arguments for \`${commandName}(${exports.args(commandName)})\``)
    }

    return command.apply(this, input)
  })
}

exports.args = function args(command) {
  // Ugly and not at all guaranteed to work, but still fun :)
  return exports[command].toString()
    .replace(/^function[^(]*/, "")
    .replace(/(\s*=>\s*|{)[\s\S]+/, "")
    .replace(/^\s*\(|\)\s*$/g, "")
    .split(/\s*,\*/)
    .join(", ")
}

/**
 * Registers a command.
 * Command functions must be declared using ES5 syntax since context is bound
 * to `this` during execution.
 *
 * @param {String} name - Command name used to call it.
 * @param {Function} fn - ES5 function to invoke when running command.
 * @return {Object} Self to enable chaining.
 */
function command(name, fn) {
  exports[name] = fn
  exports.available.push(name)
  return exports
}

command("session", function(index = "-1") { return this.backend.session(index) })
command("member", function(query) { return this.backend.member(query) })
command("list", function(table) { return this.backend.table(table, null, false) })
command("reload", function(...tables) {
  return this.backend.tables(false, ...tables)
    .then(() => `Reloaded tables ${tables.join(', ')}`)
})
for (let table of ["Members", "Sessions"]) {
  command(table.toLowerCase(), function() { return this.backend.table(table, null, false) })
}

command("start", function(location = "Unknown") {
  return this.backend.create('Sessions', {
    Start: new Date().toISOString(),
    Location: location,
  })
})

command("drink", function(member, volume = "40", type = "Beer") {
  if (isInt(member) && this.user) {
    if (!isInt(volume)) type = volume
    volume = member
    member = this.user.profile.email
  }

  if (!isInt(volume) || volume < 0 || volume > 1000) {
    return Promise.reject(new Error(`Invalid volume \`${volume}\``))
  }

  return Promise.all([
    this.backend.session(),
    this.backend.member(member)
  ]).then(res => {
    return this.backend.create("Drinks", {
      Time: new Date().toISOString(),
      Sessions: [res[0]._id],
      Members: [res[1]._id],
      Volume: parseInt(volume, 10),
      Type: type[0].toUpperCase() + type.substr(1),
    })
  })
})

command("sum", function(what = "-1") {
  const forSession = isInt(what)
  const groupingTable = forSession ? "Members" : "Sessions"
  return Promise.all([
    this.backend[forSession ? "session" : "member"](what),
    this.backend.table(groupingTable),
  ]).then(res => {
    const parent = res[0]
    const groupingItems = res[1]
    const parentId = forSession ? format.time(parent.Start) : parent.Email
    return this.backend.table("Drinks", {
      filterByFormula: `${parent._type} = '${parentId}'`,
    }).then(drinks => {
      const partitions = drinks.reduce((memo, drink) => {
        const key = drink[groupingTable][0]
        if (!memo[key]) {
          memo[key] = []
          memo[key].Value = 0
          memo[key].Key = key
          memo[key].Entity = groupingItems.find(it => it._id === key)
        }
        memo[key].push(drink)
        memo[key].Value += drink.Volume * format.drinkType(drink).multiplier
        return memo
      }, {})

      const ranked = Object.keys(partitions)
        .map(key => partitions[key])
        .sort((a, b) => b.Value - a.Value)
        .map((row, index) => [
          (index+1) + '.',
          row.Entity,
          row.Value + "cl =",
          row.map(drink => {
            const type = format.drinkType(drink)
            return drink.Volume + type.emoji
          }).join('  ')
        ])

      ranked.unshift(parent)
      return ranked
    })
  })
})

command("help", function() {
  return [
    "*Usage:* `pbot COMMAND [ARGS...]`",
    "Available commands:",
  ].concat(exports.available
    .sort((a, b) => a.localeCompare(b))
    .map(command => {
      return `•  \`${command}(${exports.args(command)})\``
    })
  )
})

function isInt(value) {
  return parseInt(value, 10) == value
}
