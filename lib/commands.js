const format = require("./format")

exports.available = {}

/**
 * Parse and execute the given input.
 *
 * @param {Array[]|string} input - Raw input string or tokens array.
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

    if (isInt(input[0])) {
      input.unshift("drink")
    }

    let commandName = input.shift()
    if (typeof commandName !== "string" || !commandName.length) {
      commandName = "help"
    } else {
      commandName = commandName.toLowerCase()
    }

    const command = exports[commandName]

    if (!exports.available[commandName] || typeof command !== "function") {
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
 * @param {String} description - Command description, displayed when running `help`.
 * @param {Function} fn - ES5 function to invoke when running command.
 * @return {Object} Self to enable chaining.
 */
function command(name, description, fn) {
  exports[name] = fn
  exports.available[name] = description
  return exports
}

command("session", "Displays the given/current session", function(index = "-1") {
  return this.backend.session(index)
})
command("member", "Displays user with the given name/email", function(query = "") {
  if (!query) {
    if (!this.user) {
      return Promise.reject("`query` argument is required since user is missing from context")
    }
    query = this.user
  }
  return this.backend.member(query)
})
command("reload", "Reloads all tables", function(...tables) {
  return this.backend.tables(false, ...tables)
    .then(() => `Reloaded tables ${tables.join(", ")}`)
})
for (let table of ["Members", "Sessions"]) {
  command(table.toLowerCase(), "Displays table rows", function() {
    return this.backend.table(table, null, false)
  })
}

command("start", "Begins a new session", function(location = "Unknown") {
  return this.backend.create("Sessions", {
    Start: new Date().toISOString(),
    Location: location,
  }).then(res => [["Started new session", res]])
})

command("drink", "Registers a drink for a member", function(member, volume = "40", type = "Beer") {
  if (isInt(member) && this.user) {
    if (!isInt(volume)) type = volume
    volume = member
    member = ""
  }

  if (!isInt(volume) || volume <= 0 || volume > 1000) {
    return Promise.reject(new Error(`Invalid volume \`${volume}\``))
  }

  return Promise.all([
    this.backend.session(),
    exports.member.call(this, member)
  ]).then(res => {
    return this.backend.create("Drinks", {
      Time: new Date().toISOString(),
      Sessions: [res[0]._id],
      Members: [res[1]._id],
      Volume: parseInt(volume, 10),
      Type: format.capitalize(type),
    }).then(drink => [[ "Registered", drink, "to", res[1] ]])
  })
})

command("sum", "Alias of list", function(what = "-1") {
  return exports.list.apply(this, arguments)
})

command("list", "Lists drinks for a session/user", function(what = "-1") {
  const forSession = isInt(what)
  const groupingTable = forSession ? "Members" : "Sessions"
  return Promise.all([
    this.backend[forSession ? "session" : "member"](what),
    this.backend.table(groupingTable),
  ]).then(res => {
    const parent = res[0]
    const groupingItems = res[1]
    const parentId = forSession ? this.backend.time(parent.Start) : parent.Email
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
          (index+1) + ".",
          row.Entity,
          row.Value + "cl =",
          row
        ])

      ranked.unshift(parent)
      return ranked
    })
  })
})

command("signup", "Registers a new member", function(email = "", name = "", role = "Prospect") {
  const memberPromise = this.user
    ? this.backend.member(this.user).catch(err => {
      if (/No member matching query/.test(err.message)) {
        return null
      }
      throw err
    })
    : Promise.resolve()

  return memberPromise.then(member => {
    let slackId = null

    if (this.user && member && !name) {
      throw new Error(`${member.Name} already signed up`)
    }

    if (role !== "Prospect" && !this.backend.isAdmin(member)) {
      throw new Error("Only admins are allowed to add other members")
    }

    // Use slack user data to fill out any missing inputs
    if (this.user && !member) {
      name = name || this.user.real_name || this.user.name
      email = email || this.user.profile.email
      slackId = this.user.name
    }

    // Validate inputs
    if (! /^[A-Z0-9_+-]+(\.[A-Z0-9_+-]+)*@[A-Z0-9][A-Z0-9_-]*(\.[A-Z0-9_-]+)*\.[A-Z]{2,10}$/i.test(email)) {
      throw new Error("Invalid email address provided")
    }
    if (!name || name.length < 2) {
      throw new Error("Provide a name for the new member")
    }

    return this.backend.member(email).then(existing => {
      if (existing) {
        throw new Error(`${member.Name} already signed up`)
      }
    }).catch(err => this.backend.create("Members", {
      Email: email,
      Name: name,
      Role: role,
      SlackID: slackId,
      Joined: this.backend.date(new Date),
    }))
  }).then(res => [[ "Added member", res ]])
})

command("quote", "Add or display a random quote",
  textMemberCommand("Quotes", "Quote", "Author"))

command("feedback", "Register or display feedback",
  textMemberCommand("Feedback", "Feedback", "Author"))

command("help", "Lists available commands", function() {
  return [
    "*Usage:* `pbot COMMAND [ARGS...]`",
    "Available commands:",
  ].concat(Object.keys(exports.available)
    .sort((a, b) => a.localeCompare(b))
    .map(command => {
      return `•  \`${command}(${exports.args(command)})\` - ${exports.available[command]}`
    })
  )
})

command("raw", "Executes the given input without formatting its output", function(...input) {
  return exports.execute.call(this, input).then(raw => ({
    _type: "RawResult",
    raw,
  }))
})

function textMemberCommand(table, textColumn = "Text", memberColumn = "Member") {
  // Populates member
  function formatResult(res) {
    const promise = res[memberColumn] && res[memberColumn].length ?
      this.backend.member(res[memberColumn][0]) : Promise.resolve(null)
    return promise.then(member => {
      res[memberColumn] = member
      return res
    })
  }

  return function(text = "", member = "") {
    if (!text || isInt(text)) {
      return this.backend.table(table).then(rows => {
        const slice = isInt(text) ? rows.slice(- text) :
          [rows[Math.floor(Math.random() * rows.length)]]
        return Promise.all(slice.map(formatResult.bind(this)))
      })
    }

    return this.backend.member(member || this.user)
      .catch(err => {
        if (/Invalid member query/.test(err.message)) {
          return null
        }
        throw err
      }).then(member => {
        const data = {}
        data[textColumn] = text
        data[memberColumn] = member && [member._id]
        return this.backend.create(table, data)
      }).then(formatResult.bind(this))
  }
}

function isInt(value) {
  return parseInt(value, 10) == value // eslint-disable-line eqeqeq
}
