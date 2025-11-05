import { time, TimestampStyles, escapeMarkdown } from 'discord.js'
import qs from 'query-string'
import type { EntityUnion, ListResult, NestedEnum, Output } from './types'
import { enumValue } from './backend'

let isFancy = true

export function setFancy(enable: boolean): boolean {
  isFancy = enable
  return enable
}

export function basic(): boolean {
  return !isFancy
}

export function escape(v: string): string {
  return basic() ? v : escapeMarkdown(v)
}
export function unescape(v: string): string {
  return v // TODO: Implement unescape?
}

export function capitalize(v: string): string {
  return v[0].toUpperCase() + v.substr(1).toLowerCase()
}

export function stringify(v: any): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.stack || v.message
  return JSON.stringify(v, null, 2)
}

export function isEntity(v: unknown): v is EntityUnion {
  return (
    !!v && typeof v === 'object' && '_type' in v && typeof v._type === 'string'
  )
}

export function fancy(v: unknown, depth = 0): string {
  const joiner = depth > 0 ? ' ' : '\n'
  if (isEntity(v)) {
    switch (v._type) {
      case 'DiscordTag':
        return basic() ? '' : v.value
      case 'Drinks': {
        let volume = String(v.Volume)
        const { emoji } = drinkType(v)
        if (v['Aggregated Volume']) {
          volume = v['Aggregated Volume'].replace(/\+/g, emoji)
        }
        return volume + emoji
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
          (v.Session ? ` 🗓 ${date(v.Session.Start)}` : '')
        )
      }
      case 'RawResult':
        v = v.raw
        break
      case 'ListResult':
        return v.items.map((x) => '- ' + fancy(x, depth + 1)).join('\n')
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

export function wrap(delimeter: string, ...parts: string[]): string {
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

export const bold = wrap.bind(null, '**')
export const italic = wrap.bind(null, '*')
export const code = wrap.bind(null, '`')

export function list(items: Output[]): ListResult {
  return {
    _type: 'ListResult',
    items,
  }
}

export function toFixed(
  number: number | undefined | null,
  decimals = 1,
  fallback = '0',
): string {
  return typeof number === 'number' ? number.toFixed(decimals) : fallback
}

export function log(...args: any[]): string {
  return [
    '[',
    date(new Date(), true, true),
    '] ',
    args.map(stringify).join(' '),
  ].join('')
}

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
  return time(
    date,
    includeTime ? TimestampStyles.ShortDateTime : TimestampStyles.ShortDate,
  )
}

export function linkify(text: string, url?: string | null): string {
  url = url ? escape(url) : luckyURL(text)
  return basic() ? text : `[${text}](<${escape(url)}>)`
}

export function discordTag(value: string): string {
  return basic() ? '' : value
}

export function DiscordTag(value: string) {
  return {
    _type: 'DiscordTag',
    value,
  }
}

type Obj = Record<string, any>

export function addType<T extends Obj | Obj[]>(objectOrArray: T, type: any): T {
  if (Array.isArray(objectOrArray)) {
    objectOrArray.forEach((obj) => addType(obj, type))
  } else if (objectOrArray && typeof objectOrArray === 'object') {
    objectOrArray._type = type
  }
  return objectOrArray
}

export function luckyURL(query: string): string {
  return `http://www.google.com/search?q=${encodeURIComponent(query)}&btnI`
}

export function placeURL(
  query: string,
  placeId?: string | null,
): string | null {
  if (placeId == null) {
    return null
  }
  const queryString = qs.stringify({
    api: 1,
    query,
    query_place_id: placeId,
  })
  return 'https://www.google.com/maps/search/?' + queryString
}

const DRINK_TYPES = {
  Beer: {
    emoji: '🍺',
    multiplier: 1.0,
  },
  Wine: {
    emoji: '🍷',
    multiplier: 2.0,
  },
  Whiskey: {
    emoji: '🥃',
    multiplier: 8.0,
  },
  Soda: {
    emoji: '🍼',
    multiplier: 0,
  },
  Unknown: {
    emoji: '🍼',
    multiplier: 1.0,
  },
}

export function drinkType(drink: string | { Type: NestedEnum }) {
  if (typeof drink === 'object') {
    drink = enumValue(drink.Type)
  }
  return (DRINK_TYPES as Record<string, any>)[drink] || DRINK_TYPES.Unknown
}

export function escapeRegExp(str: string): string {
  return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')
}
