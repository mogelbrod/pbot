const f = exports
f.setFancy = setFancy
f.basic = basic

let fancy = true

function setFancy(enable) {
  fancy = enable
  return enable
}

function basic() {
  return !fancy
}

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

f.escape = (v) => v.replace(/[&<>]/g, c => ESCAPE_MAP[c] || c)

f.capitalize = (v) => v[0].toUpperCase() + v.substr(1).toLowerCase()

f.stringify = (v) => {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.stack || v.message
  return JSON.stringify(v, null, 2)
}

f.fancy = (v, depth = 0) => {
  const joiner = depth > 0 ? ' ' : '\n'
  const type = v && v._type || {}.toString.call(v).slice(8, -1)
  switch (type) {
    case 'Number':
    case 'String':
      return v
    case 'Date':
      return f.date(v, true)
    case 'Array':
      return v
        .map(x => f.fancy(x, depth + 1))
        .filter(x => typeof x !== 'string' || x.length).join(joiner)
    case 'SlackVariable':
      return basic() ? '' : `<${v.value}>`
    case 'Drinks':
      return v.Volume + drinkType(v).emoji
    case 'Members':
      return f.wrap('*', v.Name) + (depth < 2 && v.Role ? ` (${v.Role})` : '')
    case 'Sessions':
      return `${f.linkify(v.Location)} (${f.date(v.Start, true)})`
    case 'Feedback':
      return `"${v.Feedback}" - ${f.fancy(v.Author, 2)} (${f.date(v._created, true)})`
    case 'Quotes':
      return `"${v.Quote}" - ${f.fancy(v.Author, 2)} (${f.date(v._created, true)})`
    case 'GooglePlace':
      return [
        f.wrap('*', f.linkify(v.name)) + ` (💵${v.price_level || '?'} ⭐️${v.rating || '?'})`,
        depth < 1 && v.vicinity,
      ].filter(Boolean).join(joiner)
    case 'RawResult':
      v = v.raw
      break
  }
  const str = f.stringify(v)
  if (basic()) return str
  const wrap = ( str.length > 40 || str.indexOf('\n') >= 0 ? '```' : '`')
  return wrap + f.escape(str) + wrap
}

f.wrap = (delimeter, ...parts) => {
  if (typeof delimeter !== 'string') {
    throw new TypeError(`wrap: Delimeter must be a string, got '${delimeter}'`)
  }
  let str = parts.join(' ')
  if (delimeter === '') { return str }
  const delimeterRegex = new RegExp(escapeRegExp(delimeter), 'g')
  str = str.replace(delimeterRegex, '\\'+delimeter)
  return basic() ? str : delimeter+str+delimeter
}

f.bold = f.wrap.bind(null, '*')
f.code = f.wrap.bind(null, '`')

f.log = (...args) => ([
  '[',
  f.date(new Date, true, true),
  '] ',
  args.map(f.stringify).join(' ')
].join(''))

f.tokenize = str => {
  str = str.replace(/”/g, '“')
  const regexp = /([^\s'"“]+(['"“])([^\2]*?)\2)|[^\s'"“]+|(['"“])([^\4]*?)\4/gi
  const tokens = []
  let match
  do {
    match = regexp.exec(str)
    if (match !== null) {
      tokens.push(match[1] || match[5] || match[0])
    }
  } while (match !== null)
  return tokens
}

f.date = (date, time = false, basicOverride) => {
  if (basicOverride == null) {
    basicOverride = basic()
  }

  if (!(date instanceof Date)) {
    date = new Date(date)
  }

  // Convert to local timezone and split into parts
  const simple = new Date(date.getTime() - (date.getTimezoneOffset() * 6e4))
    .toISOString().split(/[T.]/)
    .slice(0, time ? 2 : 1).join(' ')

  if (basicOverride) {
    return simple
  }

  // Slack formatted timestamp
  const unix = Math.floor(date.getTime() / 1e3)
  const format = time ? '{date_num} {time}' : '{date_num}'
  return `<!date^${unix}^${format}|${simple}>`

}

f.linkify = (text, url) => {
  return basic() ? text : `<${url || f.luckyURL(text)}|${text}>`
}

f.SlackVariable = (value) => ({
  _type: 'SlackVariable',
  value,
})

f.luckyURL = (query) => `http://www.google.com/search?q=${encodeURIComponent(query)}&amp;btnI`

const DRINK_TYPES = f.DRINK_TYPES = {
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
  Unknown: {
    emoji: '🍼',
    multiplier: 1.0,
  },
}

function drinkType(drink) {
  if (typeof drink === 'object') {
    drink = drink.Type
  }
  return DRINK_TYPES[drink] || DRINK_TYPES.Unknown
}
f.drinkType = drinkType

function escapeRegExp(str) {
  return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')
}
