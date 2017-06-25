const Airtable = require("airtable")

exports.Backend = class Backend {
  constructor(config) {
    this.config = config
    this.base = new Airtable({apiKey: config.key}).base(config.base)
    this.data = {}
    this.inflight = {}
  }

  get tableNames() {
    return exports.TABLES
  }

  log(...args) {
    return this.config.log ? this.config.log(...args) : false
  }

  tableName(str) {
    return str.replace(/^(.)(.+?)s?$/, (_, c, rest) => {
      let name = c.toUpperCase() + rest.toLowerCase()
      if (exports.TABLES.indexOf(name) < 0) {
        name += "s"
      }
      return name
    })
  }

  parseRecord(record) {
    return (typeof record === "object") ? Object.assign({
      _id: record.id,
      _type: record._table && record._table.name || null,
      _created: record._rawJson.createdTime ? new Date(record._rawJson.createdTime) : null,
    }, record.fields) : null
  }

  table(name, args = null, useCache = true) {
    const cacheable = !args
    name = this.tableName(name)
    args = args || exports.LIST_ARGS[name]
    if (!name || this.tableNames.indexOf(name) < 0) {
      throw new Error(`Unknown table '${name}'`)
    }

    if (cacheable && useCache && this.data[name]) {
      return Promise.resolve(this.data[name])
    }

    if (cacheable && this.inflight[name]) {
      return this.inflight[name]
    }

    const promise = new Promise((resolve, reject) => {
      this.log(`[Backend] Retrieving table ${name}`)
      this.base(name).select(args).eachPage((items, next) => {
        items = items.map(this.parseRecord)
        this.log(`[Backend] Got ${items.length} ${name} records`)
        if (cacheable) {
          this.data[name] = items
          if (this.inflight[name] === promise) {
            delete this.inflight[name]
          }
        }
        resolve(items)
      }, err => {
        if (this.inflight[name] === promise) {
          delete this.inflight[name]
        }
        return (err ? reject(err) : null)
      })
    })

    if (cacheable) {
      this.inflight[name] = promise
    }

    return promise
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
      return Promise.reject(new Error("Invalid member query"))
    }
    query = query.toLowerCase()
    const fields = ["_id", "SlackID", "Name", "Email"]
    return this.table("Members").then(members => {
      for (let field of fields) {
        const matched = members.filter(m => m[field] && m[field].toLowerCase().indexOf(query) >= 0)
        switch (matched.length) {
          case 0: continue; break
          case 1: return matched[0]
          default:
            const which = matched.map(m => m.Name).join(", ")
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
        this.data[table] = this.data[table] || []
        this.data[table].push(res)
        this.log(`[Backend] Created ${table} record ${res._id}`)
        resolve(res)
      })
    })
  }

  isAdmin(member) {
    return member && ["President", "Accountant", "Board Member"].indexOf(member.Role) >= 0
  }

  // 2017-04-04T17:30:00.000Z => 2017-04-04 17:30[:00]
  time(str, seconds = false) {
    if (str instanceof Date) { str = str.toISOString() }
    return str.replace("T", " ").replace(seconds ? /\.\d{3}Z/ : /:\d\d\.\d{3}Z/, "")
  }

  // 2017-04-04T17:30:00.000Z => 2017-04-04
  date(str) {
    if (str instanceof Date) { str = str.toISOString() }
    return str.replace(/T.+/, "")
  }
}

exports.TABLES = ["Members", "Sessions", "Drinks", "Feedback", "Quotes"]
exports.RELOADED_TABLES = ["Members", "Sessions"]
exports.LIST_ARGS = {
  Members: {sort: [{field: "Name"}], fields: "Email SlackID Name Joined Role".split(" ")},
  Sessions: {sort: [{field: "Start"}], fields: "Start Location".split(" ")},
  Drinks: {sort: [{field: "Time"}]},
}
