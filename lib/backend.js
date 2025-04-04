import Airtable from 'airtable'
import { findInArray } from './find-in-array.js'
import { omitUnderscored } from './utils.js'

export class Backend {
  constructor(config) {
    this.config = config
    this.base = new Airtable({ apiKey: config.key }).base(config.base)
    this.data = {}
    this.inflight = {}
  }

  get tableNames() {
    return TABLES
  }

  log(...args) {
    return this.config.log ? this.config.log(...args) : false
  }

  tableName(str) {
    return str.replace(/^(.)(.+?)s?$/, (_, c, rest) => {
      let name = c.toUpperCase() + rest.toLowerCase()
      if (TABLES.indexOf(name) < 0) {
        name += 's'
      }
      return name
    })
  }

  parseRecord(record) {
    return typeof record === 'object'
      ? Object.assign(
          {
            _id: record.id,
            _type: (record._table && record._table.name) || null,
            _created: record._rawJson.createdTime
              ? new Date(record._rawJson.createdTime)
              : null,
          },
          record.fields,
        )
      : null
  }

  table(name, args = null, useCache = true) {
    const cacheable = !args
    name = this.tableName(name)
    args = args || LIST_ARGS[name]
    if (!name || this.tableNames.indexOf(name) < 0) {
      throw new Error(`Unknown table '${name}'`)
    }

    if (cacheable && useCache && this.data[name]) {
      return Promise.resolve(this.data[name])
    }

    if (cacheable && this.inflight[name]) {
      return this.inflight[name]
    }

    let items = []

    const promise = new Promise((resolve, reject) => {
      this.log(`[Backend] Retrieving table ${name}`)
      this.base(name)
        .select(args)
        .eachPage(
          (results, fetchNextPage) => {
            this.log(`[Backend] Got ${results.length} ${name} records`)
            items = items.concat(results.map(this.parseRecord))
            fetchNextPage() // triggers this function again, or the done function
          },
          (error) => {
            // Done/error function (`error` is null on done)
            if (this.inflight[name] === promise) {
              delete this.inflight[name]
            }
            if (error) {
              reject(error)
            } else {
              if (cacheable) {
                this.data[name] = items
              }
              resolve(items)
            }
          },
        )
    })

    if (cacheable) {
      this.inflight[name] = promise
    }

    return promise
  }

  tables(...names) {
    const cache = names[0] === true
    if (typeof names[0] === 'boolean') {
      names.shift()
    }
    if (!names.length) {
      names = RELOADED_TABLES
    }
    return Promise.all(names.map((t) => this.table(t, null, cache)))
  }

  session(/** @type {string | number} */ index = '-1') {
    index = parseInt(String(index), 10)
    return this.table('Sessions').then((sessions) => {
      if (+index < 0) index += sessions.length
      const s = sessions[index]
      if (!s) {
        throw new Error(`No sessions found`)
      }
      return s
    })
  }

  member(query) {
    if (typeof query === 'object' && query != null) {
      /*
        TODO: Swich to `user.profile.display_name` once `display_name` is
        automatically assigned for newly registered users. Right now a new
        Slack signup only gets user.name, but changes to a user name appears to
        only propagate to `user.profile.display_name`?
      */
      // query = query.profile ? query.profile.display_name : query.name
      query = query.name
    }
    if (typeof query !== 'string' || !query) {
      return Promise.reject(new Error('Invalid member query'))
    }
    query = query.toLowerCase()
    const fields = ['_id', 'SlackID', 'Name', 'Email']
    return this.table('Members').then((members) => {
      return findInArray(members, query, fields, { recordType: 'member' })
    })
  }

  create(table, data) {
    table = this.tableName(table)
    data = omitUnderscored(data)

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

  updateRecord(record) {
    return this.update(record._type, record._id, record)
  }

  update(table, id, data) {
    table = this.tableName(table)
    data = omitUnderscored(data)

    return new Promise((resolve, reject) => {
      this.base(table).update(id, data, (err, res) => {
        if (err) {
          err.inputData = data
          return reject(err)
        }
        res = this.parseRecord(res)
        this.data[table] = this.data[table] || []
        this.data[table].push(res)
        this.log(`[Backend] Updated ${table} record ${res._id}`)
        resolve(res)
      })
    })
  }

  deleteRecord(record) {
    return this.delete(record._type, record._id)
  }

  delete(table, id) {
    table = this.tableName(table)
    return new Promise((resolve, reject) => {
      this.base(table).destroy(id, (err, res) => {
        if (err) {
          err.inputData = { id }
          return reject(err)
        }

        if (this.data[table]) {
          this.data[table] =
            this.data[table].filter((row) => row._id !== id) || []
        }

        this.log(`[Backend] Deleted ${table} record ${id}`)
        resolve(res)
      })
    })
  }

  isAdmin(member) {
    return (
      member &&
      ['President', 'Accountant', 'Board Member', 'SupPleb'].indexOf(
        member.Role,
      ) >= 0
    )
  }

  // 2017-04-04T17:30:00.000Z => 2017-04-04 17:30[:00]
  time(str, seconds = false) {
    if (str instanceof Date) {
      str = str.toISOString()
    }
    return str
      .replace('T', ' ')
      .replace(seconds ? /\.\d{3}Z/ : /:\d\d\.\d{3}Z/, '')
  }

  // 2017-04-04T17:30:00.000Z => 2017-04-04
  date(str) {
    if (str instanceof Date) {
      str = str.toISOString()
    }
    return str.replace(/T.+/, '')
  }

  placeToSession(place, session) {
    if (place) {
      session.GooglePlaceID = place.place_id
      session.Address = place.formatted_address
    }
    return session
  }
}

export const TABLES = ['Members', 'Sessions', 'Drinks', 'Feedback', 'Quotes']
export const RELOADED_TABLES = ['Members', 'Sessions']
export const LIST_ARGS = {
  Members: {
    sort: [{ field: 'Name' }],
    fields: 'Email SlackID Name Joined Role'.split(' '),
  },
  Sessions: {
    sort: [{ field: 'Start' }],
    fields: 'Start Location Address GooglePlaceID'.split(' '),
  },
  Drinks: { sort: [{ field: 'Time' }] },
}
