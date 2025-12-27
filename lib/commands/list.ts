import * as f from '../format'
import { command, isInt } from '../command.js'
import { enumValue } from '../backend.js'
import { drinkToBeerEquivalent, drinkType } from '../drink-types.js'
import type { Drink, Member, Output, Session } from '../types.js'
import { sortMapByValue, toInt } from '../utils'

export default command(
  'list',
  'Lists drinks for a session/user',
  async function (what = '-1', limit = '') {
    const forSession = isInt(what)
    const defaultLimit = forSession ? 0 : 8
    let intLimit = limit === 'all' ? 0 : toInt(limit, defaultLimit)
    if (intLimit < 0) intLimit = defaultLimit

    const groupingTable = forSession ? 'Members' : 'Sessions'
    const [parent, groupingItems] = await Promise.all([
      this.backend[forSession ? 'session' : 'member'](what),
      this.backend.table(groupingTable),
    ])

    const parentId =
      this.config.backend === 'baserow'
        ? parent._id
        : forSession
          ? this.backend.time((parent as Session).Start)
          : (parent as Member).Email
    const drinks = await this.backend.table('Drinks', {
      filterByFormula: `${parent._type} = '${parentId}'`,
      sort: [{ field: 'Time', direction: 'asc' }],
    })

    const byType = new Map<string, number>()
    let totalVol = 0

    const partitions = drinks.reduce(
      (memo, drink) => {
        const type = enumValue(drink.Type)
        const vol = drinkToBeerEquivalent(drink)
        const key = enumValue(drink[groupingTable][0], true)
        if (!memo[key]) {
          memo[key] = [] as any
          memo[key].Value = 0
          memo[key].Key = key
          memo[key].Entity = groupingItems.find((it) => key === it._id)
        }
        memo[key].push(drink)
        memo[key].Value += vol
        byType.set(type, (byType.get(type) || 0) + 1)
        totalVol += vol
        return memo
      },
      {} as Record<
        string,
        Array<Drink> & { Value: number; Key: string; Entity: any }
      >,
    )

    const topTypes = sortMapByValue(byType).map((e) => [
      `/`,
      drinkType(e.k),
      `× ${e.v}`,
    ])

    const ranked: Array<Output> = Object.keys(partitions)
      .map((key_1: keyof typeof partitions) => partitions[key_1])
      .sort((a, b) => {
        return forSession
          ? // Multiple members shown => order by volume consumed
            b.Value - a.Value
          : // Multiple sessions shown => order by date
            new Date(b.Entity.Start).valueOf() -
              new Date(a.Entity.Start).valueOf()
      })
      .map((row) => [row.Entity, row.Value + 'cl =', row])

    if (intLimit > 0 && ranked.length > intLimit) {
      const total = ranked.length
      ranked.length = intLimit
      ranked.push(
        f.italic(
          `Showing ${intLimit} of ${total} - specify limit \`all\` to include all`,
        ),
      )
    }

    return [
      parent,
      [Math.round(totalVol) + 'cl', ...topTypes],
      f.list(ranked, true),
    ]
  },
)
