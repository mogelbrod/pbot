const models = require("./models")

const Commands = module.exports = class Commands {
  constructor(backend) {
    if (typeof backend !== "object") {
      throw new Error("Invalid backend provided when instantiating Commands")
    }
    this.backend = backend
    this.available = []

    this.register("session", (index = "-1") => this.backend.session(index))
    this.register("member", (query) => this.backend.member(index))
    this.register("list", (table) => this.backend.table(table, null, false))
    this.register("reload", (...tables) => this.backend.tables(false, ...tables))
    for (let table of this.backend.tableNames) {
      this.register(table.toLowerCase(), () => this.backend.table(table, null, false))
    }

    this.register("start", (location = "Unknown") => this.backend.create('Sessions', {
      Start: new Date().toISOString(),
      Location: location,
    }))
    this.register("drink", (memberEmail, volume = "40", type = "Beer") => this.backend.create('Drinks', {
      Time: new Date().toISOString(),
      Session: [this.backend.session()._id],
      Member: [this.backend.member(memberEmail)._id],
      Volume: parseInt(volume, 10),
      Type: type,
    }))

    this.register("sum", (what = "-1") => {
      const forSession = what == parseInt(what, 10)
      const groupingTable = forSession ? "Members" : "Sessions"
      return Promise.all([
        this.backend[forSession ? 'session' : 'member'](what),
        this.backend.table(groupingTable),
      ]).then(res => {
        const parent = res[0]
        const groupingItems = res[1]
        const parentId = forSession ? this.backend.normalizeDate(parent.Start) : parent.Email
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
            memo[key].Value += drink.Volume * models.toDrinkType(drink).multiplier
            return memo
          }, {})

          return Object.keys(partitions)
            .map(key => partitions[key])
            .sort((a, b) => this.backend.Value - a.Value)
            .map(row => [
              row.Entity[forSession ? "Name" : "Location"],
              row.Value,
              row.map(drink => {
                const type = models.toDrinkType(drink)
                return drink.Volume + type.emoji
              }).join('  ')
            ])
        })
      })
    })

    this.register("help", () => {
      const cmds = this.available
        .sort((a, b) => a.localeCompare(b))
        .map(cmd => {
          // Ugly and not at all guaranteed to work, but still fun :)
          const args = this[cmd].toString()
            .replace(/^function[^(]*/, "")
            .replace(/(\s*=>\s*|{)[\s\S]+/, "")
            .replace(/^\s*\(|\)\s*$/g, "")
            .split(/\s*,\*/)
            .join(", ")
          return `  ${cmd}(${args})`
        }).join("\n")
      return `* Usage: pbot COMMAND [ARGS...]\n* Available commands:\n${cmds}`
    })
  }

  register(name, fn) {
    this[name] = fn
    this.available.push(name)
    return this
  }

  execute(args) {
    return Promise.resolve().then(() => {
      const commandName = args.shift() || "help"

      // if (parseInt(commandName, 10) == commandName) {
      // args.unshift(commandName)
      // commandName = "drink"
      // }

      const command = this[commandName]

      if (this.available.indexOf(commandName) < 0 || typeof command !== "function") {
        throw new Error(`Unknown command '${commandName}'`)
      }
      if (command.length > args.length) {
        throw new Error(`Insufficient number of arguments for '${commandName}' (${command.length} required)`)
      }

      return command.apply(this, args)
    })
  }
}
