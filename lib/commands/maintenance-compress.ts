import { command, assertAdminUser, isInt } from '../command.js'
import type { Drink } from '../types.js'

export default command(
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
