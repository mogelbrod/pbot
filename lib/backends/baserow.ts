import fetch from 'node-fetch'
import { LIST_ARGS, RELOADED_TABLES, tableName } from '../backend.js'
import { findInArray } from '../find-in-array.js'
import {
  TABLES,
  type Backend,
  type Config,
  type EntityForTable,
  type EntityType,
  type TableName,
} from '../types.js'
import { omitUnderscored } from '../utils.js'

export function baserowBackend(config: Config): Backend {
  const cfg: Exclude<Config['baserow'], undefined> = config.baserow!

  if (!cfg?.url || !cfg.token) {
    throw new Error(`{ token, url } are required in cfg.baserow`)
  }

  const log = config.log || (() => {})

  /** Table name -> id mapping */
  let tableIds: Record<string, number> | undefined
  const cache: Partial<Record<EntityType, any>> = {}
  const inflight: Record<string, Promise<any> | undefined> = {}

  async function requestJSON<Result = any>(
    path: string,
    opts: {
      method?: string
      headers?: Record<string, string>
      body?: string | Record<string, any> | Array<any> | null
    } = {},
  ): Promise<Result> {
    const headers: Record<string, string> = Object.assign(
      {},
      opts.headers || {},
    )
    headers.Accept = 'application/json'
    headers.Authorization = `Token ${cfg.token}`
    if (opts.body && !(opts.body instanceof String)) {
      headers['Content-Type'] = 'application/json'
    }
    const res = await fetch(
      cfg.url + path.replace(/^\/api\//, '/'),
      Object.assign({}, opts, { headers }),
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const err: any = new Error(
        `Baserow API ${res.status} ${res.statusText}: ${text}`,
      )
      err.status = res.status
      throw err
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.indexOf('application/json') < 0) {
      if (res.status < 300) {
        return {} as Result
      }
      const text = await res.text().catch(() => '')
      throw new Error(`Baserow API didn't return JSON: ${text || res.status}`)
    }
    return res.json() as Promise<any>
  }

  async function ensureTableIds(
    reload = false,
  ): Promise<Record<string, number>> {
    if (tableIds && !reload) return tableIds
    log(`[Backend] Retrieving tables list`)
    const tables = await requestJSON<
      { id: number; name: string; order: string }[]
    >(`/database/tables/all-tables/`)
    tableIds = {}
    for (const t of tables) {
      tableIds[t.name] = Number(t.id)
      // const nameLower = String(t.name).toLowerCase()
      // const tableId = Number(t.id)
      // tableIds[nameLower] = tableId
      // tableIds[nameLower + 's'] = tableId
      // tableIds[nameLower.replace(/s$/, '')] = tableId
    }
    return tableIds
  }

  async function getTableId(tableName: TableName): Promise<number> {
    const tableIds = await ensureTableIds()
    const id = tableIds[tableName]
    if (id == null) {
      throw new Error(`Unknown table '${tableName}'`)
    }
    return id
  }

  const self: Backend = {
    get tableNames() {
      return TABLES
    },

    parseRecord(record) {
      if (!record || typeof record !== 'object') {
        return record
      }
      const result: Record<string, any> = Object.create(null)
      for (const [key, value] of Object.entries(record)) {
        switch (key) {
          case 'id':
            result._id = value
            continue
          case 'order':
            continue
        }
        if (Array.isArray(value)) {
          ;(result as any)[key] = value.map((child) => {
            return child?.id
              ? self.parseRecord({ _type: key, ...child })
              : child
          })
        } else {
          result[key] = record[key]
        }
      }
      return result
    },

    async table(name, args = null, useCache = true) {
      const cacheable = !args
      name = tableName(name) as typeof name
      args ||= LIST_ARGS[name as keyof typeof LIST_ARGS] as any

      const tableId = await getTableId(name)

      if (cacheable && useCache && cache[name]) {
        return Promise.resolve(cache[name])
      }

      const maxRecords = args?.maxRecords ? args.maxRecords : Infinity
      const perPage = Math.min(maxRecords, 200)

      const params = new URLSearchParams()
      params.set('user_field_names', 'yes')
      params.set('size', String(perPage))
      if (args?.fields) params.set('include', args.fields.join(','))
      if (args?.exclude) params.set('exclude', args.exclude.join(','))
      if (args?.filterByFormula) {
        const parts = args.filterByFormula.match(/^([^=]+) = '([^']+)'$/)
        if (!parts) {
          throw new Error(
            'Unsupported filterByFormula format: ' + args.filterByFormula,
          )
        }
        const operation = self.tableNames.includes(parts[1] as any)
          ? 'link_row_has'
          : 'equal'
        params.set(`filter__${parts[1].trim()}__${operation}`, parts[2].trim())
      }
      if (args?.sort && args.sort.length) {
        const orderBy = args.sort
          .map((s) => (s.direction === 'desc' ? '-' : '+') + s.field)
          .join(',')
        params.set('order_by', orderBy)
      }

      const items: Array<EntityForTable<typeof name>> = []

      // eslint-disable-next-line no-async-promise-executor
      const promise = new Promise<typeof items>(async (resolve, reject) => {
        log(`[Backend] Retrieving table ${name}`)
        let nextPageUrl = `/database/rows/table/${tableId}/?${params.toString()}`

        while (nextPageUrl) {
          log(`[Backend] GET ${nextPageUrl}`)
          const data = await requestJSON<{
            results: Array<any>
            count: number
            next?: string
          }>(nextPageUrl)
          const { results } = data
          if (!Array.isArray(results)) {
            throw new Error(
              `Baserow API returned invalid data for table ${name}`,
            )
          }
          results.forEach((r) =>
            items.push(self.parseRecord<any>({ _type: name, ...r })),
          )
          if (data.next && items.length < maxRecords) {
            // data.next may be absolute URL; convert to path
            const nextUrl = new URL(String((data as any).next), cfg.url)
            nextPageUrl = nextUrl.pathname + nextUrl.search
          } else {
            nextPageUrl = ''
            break
          }
        }

        if (items.length > maxRecords) {
          items.length = maxRecords
        }
        resolve(items)
      })

      if (cacheable) {
        inflight[name] = promise
      }

      return promise
    },

    async tables(cacheFlag, ...names) {
      if (!names.length) {
        names = RELOADED_TABLES.slice() as typeof names
      }
      await ensureTableIds(true)
      return (await Promise.all(
        names.map((t) => self.table(t, null, cacheFlag)),
      )) as any
    },

    async session(index: string | number = '-1') {
      let idx = parseInt(String(index), 10)
      const sessions = await self.table('Sessions')
      if (idx < 0) idx += sessions.length
      const s = sessions[idx]
      if (!s) {
        throw new Error(`No sessions found`)
      }
      return s
    },

    async member(query) {
      const members = await self.table('Members')
      if (typeof query === 'object' && query != null) {
        const member = findInArray(members, query.name, ['DiscordID'], {
          recordType: 'member',
        })
        if (member) return member
        log(`[Backend] member(${JSON.stringify(query)}) lookup failed`)
      }
      if (typeof query !== 'string' || !query) {
        return Promise.reject(new Error('Invalid member query'))
      }
      query = query.toLowerCase()
      const fields = ['_id', 'Name', 'Email'] as const
      return findInArray(members, query, fields, { recordType: 'member' })
    },

    async create(table, data) {
      table = tableName(table)
      const tableId = await getTableId(table)
      data = omitUnderscored(data)
      const response = await requestJSON(
        `/database/rows/table/${tableId}/?user_field_names=y`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      )
      const result = self.parseRecord({ _type: table, ...response })
      cache[table]?.push(result)
      log(`[Backend] Created ${table} record ${result?._id}`)
      return result
    },

    updateRecord(record) {
      return self.update(record._type, record._id, record)
    },

    async update(table, id, data) {
      table = tableName(table)
      const tableId = await getTableId(table)
      data = omitUnderscored(data)
      const response = await requestJSON(
        `/database/rows/table/${tableId}/${id}/?user_field_names=y`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      )
      const result = self.parseRecord({ _type: table, ...response })
      if (cache[table]) {
        cache[table] = cache[table].filter((row: any) => row._id !== id) || []
        cache[table].push(result)
      }
      log(`[Backend] Updated ${table} record ${result?._id}`)
      return result
    },

    deleteRecord(record) {
      return self.delete(record._type, record._id)
    },

    async delete(table, id) {
      table = tableName(table)
      const tableId = await getTableId(table)
      await requestJSON(`/database/rows/table/${tableId}/${id}/`, {
        method: 'DELETE',
      })
      log(`[Backend] Deleted ${table} record ${id}`)
      if (cache[table]) {
        cache[table] = cache[table].filter((row: any) => row._id !== id) || []
      }
      return { id }
    },

    time(str, seconds = false) {
      if (str instanceof Date) str = str.toISOString()
      return String(str)
        .replace('T', ' ')
        .replace(seconds ? /\.\d{3}Z/ : /:\d\d\.\d{3}Z/, '')
    },

    date(str) {
      if (str instanceof Date) str = str.toISOString()
      return String(str).replace(/T.+/, '')
    },

    placeToSession(place, session) {
      if (place) {
        session.GooglePlaceID = place.place_id
        session.Address = place.formatted_address
      }
      return session
    },
  }

  ensureTableIds()
    .then((tableIds) => {
      log('[Backend] Retrieved table IDs')
    })
    .catch((err) => {
      log('[Backend] Error: Unable to retrieve tables', err)
    })

  return self
}
