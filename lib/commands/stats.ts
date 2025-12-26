import { command, toInt } from '../command.js'
import * as f from '../format.js'
import { enumValue } from '../backend.js'
import { drinkType } from '../drink-types.js'
import { isPresent, isTruthy, parseDuration } from '../utils.js'
import type { Drink, Output, Session } from '../types.js'

export default command(
  'stats',
  'Shows stats for the given scope (= me/all/specific user) and time period',
  async function (scope = 'me', duration = '1y') {
    const { start, end } = parseDuration(duration)

    const [members, sessions, drinks] = await this.backend.tables(
      true,
      'Members',
      'Sessions',
      'Drinks',
    )

    const sessionById = new Map(sessions.map((s) => [s._id, s]))
    const memberById = new Map(members.map((m) => [m._id, m]))

    const inWindow = (iso: string) => {
      const t = new Date(iso).getTime()
      return t >= start.getTime() && t < end.getTime()
    }
    const drinksInWindow = drinks.filter((d) => inWindow(d.Time))
    const drinkToBeerEquivalent = (d: Drink) =>
      d.Volume * drinkType(d).Multiplier

    const rows: Output[] = [f.italic(`${duration} — stats`)]

    const userQuery =
      scope === 'me' ? this.user : scope === 'all' ? null : scope

    if (userQuery) {
      const member = await this.backend.member(userQuery)
      const memberDrinks = drinksInWindow.filter((d) =>
        d.Members.some((m) => enumValue(m, true) === member._id),
      )
      const memberSessions = unique(
        memberDrinks
          .map((d) => enumValue(d.Sessions[0], true))
          .filter(isPresent),
      )
      let totalCl = 0
      let largest: Drink | undefined
      let largestVol = 0
      const byType = new Map<string, number>()
      const bySession = new Map<string, number>()
      for (const d of memberDrinks) {
        const type = enumValue(d.Type)
        const vol = drinkToBeerEquivalent(d)
        const volActual = toInt(d['Aggregated Volume']?.split('+')?.[0], vol)
        const sessionId = enumValue(d.Sessions[0], true)
        totalCl += vol
        if (!largest || volActual > largestVol) {
          largest = d
          largestVol = volActual
        }
        byType.set(type, (byType.get(type) || 0) + 1)
        bySession.set(sessionId, (bySession.get(sessionId) || 0) + vol)
      }

      const sessionsInWindow = memberSessions
        .map((sid) => sessionById.get(sid)!)
        .filter(isPresent)

      const topPlaces = generateTopPlaces(sessionsInWindow)
      const placeIds = sessionsInWindow.map(
        (s) => s.GooglePlaceID || s.Location,
      )
      const topSessions = sortMapByValue(bySession).map((e, i) => [
        sessionById.get(e.k)!,
        `- ${Math.round(e.v)}cl`,
      ])
      const topTypes = sortMapByValue(byType).map((e) => [
        drinkType(e.k),
        `× ${e.v}`,
      ])
      const favoritePlace = topPlaces[0]
      const hiatus = maxDaysGap(memberDrinks)
      const sessionForLargest = largest
        ? sessionById.get(enumValue(largest.Sessions[0], true))!
        : null

      rows.push(member)
      rows.push(
        f.list(
          [
            [f.bold('🗓 Sessions attended:'), memberSessions.length],
            [f.bold(`🍺 Total beer-eq volume:`) + ` ${Math.round(totalCl)}cl`],
            f.bold('🔥 Most prolific sessions:'),
            f.list(topSessions.slice(0, 5), true),
            [f.bold('🧭 Venues visited:'), unique(placeIds).length],
            !!favoritePlace && [f.bold('📍 Favorite venue:'), favoritePlace],
            f.bold('🥤 Drinks breakdown:'),
            f.list(topTypes, true),
            !!largest && [
              f.bold('🏅 Largest drink:'),
              largest,
              '-',
              sessionForLargest as any,
            ],
            hiatus > 0 && [f.bold(`⏳ Longest hiatus:`), `${hiatus} days`],
          ].filter(isTruthy),
        ),
      )
    } else {
      const byMember = new Map<string, number>()
      const bySession = new Map<string, number>()
      const byPlace = new Map<string, { session: Session; drinks: number }>()
      const byType = new Map<string, number>()
      let totalCl = 0
      for (const d of drinksInWindow) {
        const vol = drinkToBeerEquivalent(d)
        const memberId = enumValue(d.Members[0], true)
        const sessionId = enumValue(d.Sessions[0], true)
        const session = sessionById.get(sessionId)
        const placeId = session?.GooglePlaceID
        const type = enumValue(d.Type)
        totalCl += vol
        byMember.set(memberId, (byMember.get(memberId) || 0) + vol)
        bySession.set(sessionId, (bySession.get(sessionId) || 0) + vol)
        byType.set(type, (byType.get(type) || 0) + 1)
        if (placeId && session) {
          const place = byPlace.get(placeId) || { session, drinks: 0 }
          place.drinks += 1
          byPlace.set(placeId, place)
        }
      }

      const topMembers = sortMapByValue(byMember).map((e, i) => [
        memberById.get(e.k)!,
        `- ${Math.round(e.v)}cl`,
      ])
      const topSessions = sortMapByValue(bySession).map((e, i) => [
        sessionById.get(e.k)!,
        `- ${Math.round(e.v)}cl`,
      ])
      const topPlaces = generateTopPlaces(
        sessions.filter((s) => inWindow(s.Start)),
      )
      const topTypes = sortMapByValue(byType).map((e) => [
        drinkType(e.k),
        `× ${e.v}`,
      ])

      const hiatus = maxDaysGap(drinksInWindow)

      rows.push(
        f.list(
          [
            [f.bold('🗓 Sessions:'), bySession.size],
            [f.bold(`🍺 Total beer-eq volume:`) + ` ${Math.round(totalCl)}cl`],
            [f.bold('🏆 Top members:')],
            f.list(topMembers.slice(0, 5), true),
            f.bold('📈 Busiest sessions:'),
            f.list(topSessions.slice(0, 5), true),
            f.bold('📍 Most visited venues:'),
            f.list(topPlaces.slice(0, 3), true),
            f.bold('🥤 Drinks breakdown:'),
            f.list(topTypes, true),
            hiatus > 0 && [f.bold(`⏳ Longest hiatus:`), `${hiatus} days`],
          ].filter(isTruthy),
        ),
      )
    }

    return rows
  },
)

const unique = <T>(arr: T[]) => Array.from(new Set(arr))

const sortMapByValue = (entries: Map<string, number>) => {
  return Array.from(entries, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)
}

const generateTopPlaces = (sessions: Session[]): Output[] => {
  const sessionsByPlace = new Map<
    string,
    { session: Session; sessions: number }
  >()
  for (const session of sessions) {
    if (!session.GooglePlaceID) continue
    const rec = sessionsByPlace.get(session.GooglePlaceID) || {
      session,
      sessions: 0,
    }
    rec.sessions += 1
    sessionsByPlace.set(session.GooglePlaceID, rec)
  }
  return Array.from(sessionsByPlace)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .map(([placeId, place], i) => {
      const { Location, GooglePlaceID } = place.session
      return [
        f.linkify(Location, f.placeURL(Location, GooglePlaceID)),
        `× ${place.sessions}`,
      ]
    })
}

const maxDaysGap = (memberDrinks: Drink[]) => {
  const drinkTimes = memberDrinks
    .map((d) => new Date(d.Time).getTime())
    .sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 1; i < drinkTimes.length; i++) {
    maxGap = Math.max(maxGap, drinkTimes[i] - drinkTimes[i - 1])
  }
  return Math.floor(maxGap / 86400000)
}
