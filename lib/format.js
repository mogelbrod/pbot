import { time, TimestampStyles } from 'discord.js'
import qs from 'query-string'

let isFancy = true

/**
 * @param {boolean} enable
 */
export function setFancy(enable) {
  isFancy = enable
  return enable
}

export function basic() {
  return !isFancy
}

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}
const UNESCAPE_MAP = Object.keys(ESCAPE_MAP).reduce((o, key) => {
  o[ESCAPE_MAP[key]] = key
  return o
}, {})

/**
 * @param {string} v
 */
export function escape(v) {
  return basic() ? v : v.replace(/[&<>]/g, (c) => ESCAPE_MAP[c] || c)
}
/**
 * @param {string} v
 */
export function unescape(v) {
  return v.replace(/&(amp|lt|gt);/g, (c) => UNESCAPE_MAP[c] || c)
}

/**
 * @param {string} v
 */
export function capitalize(v) {
  return v[0].toUpperCase() + v.substr(1).toLowerCase()
}

/**
 * @param {any} v
 */
export function stringify(v) {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.stack || v.message
  return JSON.stringify(v, null, 2)
}

/**
 * @param {any} v
 * @param {number} [depth=0]
 */
export function fancy(v, depth = 0) {
  const joiner = depth > 0 ? ' ' : '\n'
  const type = (v && v._type) || {}.toString.call(v).slice(8, -1)
  switch (type) {
    case 'Number':
    case 'String':
      return v
    case 'Date':
      return date(v, true)
    case 'Array':
      return v
        .map((/** @type {any} */ x) => fancy(x, depth + 1))
        .filter(
          (/** @type {string | any[]} */ x) =>
            typeof x !== 'string' || x.length,
        )
        .join(joiner)
    case 'SlackVariable':
      return basic() ? '' : `<${v.value}>`
    case 'Drinks': {
      let volume = v.Volume
      const { emoji } = drinkType(v)
      if (v['Aggregated Volume']) {
        volume = v['Aggregated Volume'].replace(/\+/g, emoji)
      }
      return volume + emoji
    }
    case 'Members':
      return bold(v.Name) + (depth < 2 && v.Role ? ` (${v.Role})` : '')
    case 'Sessions':
      const url = placeURL(v.Location, v.GooglePlaceID)
      return `${linkify(v.Location, url)} (${date(v.Start, true)})`
    case 'Feedback':
      return `"${v.Feedback}" - ${fancy(v.Author, 2)} (${date(v._created, true)})`
    case 'Quotes':
      return `"${v.Quote}" - ${fancy(v.Author, 2)} (${date(v._created, true)})`
    case 'GooglePlace': {
      const address = (v.formatted_address || v.vicinity || '').replace(
        /, .+/,
        '',
      )
      return (
        `[💵 ${v.price_level || '?'} ⭐️ ${toFixed(v.rating, 1, '???')}] ` +
        bold(linkify(v.name, placeURL(v.name, v.place_id))) +
        (address ? ` (${address})` : '') +
        (v.Session ? ` 🗓 ${date(v.Session.Start)}` : '')
      )
    }
    case 'RawResult':
      v = v.raw
      break
  }
  const str = stringify(v)
  if (basic()) return str
  const wrap = str.length > 40 || str.indexOf('\n') >= 0 ? '```' : '`'
  return wrap + escape(str) + wrap
}

/**
 * @param {string} delimeter
 * @param {any[]} parts
 */
export function wrap(delimeter, ...parts) {
  if (typeof delimeter !== 'string') {
    throw new TypeError(`wrap: Delimeter must be a string, got '${delimeter}'`)
  }
  let str = parts.join(' ')
  if (delimeter === '') {
    return str
  }
  const delimeterRegex = new RegExp(escapeRegExp(delimeter), 'g')
  str = str.replace(delimeterRegex, '\\' + delimeter)
  return basic() ? str : delimeter + str + delimeter
}

export const bold = wrap.bind(null, '**')
export const code = wrap.bind(null, '`')

/**
 * @param {number} number
 */
export function toFixed(number, decimals = 1, fallback = '0') {
  return typeof number === 'number' ? number.toFixed(decimals) : fallback
}

/**
 * @param {any[]} args
 */
export function log(...args) {
  return [
    '[',
    date(new Date(), true, true),
    '] ',
    args.map(stringify).join(' '),
  ].join('')
}

/**
 * @param {string} str
 */
export function tokenize(str) {
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

/**
 * @param {string | number | Date} date
 * @param {boolean} [includeTime=false]
 * @param {boolean} [basicOverride]
 */
export function date(date, includeTime = false, basicOverride) {
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

/**
 * @param {string} text
 * @param {string} url
 */
export function linkify(text, url) {
  url = url ? escape(url) : luckyURL(text)
  return basic() ? text : `[${text}](<${escape(url)}>)`
}

/**
 * @param {any} value
 */
export function SlackVariable(value) {
  return {
    _type: 'SlackVariable',
    value,
  }
}

/**
 * @param {any[] | Record<string, any>} objectOrArray
 * @param {any} type
 */
export function addType(objectOrArray, type) {
  if (Array.isArray(objectOrArray)) {
    objectOrArray.forEach((obj) => addType(obj, type))
  } else if (objectOrArray && typeof objectOrArray === 'object') {
    objectOrArray._type = type
  }
  return objectOrArray
}

export function luckyURL(/** @type {string} */ query) {
  return `http://www.google.com/search?q=${encodeURIComponent(query)}&amp;btnI`
}

/**
 * @param {string} query
 * @param {string} [placeId]
 */
export function placeURL(query, placeId) {
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

/**
 * @param {string | { Type: string }} drink
 */
export function drinkType(drink) {
  if (typeof drink === 'object') {
    drink = drink.Type
  }
  return DRINK_TYPES[drink] || DRINK_TYPES.Unknown
}

/**
 * @param {string} str
 */
export function escapeRegExp(str) {
  return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')
}
