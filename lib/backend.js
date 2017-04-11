const Airtable = require("airtable")

exports.Backend = class Backend {
  constructor(config) {
    this.config = config
    this.base = new Airtable({apiKey: config.key}).base(config.base)
    this.data = {}
  }

  get tableNames() {
    return exports.TABLES
  }

  log(...args) {
    return this.config.log ? this.config.log(...args) : false
  }

  tableName(str) {
    return str.replace(/^(.)(.+?)s?$/, (_, c, rest) => c.toUpperCase() + rest + 's')
  }

  parseRecord(record) {
    return (typeof record === "object") ? Object.assign({
      _id: record.id,
      _type: record._table && record._table.name || null,
    }, record.fields) : null
  }

  table(name, args = null, cache = true) {
    const cacheable = !args
    name = this.tableName(name)
    args = args || exports.LIST_ARGS[name]
    if (!name || this.tableNames.indexOf(name) < 0) {
      throw new Error(`Unknown table '${name}'`)
    }
    return new Promise((resolve, reject) => {
      if (cacheable && cache && this.data[name]) {
        return resolve(this.data[name])
      }
      this.log(`[Backend] Retrieving table ${name}`)
      this.base(name).select(args).eachPage((items, next) => {
        items = items.map(this.parseRecord)
        this.log(`[Backend] Got ${items.length} ${name} records`)
        if (cacheable) {
          this.data[name] = items
        }
        resolve(items)
      }, err => (err ? reject(err) : null))
    })
  }

  tables(...names) {
    const cache = names[0] === true
    if (typeof names[0] === "boolean") {
      names.shift()
    }
    if (!names.length) {
      names = exports.RELOADED_TABLES
    }
    return Promise.all(names.map(t => this.table(t, null, cache)))
  }

  session(index = "-1") {
    index = parseInt(index, 10)
    return this.table("Sessions").then(sessions => {
      if (index < 0) index += sessions.length
      const s = sessions[index]
      if (!s) {
        throw new Error(`No sessions found`)
      }
      return s
    })
  }

  member(query) {
    if (typeof query === "object") {
      query = query.name
    }
    if (typeof query !== "string" || !query) {
      return Promise.reject("Invalid member query")
    }
    query = query.toLowerCase()
    const fields = ["SlackID", "Name", "Email"]
    return this.table("Members").then(members => {
      for (let field of fields) {
        const matched = members.filter(m => m[field] && m[field].toLowerCase().indexOf(query) >= 0)
        switch (matched.length) {
          case 0: continue; break
          case 1: return matched[0]
          default:
            const which = matched.map(m => m.Name).join(', ')
            throw new Error(`Multiple members matching \`${query}\`: ${which}`)
        }
      }
      throw new Error(`No member matching query \`${query}\``)
    })
  }

  create(table, data) {
    table = this.tableName(table)
    return new Promise((resolve, reject) => {
      this.base(table).create(data, (err, res) => {
        if (err) {
          err.inputData = data
          return reject(err)
        }
        res = this.parseRecord(res)
        this.data[table] = this.data[table] = []
        this.data[table].push(res)
        this.log(`[Backend] Created ${table} record ${res._id}`)
        resolve(res)
      })
    })
  }

  isAdmin(member) {
    return member && ["President", "Accountant", "Board Member"].indexOf(member.Role) >= 0
  }
}

exports.TABLES = ["Members", "Sessions", "Drinks"]
exports.RELOADED_TABLES = ["Members", "Sessions"]
exports.LIST_ARGS = {
  Members: {sort: [{field: "Name"}], fields: "Email SlackID Name Joined Role".split(" ")},
  Sessions: {sort: [{field: "Start"}], fields: "Start Location".split(" ")},
  Drinks: {sort: [{field: "Time"}]},
}
