import { time, TimestampStyles, escapeMarkdown } from 'discord.js'
import type { EntityUnion, ListResult, Output } from './types'
import { enumValue } from './backend'
import { drinkType } from './drink-types'

let isFancy = true

/** Enable or disable fancy formatting. */
export function setFancy(enable: boolean): boolean {
  isFancy = enable
  return enable
}

/** Returns `true` when fancy formatting is disabled. */
export function basic(): boolean {
  return !isFancy
}

/** Escape Markdown when fancy mode is enabled; passthrough otherwise. */
export function escape(v: string): string {
  return basic() ? v : escapeMarkdown(v)
}
export function unescape(v: string): string {
  return v // TODO: Implement unescape?
}

/** Capitalize first letter and lower-case the rest. */
export function capitalize(v: string): string {
  return v[0].toUpperCase() + v.substr(1).toLowerCase()
}

/** Convert value to a log-friendly string. */
export function stringify(v: any): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.stack || v.message
  return JSON.stringify(v, null, 2)
}

/** Type guard that checks for an entity-like object carrying `_type`. */
export function isEntity(v: unknown): v is EntityUnion {
  return (
    !!v && typeof v === 'object' && '_type' in v && typeof v._type === 'string'
  )
}

/** Render a value into a output-friendly string, respecting fancy/basic modes. */
export function fancy(v: unknown, depth = 0): string {
  const joiner = depth > 0 ? ' ' : '\n'
  if (isEntity(v)) {
    switch (v._type) {
      case 'DiscordTag':
        return basic() ? '' : v.value
      case 'Drinks': {
        let volume = String(v.Volume)
        const { Emoji } = drinkType(v)
        if (v['Aggregated Volume']) {
          volume = v['Aggregated Volume'].replace(/\+/g, Emoji)
        }
        return volume + Emoji
      }
      case 'DrinkTypes': {
        return `${v.Emoji} ${v.Name} (×${v.Multiplier})`
      }
      case 'Members':
        return v.Name + (depth < 2 && v.Role ? ` (${enumValue(v.Role)})` : '')
      case 'Sessions':
        const url = placeURL(v.Location, v.GooglePlaceID)
        return `${linkify(v.Location, url)} (${date(v.Start, true)})`
      case 'Feedback':
        return `${wrap('_', v.Feedback)} — ${fancy(v.Author, 2)} (${date(v._created, true)})`
      case 'Quotes':
        return `"${v.Quote}" — ${fancy(v.Author, 2)} (${date(v._created, true)})`
      case 'GooglePlace': {
        const address = (v.formatted_address || v.vicinity || '').replace(
          /, .+/,
          '',
        )
        return (
          `[💵 ${v.price_level || '?'} ⭐️ ${toFixed(v.rating, 1, '?')}] ` +
          bold(linkify(v.name, placeURL(v.name, v.place_id))) +
          (address ? ` (${address})` : '') +
          (v.Session ? ` 🗓 ${date(v.Session.Start)}` : '') +
          (v.VkoEntry ? ' ' + fancy(v.VkoEntry, depth + 1) : '')
        )
      }
      case 'GoogleEvent': {
        const location = v.location?.replace(/, .+/, '')
        return (
          `🗓 ${date(v.start.dateTime || v.start.date, !!v.start.dateTime)}: ` +
          bold(linkify(v.summary, v.htmlLink)) +
          (location ? ` (${linkify(location, placeURL(v.location))})` : '')
        )
      }
      case 'VkoEntry': {
        let str = `🍺 ${v.beerPrice}kr`
        if (v.happyHour) {
          str += ` / ${v.happyHour.allDays ? 'happy-hour' : 'weekdays'}: `
          let comma = false
          for (const r of [v, ...(v.rows || [])]) {
            const hh = r.happyHour
            if (!hh) continue
            if (comma) str += ', '
            str += hh.price ? `${hh.price}kr ${hh.from || ''}—${hh.to}` : hh.to
            comma = true
          }
        }
        return str
      }
      case 'RawResult':
        v = v.raw
        break
      case 'ListResult': {
        const list = v
        return v.items
          .map((x, index) => {
            const prefix =
              ' '.repeat((depth - 1) * 2) +
              (list.numbered ? `${index + 1}. ` : '- ')
            return isEntity(x) &&
              (x._type === 'ListResult' || x._type === 'RawResult')
              ? fancy(x, depth + 1)
              : prefix + fancy(x, depth + 1)
          })
          .join('\n')
      }
    }
  } else {
    switch ({}.toString.call(v).slice(8, -1)) {
      case 'Number':
      case 'String':
        return v as string
      case 'Date':
        return date(v as Date, true)
      case 'Array':
        return (v as any[])
          .map((x) => fancy(x, depth + 1))
          .filter((x) => typeof x !== 'string' || x.length)
          .join(joiner)
    }
  }
  const str = stringify(v)
  if (basic()) {
    return str
  }
  if (str.length > 40 || str.indexOf('\n') >= 0) {
    return '```' + str.replaceAll('```', '\\```') + '```'
  }
  return wrap('`', str)
}

