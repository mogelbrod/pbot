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

  tableName(str) {
    return str.replace(/^(.)(.+?)s?$/, (_, c, rest) => c.toUpperCase() + rest + 's')
  }

  normalizeDate(value) {
    // 2017-04-04T17:30:00.000Z => 2017-04-04 17:30
    return value.replace("T", " ").replace(/:\d\d\.\d{3}Z/g, "")
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
        return this.data[name]
      }
      this.base(name).select(args).eachPage((items, next) => {
        items = items.map(this.parseRecord)
        if (cacheable) {
          this.data[name] = items
        }
        resolve(items)
      }, err => (err ? reject(err) : null))
    })
  }

  tables(...names) {
    const cache = names[0] === true
    if (cache) {
      names.shift()
    }
    if (!names.length) {
      names = exports.TABLES
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
    query = query.toLowerCase()
    const fields = ['Name', 'Email']
    return this.table("Members").then(members => {
      const matched = members.filter(m => fields.some(f => m[f].toLowerCase().indexOf(query) >= 0))
      switch (matched.length) {
        case 0: throw new Error(`No member matching query '${query}'`)
        case 1: return matched[0]
      }
      const which = matched.map(m => m.Email).join(', ')
      throw new Error(`Multiple members matching '${query}': ${which}`)
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
        state[table].push(res)
        resolve(res)
      })
    })
  }
}

exports.TABLES = ["Members", "Sessions", "Drinks"]
exports.LIST_ARGS = {
  Sessions: {sort: [{field: "Start"}]},
  Members: {sort: [{field: "Name"}]},
  Drinks: {sort: [{field: "Time"}]},
}
