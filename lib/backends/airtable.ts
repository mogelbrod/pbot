import Airtable from 'airtable'
import { findInArray } from '../find-in-array.js'
import {
  TABLES,
  type Backend,
  type Config,
  type EntityForTable,
  type EntityType,
} from '../types.js'
import { omitUnderscored } from '../utils.js'
import {
  LIST_ARGS,
  RELOADED_TABLES,
  placeToSession,
  tableName,
} from '../backend.js'

/** Create an Airtable-backed backend. */
export function airtableBackend(config: Config): Backend {
  if (!config.airtable?.base || !config.airtable.token) {
    throw new Error(`{ token, base } are required in config.airtable`)
  }
  const base = new Airtable({ apiKey: config.airtable.token }).base(
    config.airtable.base!,
  )
  const cache: Partial<Record<EntityType, any>> = {}
  const inflight: Record<string, Promise<any> | undefined> = {}

  const log = config.log || (() => {})

  const self: Backend = {
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
    },

    table(name, args = null, useCache = true) {
      const cacheable = !args
      name = tableName(name) as typeof name
      args ||= LIST_ARGS[name as keyof typeof LIST_ARGS] as any
      if (!name || TABLES.indexOf(name) < 0) {
        throw new Error(`Unknown table '${name}'`)
      }

      if (cacheable && useCache && cache[name]) {
        return Promise.resolve(cache[name])
      }

      if (cacheable && inflight[name]) {
        return inflight[name] as any
      }

      let items: Array<EntityForTable<typeof name>> = []

      const promise = new Promise<typeof items>((resolve, reject) => {
        log(`[backend] Retrieving table ${name}`)
        base(name)
          .select(args || undefined)
          .eachPage(
            (results, fetchNextPage) => {
              log(`[backend] Got ${results.length} ${name} records`)
              items = items.concat(results.map((r) => self.parseRecord<any>(r)))
              fetchNextPage() // triggers this function again, or the done function
            },
            (error) => {
              // Done/error function (`error` is null on done)
              if (inflight[name] === promise) {
                delete inflight[name]
              }
              if (error) {
                reject(error)
              } else {
                if (cacheable) {
                  cache[name] = items
                }
                resolve(items)
              }
            },
          )
      })

      if (cacheable) {
        inflight[name] = promise
      }

      return promise
    },

    tables(cache, ...names) {
      if (!names.length) {
        names = RELOADED_TABLES.slice() as typeof names
      }
      return Promise.all(names.map((t) => self.table(t, null, cache))) as any
    },

    session(index: string | number = '-1') {
      let idx = parseInt(String(index), 10)
      return self.table('Sessions').then((sessions) => {
        if (idx < 0) idx += sessions.length
        const s = sessions[idx]
        if (!s) {
          throw new Error(`No sessions found`)
        }
        return s
      })
    },

    async member(query) {
      const members = await self.table('Members')
      if (typeof query === 'object' && query != null) {
        const member = findInArray(members, query.name, ['DiscordID'], {
          recordType: 'member',
        })
        if (member) return member
        log(`member(${JSON.stringify(query)}) lookup failed`)
      }
      if (typeof query !== 'string' || !query) {
        return Promise.reject(new Error('Invalid member query'))
      }
      query = query.toLowerCase()
      const fields = ['_id', 'Name', 'Email'] as const
      return findInArray(members, query, fields, { recordType: 'member' })
    },

    create(table, data) {
      table = tableName(table)
      data = omitUnderscored(data)

      return new Promise((resolve, reject) => {
        base(table).create(data, (err: any, res: any) => {
          if (err) {
            err.inputData = data
            return reject(err)
          }
          res = self.parseRecord(res)
          cache[table]?.push(res)
          log(`[backend] Created ${table} record ${res._id}`)
          resolve(res)
        })
      })
    },

    updateRecord(record) {
      return self.update(record._type, record._id, record)
    },

    update(table, id, data) {
      table = tableName(table)
      data = omitUnderscored(data)

      return new Promise((resolve, reject) => {
        base(table).update(id, data, (err: any, res: any) => {
          if (err) {
            err.inputData = data
            return reject(err)
          }
          res = self.parseRecord(res)
          if (cache[table]) {
            cache[table] =
              cache[table].filter((row: any) => row._id !== id) || []
            cache[table].push(res)
          }
          log(`[backend] Updated ${table} record ${res._id}`)
          resolve(res)
        })
      })
    },

    deleteRecord(record) {
      return self.delete(record._type, record._id)
    },

    delete(table, id) {
      table = tableName(table)
      return new Promise((resolve, reject) => {
        base(table).destroy(id, (err, res) => {
          if (err) {
            err.inputData = { id }
            return reject(err)
          }

          if (cache[table]) {
            cache[table] =
              cache[table].filter((row: any) => row._id !== id) || []
          }

          log(`[backend] Deleted ${table} record ${id}`)
          resolve(res)
        })
      })
    },

    // 2017-04-04T17:30:00.000Z => 2017-04-04 17:30[:00]
    time(str, seconds = false) {
      if (str instanceof Date) {
        str = str.toISOString()
      }
      return str
        .replace('T', ' ')
        .replace(seconds ? /\.\d{3}Z/ : /:\d\d\.\d{3}Z/, '')
    },

    // 2017-04-04T17:30:00.000Z => 2017-04-04
    date(str) {
      if (str instanceof Date) {
        str = str.toISOString()
      }
      return str.replace(/T.+/, '')
    },

    placeToSession,
  }

  return self
}
