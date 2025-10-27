import ms from 'ms'
import * as f from './format.js'
import { findPlaces, searchPlaces } from './google-places.js'
import type {
  Backend,
  Config,
  Drink,
  EntityForTable,
  Member,
  Output,
  Session,
  TableName,
  User,
} from './types.js'
import type { GuildMember } from 'discord.js'
import { isAdmin, enumValue, placeToSession } from './backend.js'
import type { OmitUnderscored } from './utils.js'

export interface CommandContext {
  config: Config
  backend: Backend
  log: (...args: any[]) => void
  output: (result: any) => void
  event?: unknown
  user?: User
  users?: GuildMember[]
}

export type CommandFn = (
  this: CommandContext,
  ...args: string[]
) => Output | Promise<Output>

export const commands: Record<string, { description: string; fn: CommandFn }> =
  {}

/**
 * Parse and execute the given input.
 *
 * @param input - Raw input string or tokens array.
 * @return Execution result
 */
export function execute(
  this: CommandContext,
  input: string[] | string,
): Promise<Output> {
  if (typeof this !== 'object' || !this.backend) {
    throw new Error('Must provide a valid execution context as `this`')
  }

  return Promise.resolve().then(() => {
    if (typeof input === 'string') {
      input = f.tokenize(input)
    }

    // TODO: Should this be done here?
    if (!f.basic()) {
      input = input.map(f.unescape)
    }

    if (isInt(input[0])) {
      input.unshift('drink')
    }

    let commandName = input.shift()
    if (typeof commandName !== 'string' || !commandName.length) {
      commandName = 'help'
    } else {
      commandName = commandName.toLowerCase()
    }

    const commandDef = commands[commandName]

    if (!commandDef || typeof commandDef.fn !== 'function') {
      throw new Error(`Unknown command \`${f.escape(commandName)}\``)
    }
    if (commandDef.fn.length > input.length) {
      throw new Error(
        `Insufficient number of arguments for \`${commandName}${functionToArgsString(commandName)}\``,
      )
    }

    return commandDef.fn.apply(this, input)
  })
}

