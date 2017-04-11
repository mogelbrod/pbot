const f = exports
f.basicOutput = false

function basic() { return !!f.basicOutput }

const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
}

f.escape = (v) => v.replace(/[&<>]/g, c => ESCAPE_MAP[c] || c)

f.capitalize = (v) => v[0].toUpperCase() + v.substr(1).toLowerCase()

f.stringify = (v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2))

f.fancy = (v, depth = 0) => {
  const joiner = depth > 0 ? " " : "\n"
  const type = v && v._type || {}.toString.call(v).slice(8, -1)
  switch (type) {
    case "Number": return v
    case "String": return v
    case "Array": return v.map(x => f.fancy(x, depth + 1)).join(joiner)
    case "Drinks": return v.Volume + drinkType(v).emoji
    case "Members": return `*${v.Name}*` + (depth < 2 && v.Role ? ` (${v.Role})` : "")
    case "Sessions": return `${f.linkify(v.Location)} (${f.time(v.Start)})`
    case "RawResult": v = v.raw; break

  }
  const str = f.stringify(v)
  if (basic()) return str
  const wrap = ( str.length > 40 || str.indexOf("\n") >= 0 ? "```" : "`")
  return wrap + f.escape(str) + wrap
}

f.log = (...args) => ([
  "[",
  f.time(new Date, true),
  "] ",
  args.map(f.stringify).join(" ")
].join(""))

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

// 2017-04-04T17:30:00.000Z => 2017-04-04 17:30[:00]
f.time = (str, seconds = false) => {
  if (str instanceof Date) { str = str.toISOString() }
  return str.replace("T", " ").replace(seconds ? /\.\d{3}Z/ : /:\d\d\.\d{3}Z/, "")
}

// 2017-04-04T17:30:00.000Z => 2017-04-04
f.date = (str) => {
  if (str instanceof Date) { str = str.toISOString() }
  return str.replace(/T.+/, "")
}

f.linkify = (text, url) => {
  return basic() ? text : `<${url || f.luckyURL(text)}|${text}>`
}

f.luckyURL = (query) => `http://www.google.com/search?q=${encodeURIComponent(query)}&amp;btnI`

const DRINK_TYPES = f.DRINK_TYPES = {
  Beer: {
    emoji: "🍺",
    multiplier: 1.0,
  },
  Wine: {
    emoji: "🍷",
    multiplier: 2.0,
  },
  Unknown: {
    emoji: "🍼",
    multiplier: 1.0,
  },
}

function drinkType(drink) {
  if (typeof drink === "object") {
    drink = drink.Type
  }
  return DRINK_TYPES[drink] || DRINK_TYPES.Unknown
}
f.drinkType = drinkType
