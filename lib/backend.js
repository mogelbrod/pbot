const Airtable = require("airtable")

const TABLES = exports.TABLES = ["Members", "Sessions", "Drinks"]
const LIST_ARGS = {
  Sessions: {sort: [{field: "Start"}]},
  Members: {sort: [{field: "Name"}]},
  Drinks: {sort: [{field: "Time"}]},
}

exports.Backend = class Backend {
  constructor(config) {
    this.config = config
    this.base = new Airtable({apiKey: config.key}).base(config.base)
    this.data = {}
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
    args = args || LIST_ARGS[name]
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
    return Promise.all(names.map(t => this.table(t, null, cache)))
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