export function functionToArgsString(command: string, leadingSpace = true) {
  const definition = commands[command]
  if (!definition) {
    throw new Error(`Command \`${command}\` not found`)
  }
  // Ugly and not at all guaranteed to work, but still fun :)
  const str = definition.fn
    .toString()
    .replace(/^(async )?function[^(]*/, '') // strip leading function syntax
    .replace(/(\s*=>\s*|{)[\s\S]+/, '') // strip function block
    .replace(/^\s*\(|\)\s*$/g, '') // remove wrapping parentheses
    .replace(/\s+=\s+/g, '=') // remove whitespace next to =
    .trim() // trim leading & trailing whitespace
    .split(/\s*,\s*/) // split into argument array
    .join(' ')
  return leadingSpace && str.length ? ' ' + str : str
}

/**
 * Registers a command.
 * Command functions must be declared using ES5 syntax since context is bound
 * to `this` during execution.
 *
 * @param name - Command name used to call it.
 * @param description - Command description, displayed when running `help`.
 * @param fn - ES5 function to invoke when running command.
 * @returns Returns the same function passed as the `fn` argument.
 */
function command<Fn extends CommandFn>(
  name: string,
  description: string,
  fn: Fn,
): Fn {
  commands[name] = { description, fn }
  return fn
}

command(
  'session',
  'Displays the given/current session',
  function (index = '-1') {
    return this.backend.session(index)
  },
)

command('sessions', 'Lists most recent/all sessions', function (limit = '10') {
  let intLimit = parseInt(String(limit), 10)
  if (!isInt(intLimit) || intLimit < 0) {
    intLimit = 0
  }

  return this.backend.table('Sessions', null, false).then((sessions) => {
    if (intLimit) {
      const total = sessions.length
      sessions = sessions.slice(-intLimit)
      if (intLimit < total) {
        sessions.unshift(
          `Showing ${intLimit} of ${total} sessions (\`sessions all\` to see all)` as any,
        )
      }
    }
    return sessions
  })
})

command(
  'member',
  'Displays user with the given name/email',
  function (query = '') {
    const member = query || this.user
    if (!member) {
      return rejectError(
        '`query` argument is required since user is missing from context',
      )
    }
    return this.backend.member(member)
  },
)

command('members', 'Lists all members', function () {
  return this.backend.table('Members', null, false)
})

command('reload', 'Reloads all tables', function (...tables) {
  return this.backend
    .tables(false, ...(tables as TableName[]))
    .then(() => `Reloaded tables ${tables.join(', ')}`)
})

command('start', 'Begins a new session', async function (location = 'Unknown') {
  let session: OmitUnderscored<Session> = {
    Start: new Date().toISOString(),
    Location: location,
    Address: '',
  }
  return findPlaces(location, {
    googlePlacesKey: this.config.google!.placesKey!,
  })
    .catch((error) => {
      this.output(error)
      return null
    })
    .then((places) => {
      if (places && places[0]) {
        session = placeToSession(places[0], session)
      }
      return this.backend.create('Sessions', session)
    })
    .then((res) => {
      this.output([['Started new session', res]])
      return commands.timer.fn.call(
        this,
        '2h',
        `${f.discordTag('@everyone')} End of regular session`,
      )
    })
})

// TODO: Either move this to airtable (yuck) or to the `this` context (requires
// context to be reused throughout script lifetime)
const activeTimers: any[] = []

command(
  'timer',
  'Sets a timer (duration=cancel cancels most recent)',
  function (duration = '2h', message = 'Timer ended') {
    if (duration === 'cancel') {
      const timeout = activeTimers.pop()
      if (timeout) {
        clearTimeout(timeout)
        return 'Cancelled most recent timer'
      } else {
        return 'No timers to cancel'
      }
    }

    const milliseconds = ms(duration as any) as unknown as number

    if (!milliseconds || milliseconds <= 1e3) {
      return rejectError(`Invalid timer duration ${f.code(duration)}`)
    }

    const timeout = setTimeout(() => {
      this.output([[message, `(${duration})`]])
    }, milliseconds)

    activeTimers.push(timeout)

    return `Timer set: ${f.bold(duration)}`
  },
)

command(
  'drink',
  'Registers a drink for a member',
  function (volume = '40', type = 'Beer', member = '') {
    if (!member && !this.user) {
      return rejectError(`A member must be provided`)
    }

    const intVolume = parseInt(volume, 10)

    if (!isInt(volume) || intVolume === 0 || intVolume > 3e3) {
      return rejectError(`Invalid volume \`${volume}\``)
    }

    const isModifier = volume[0] === '+' || volume[0] === '-'

    return Promise.all([
      this.backend.session(),
      this.backend.member(member || this.user),
    ]).then((res) => {
      const [session, member] = res

      // Simply create new drink record
      if (!isModifier) {
        return this.backend
          .create('Drinks', {
            Time: new Date().toISOString(),
            Sessions: [session._id],
            Members: [member._id],
            Volume: intVolume,
            Type: f.capitalize(type),
          })
          .then((drink) => [['Registered', drink, 'to', member]])
      }

      // Modify last drink by member
      return this.backend
        .table('Drinks', {
          filterByFormula: `${member._type} = '${member.Email}'`,
          maxRecords: 1,
          sort: [{ field: 'Time', direction: 'desc' }],
        })
        .then(([drink]) => {
          if (!drink) {
            throw new Error(
              `${f.escape(member.Name)} doesn't appear to have any drinks to modify`,
            )
          }

          const newVolume = parseInt(drink.Volume as any, 10) + intVolume
          const deleted = newVolume <= 0

          return this.backend[deleted ? 'delete' : 'update'](
            'Drinks',
            drink._id!,
            deleted ? (undefined as any) : { Volume: newVolume },
          ).then((updatedDrink) => [
            [
              deleted ? 'Deleted' : 'Updated',
              deleted ? drink : updatedDrink,
              `(${intVolume >= 0 ? '+' : ''}${intVolume}) belonging to`,
              member,
            ],
          ])
        })
    })
  },
)

command('sum', 'Alias of list', function (what = '-1') {
  // eslint-disable-next-line prefer-rest-params
  return commands.list.fn.apply(this, arguments as any)
})

command(
  'suggest',
  'Suggests establishments to visit',
  function (
    query = '',
    price = '0-4',
    openNow = 'no',
    results = '20',
    radius = '5000',
  ) {
    // Sanitize arguments
    query = ('pubs ' + query).trim()
    const resultsInt =
      isInt(results) && results > 0 && results < 100 ? results : 20
    const radiusInt = isInt(radius) && radius > 0 ? radius : 5000
    let [minPrice, maxPrice] = price.split('-')
    if (!isInt(maxPrice)) {
      maxPrice = isInt(minPrice) && minPrice > 0 ? minPrice : '4'
      minPrice = '0'
    }
    const isOpenNow = !!openNow && openNow !== 'no'

    return Promise.all([
      this.backend.table('Sessions'),
      searchPlaces(query, {
        googlePlacesKey: this.config.google!.placesKey!,
        targetCount: resultsInt,
        minPrice: +minPrice,
        maxPrice: +maxPrice,
        openNow: isOpenNow,
        radius: radiusInt,
      }),
    ]).then(([sessions, rows]) => {
      // Find latest session held at each Google Place ID
      const sessionByPlaceId = sessions.reduce(
        (obj, session) => {
          const id = session.GooglePlaceID
          if (id && (!obj[id] || obj[id].Start < session.Start)) {
            obj[id] = session
          }
          return obj
        },
        {} as Record<string, Session>,
      )

      // Inject latest session into each place
      rows.forEach((place) => {
        place.Session = sessionByPlaceId[place.place_id]
      })

      if (rows.length > resultsInt) {
        rows = rows.slice(0, resultsInt)
      }

      // Prepend with header
      const link = f.linkify(query, f.placeURL(query, ''))
      const header = [
        `${rows.length} suggestions for "${link}"`,
        (+minPrice > 1 || +maxPrice < 4) &&
          `between 💵 ${minPrice}-${maxPrice}`,
        openNow && `that are currently open`,
      ]
        .filter(Boolean)
        .join(' ')

      rows.unshift([f.wrap('*', header)])
      return rows
    })
  },
)

command(
  'place',
  'Displays info for a given Google place',
  async function (query) {
    const [sessions, places] = await Promise.all([
      this.backend.table('Sessions'),
      findPlaces(query, { googlePlacesKey: this.config.google!.placesKey! }),
    ])

    const place = places[0]

    if (!place) {
      return rejectError(`No places found matching query \`${query}\``)
    }

    const rows: any = []
    for (const session of sessions) {
      if (session.GooglePlaceID !== place.place_id) continue
      rows.push(['🗓', new Date(session.Start)])
    }

    rows.unshift([
      f.wrap(
        '*',
        rows.length
          ? `${rows.length} session(s) at this place:`
          : `No sessions at this place`,
      ),
    ])

    rows.unshift(place)
    return rows
  },
)

command('maintenance', 'Runs various maintenance tasks', function () {
  this.output('Running maintenance tasks')
  return this.backend.table('Sessions').then((sessions) => {
    // Stats
    let unchanged = 0
    let changed = 0

    const sessionUpdates = sessions.map((session) => {
      const location = session.Location.trim()

      // Ignore complete records
      if (location === session.Location && session.GooglePlaceID) {
        unchanged += 1
        return Promise.resolve()
      }

      session.Location = location
      changed += 1

      let query = location.replace(/\bÅrsstämma /i, '')
      if (session.Address) {
        query += ', ' + session.Address
      }

      // Only lookup place if not yet mapped
      const placesPromise = session.GooglePlaceID
        ? Promise.resolve()
        : findPlaces(query, {
            googlePlacesKey: this.config.google!.placesKey!,
          })

      return placesPromise.then((places) => {
        if (places?.[0]) {
          session = this.backend.placeToSession(places[0], session)
        }
        return this.backend.updateRecord(session)
      })
    })

    return Promise.all(sessionUpdates).then(() => [
      `Maintenance completed: ${changed} sessions updated, ${unchanged} unchanged`,
    ])
  })
})

command(
  'maintenance-compress',
  'Merges drinks in oldest sessions to free up Airtable rows',
  function (rows = '1') {
    if (this.config.backend !== 'airtable') {
      return `This command is only available when using the Airtable backend`
    }
    let rowsInt = parseInt(String(rows), 10)
    if (!isInt(rows) || rowsInt < 1 || rowsInt > 100) {
      rowsInt = 1
    }
    let deleted = 0

    const table = 'Drinks'
    this.output(`Compressing ${table} table`)

    return Promise.all([
      assertAdminUser(this),
      this.backend.table('Sessions'),
      this.backend.table(table, {
        filterByFormula: `Type = 'Beer'`,
        sort: [{ field: 'Members' }, { field: 'Sessions' }, { field: 'Time' }],
      }),
    ]).then(([adminUser, sessions, allDrinks]) => {
      const promises = []
      const grouped: Record<string, Record<string, Drink[]>> = {}

      allDrinks.forEach((drink) => {
        const member = drink.Members[0]
        const session = drink.Sessions[0]
        const memberId = typeof member === 'string' ? member : member.value
        const sessionId = typeof session === 'string' ? session : session.value
        if (!member || !session) {
          this.output([`Drink with empty session/member: #${drink.Id}`])
          return
        }
        grouped[sessionId] = grouped[sessionId] || {}
        grouped[sessionId][memberId] = grouped[sessionId][memberId] || []
        grouped[sessionId][memberId].push(drink)
      })

      // Iterate through oldest session(s) first
      sessions.sort((a, b) => a.Start.localeCompare(b.Start))

      for (const session of sessions) {
        const sessionId = session._id!
        if (Object.prototype.hasOwnProperty.call(grouped, sessionId)) {
          if (deleted >= rowsInt) {
            break
          }

          let deletedInSession = 0

          for (const memberId in grouped[sessionId]) {
            if (
              Object.prototype.hasOwnProperty.call(grouped[sessionId], memberId)
            ) {
              const drinks = grouped[sessionId][memberId]
              if (!drinks || drinks.length < 2) {
                continue
              }
              const volumes = drinks.map((d) => d.Volume)
              const aggregate = Object.assign({}, drinks[0], {
                Volume: volumes.reduce((total, v) => total + v),
                'Aggregated Volume': volumes.join('+'),
              })
              delete (aggregate as any).Id // Auto-incremented values are immutable
              deletedInSession += drinks.length - 1
              promises.push(
                // Update aggregate first, then delete old rows
                this.backend.updateRecord(aggregate).then(() => {
                  return Promise.all(
                    drinks
                      .slice(1)
                      .map((drink) => this.backend.deleteRecord(drink)),
                  )
                }),
              )
            }
          }

          if (deletedInSession) {
            deleted += deletedInSession
            this.output([
              [`Compressed ${deletedInSession} rows in`, session || sessionId],
            ])
          }
        }
      }

      return Promise.all(promises).then(() => {
        return `Freed up ${deleted} rows out of ${allDrinks.length}`
      })
    })
  },
)

command('list', 'Lists drinks for a session/user', function (what = '-1') {
  const forSession = isInt(what)
  const groupingTable = forSession ? 'Members' : 'Sessions'
  return Promise.all([
    this.backend[forSession ? 'session' : 'member'](what),
    this.backend.table(groupingTable),
  ]).then((res) => {
    const parent = res[0]
    const groupingItems = res[1]
    const parentId =
      this.config.backend === 'baserow'
        ? parent._id
        : forSession
          ? this.backend.time((parent as Session).Start)
          : (parent as Member).Email
    return this.backend
      .table('Drinks', {
        filterByFormula: `${parent._type} = '${parentId}'`,
        sort: [{ field: 'Time', direction: 'asc' }],
      })
      .then((drinks) => {
        const partitions = drinks.reduce(
          (memo, drink) => {
            const key = enumValue(drink[groupingTable][0], true)
            if (!memo[key]) {
              memo[key] = [] as any
              memo[key].Value = 0
              memo[key].Key = key
              memo[key].Entity = groupingItems.find((it) => key === it._id)
            }
            memo[key].push(drink)
            memo[key].Value += drink.Volume * f.drinkType(drink).multiplier
            return memo
          },
          {} as Record<
            string,
            Array<Drink> & { Value: number; Key: string; Entity: any }
          >,
        )

        const ranked: Array<Output> = Object.keys(partitions)
          .map((key: keyof typeof partitions) => partitions[key])
          .sort((a, b) => {
            return forSession
              ? // Multiple members shown => order by volume consumed
                b.Value - a.Value
              : // Multiple sessions shown => order by date
                new Date(b.Entity.Start).valueOf() -
                  new Date(a.Entity.Start).valueOf()
          })
          .map((row, index) => [
            index + 1 + '.',
            row.Entity,
            row.Value + 'cl =',
            row,
          ])

        ranked.unshift(parent)
        return ranked
      })
  })
})

command(
  'signup',
  'Registers a new member',
  function (email, name = '', role = 'Prospect') {
    const memberPromise = this.user
      ? this.backend.member(this.user).catch((err) => {
          if (/No member matching query/.test(err.message)) {
            return null
          }
          throw err
        })
      : Promise.resolve(null)

    return memberPromise
      .then((member) => {
        let discordId = null

        if (this.user && member && !name) {
          throw new Error(`${member.Name} already signed up`)
        }

        if (role !== 'Prospect' && !isAdmin(member!)) {
          throw new Error('Only admins are allowed to add other members')
        }

        // Use discord user data to fill out any missing inputs
        if (this.user && !member) {
          name ||= this.user.displayName || this.user.name
          discordId = this.user.name // TODO: Avoid assigning discordId if already set on another user
        }

        // Validate inputs
        if (
          !/^[A-Z0-9_+-]+(\.[A-Z0-9_+-]+)*@[A-Z0-9][A-Z0-9_-]*(\.[A-Z0-9_-]+)*\.[A-Z]{2,10}$/i.test(
            email,
          )
        ) {
          throw new Error('Invalid email address provided')
        }
        if (!name || name.length < 2) {
          throw new Error('Provide a name for the new member')
        }

        return this.backend
          .member(email)
          .then((existing) => {
            if (existing) {
              throw new Error(`${existing.Name} already signed up`)
            }
          })
          .catch((err) =>
            this.backend.create('Members', {
              Email: email,
              Name: name,
              Role: role,
              DiscordID: discordId,
              Joined: this.backend.date(new Date()),
            }),
          )
      })
      .then((res) => [['Added member', res]])
  },
)

command(
  'quote',
  'Add or display a random quote',
  textMemberCommand('Quotes', 'Quote', 'Author'),
)

command(
  'feedback',
  'Register or display feedback',
  textMemberCommand('Feedback', 'Feedback', 'Author'),
)

command('help', 'Lists available commands', function (command = '') {
  if (command) {
    const description = commands[command]?.description
    if (description) {
      return [
        `*Usage:* \`pbot ${command}${functionToArgsString(command)}\` - ${description}`,
      ]
    } else {
      return [`Command not found: \`${command}\``]
    }
  }

  return ['*Usage:* `pbot COMMAND [ARGS...]`', 'Available commands:'].concat(
    Object.keys(commands)
      .sort((a, b) => a.localeCompare(b))
      .map((command) => {
        return `•  \`${command}${functionToArgsString(command)}\` - ${commands[command].description}`
      }),
  )
})

command(
  'raw',
  'Executes the given input without formatting its output',
  function (...cmd) {
    return execute.call(this, cmd).then((raw) => ({
      _type: 'RawResult',
      raw,
    }))
  },
)

function textMemberCommand<Table extends TableName>(
  table: Table,
  textColumn: keyof EntityForTable<Table>,
  memberColumn: keyof EntityForTable<Table>,
) {
  // Populates member
  function formatResult(this: CommandContext, res: EntityForTable<Table>) {
    const promise =
      res[memberColumn] &&
      Array.isArray(res[memberColumn]) &&
      res[memberColumn].length
        ? this.backend.member(res[memberColumn][0])
        : Promise.resolve(null)
    return promise.then((member) => {
      const copy = Object.assign({}, res)
      // @ts-ignore
      copy[memberColumn] = member
      return copy
    })
  }

  return function (this: CommandContext, text = '', member = '') {
    // List existing rows when no text is provided
    if (!text || isInt(text)) {
      return this.backend.table(table).then((rows) => {
        const slice = isInt(text)
          ? rows.slice(-text)
          : [rows[Math.floor(Math.random() * rows.length)]]
        return Promise.all(slice.map(formatResult.bind(this)))
      })
    }

    // Create new row attributed to some member
    return this.backend
      .member(member || this.user)
      .catch((err) => {
        if (/Invalid member query/.test(err.message)) {
          return null
        }
        throw err
      })
      .then((member) => {
        const data: any = {}
        data[textColumn] = text
        data[memberColumn] = member && [member._id]
        return this.backend.create(table, data)
      })
      .then(formatResult.bind(this))
  }
}

function assertAdminUser(context: CommandContext): Promise<Member | undefined> {
  if (!context.user) {
    return Promise.resolve(undefined)
  }
  const message = `Only available to admins`
  return context.backend
    .member(context.user)
    .then((member) => {
      if (isAdmin(member)) {
        return Promise.resolve(member)
      }
      throw new Error(message)
    })
    .catch((err) => {
      if (/No member matching query/.test(err.message)) {
        throw new Error(message + ' (user not found)')
      }
      throw err
    })
}

function isInt(value: any): value is number {
  // eslint-disable-next-line eqeqeq
  return parseInt(value, 10) == value
}

function rejectError(message: string) {
  return Promise.reject(new Error(message))
}
