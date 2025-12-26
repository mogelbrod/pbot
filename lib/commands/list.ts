import { command, isInt } from '../command.js'
import { enumValue } from '../backend.js'
import { drinkType } from '../drink-types.js'
import type { Drink, Member, Output, Session } from '../types.js'

export default command(
  'list',
  'Lists drinks for a session/user',
  function (what = '-1') {
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
              memo[key].Value += drink.Volume * drinkType(drink).Multiplier
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
  },
)