/**
 * Wrap `parts` in a delimiter while escaping occurrences inside the content.
 * No wrapping in basic mode.
 */
export function wrap(
  delimeter: string,
  ...parts: Array<string | number>
): string {
  if (typeof delimeter !== 'string') {
    throw new TypeError(
      `wrap: Delimeter must be a string, got '${delimeter as any}'`,
    )
  }
  let str = parts.join(' ')
  if (delimeter === '' || basic()) {
    return str
  }
  const delimeterRegex = new RegExp(escapeRegExp(delimeter), 'g')
  str = str.replace(delimeterRegex, '\\' + delimeter)
  return delimeter + str + delimeter
}

/** Format text in bold. */
export const bold = wrap.bind(null, '**')
/** Format text in italics. */
export const italic = wrap.bind(null, '*')
/** Format text as code. */
export const code = wrap.bind(null, '`')

/** Create a list of items. */
export function list(items: Output[], numbered = false): ListResult {
  return {
    _type: 'ListResult',
    items,
    numbered,
  }
}

/** Convert numbers to fixed decimals, or return a fallback. */
export function toFixed(
  number: number | undefined | null,
  decimals = 1,
  fallback = '0',
): string {
  return typeof number === 'number' ? number.toFixed(decimals) : fallback
}

/** Format a log line with timestamp and stringified args. */
export function log(...args: any[]): string {
  return [
    '[',
    date(new Date(), true, true),
    '] ',
    args.map(stringify).join(' '),
  ].join('')
}

/** Split a command string into tokens, honoring quotes and backslash escapes. */
export function tokenize(str: string): string[] {
  const tokens = []
  let currentToken = ''
  let quote
  let escaped = false
  for (let index = 0; index < str.length; index += 1) {
    const char = str[index]
    if (escaped) {
      escaped = false
      // Escape newline inside of quotes + ignore newline elsewhere
      if (quote || char !== '\n') {
        currentToken += char
      }
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (quote === undefined && /\s/.test(char)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken)
        currentToken = ''
      }
      continue
    }
    if (char === "'" || char === '"' || char === '“' || char === '”') {
      if (quote === undefined) {
        quote = char
        continue
      }
      if (quote === char) {
        quote = undefined
        continue
      }
    }
    currentToken += char
  }
  if (currentToken.length > 0) {
    tokens.push(currentToken)
  }
  return tokens
}

/** Format a date with optional time component. */
export function date(
  date: string | number | Date,
  includeTime = false,
  basicOverride?: boolean,
): string {
  if (basicOverride == null) {
    basicOverride = basic()
  }

  if (!(date instanceof Date)) {
    date = new Date(date)
  }

  if (basicOverride) {
    // Convert to local timezone and split into parts
    return new Date(date.getTime() - date.getTimezoneOffset() * 6e4)
      .toISOString()
      .split(/[T.]/)
      .slice(0, includeTime ? 2 : 1)
      .join(' ')
  }

  // Discord formatted timestamp
  // Format date + time as two separate parts for more consistent length
  const shortDate = time(date, TimestampStyles.ShortDate)
  return includeTime
    ? shortDate + ' ' + time(date, TimestampStyles.ShortTime)
    : shortDate
  // return time(
  //   date,
  //   includeTime ? TimestampStyles.ShortDateTime : TimestampStyles.ShortDate,
  // )
}

/** Linkify text to URL in fancy mode; passthrough in basic mode. */
export function linkify(text: string, url?: string | null): string {
  url = url ? escape(url) : luckyURL(text)
  return basic() ? text : `[${text}](<${escape(url)}>)`
}

/** Return raw Discord tag (hidden in basic mode). */
export function discordTag(value: string): string {
  return basic() ? '' : value
}

/** Create a `DiscordTag` entity wrapper. */
export function DiscordTag(value: string) {
  return {
    _type: 'DiscordTag',
    value,
  }
}

/** Build a Google "I'm Feeling Lucky" URL for a query. */
export function luckyURL(query: string): string {
  return `http://www.google.com/search?q=${encodeURIComponent(query)}&btnI`
}

/** Build a Google Maps search URL for a place or placeId. */
export function placeURL(
  query: string,
  placeId?: string | null,
): string | null {
  if (!query && !placeId) {
    return null
  }
  const params = new URLSearchParams({
    api: '1',
    query,
    ...(placeId && { query_place_id: placeId }),
  })
  return 'https://www.google.com/maps/search/?' + params.toString()
}

/** Escape special RegExp characters in a string. */
export function escapeRegExp(str: string): string {
  return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')
}
