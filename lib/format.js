const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
}

exports.escape = (input) => input.replace(/[&<>]/g, c => ESCAPE_MAP[c] || c)

exports.stringify = (input) => typeof input === "string" ? input : JSON.stringify(input, null, 2)

const DRINK_TYPES = exports.DRINK_TYPES = {
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
exports.drinkType = drinkType

exports.fancy = (input, joiner = "\n") => {
  let type = {}.toString.call(input).slice(8, -1)
  if (type === "Object" && input._type) {
    type = input._type
  }
  switch (type) {
    case "Number": return input
    case "String": return input
    case "Array": return input.map(x => exports.fancy(x, " ")).join(joiner)
    case "Drinks": return input.Volume + drinkType(input).emoji
    case "Members": return `*${input.Name}*`
    case "Sessions": return `*${input.Location}* (${exports.time(input.Start)})`
  }
  const str = exports.escape(JSON.stringify(input, null, 2))
  const wrap = str.length > 40 || str.indexOf("\n") >= 0 ? "```" : "`"
  return wrap + str + wrap
}

exports.log = (...args) => ([
  "[",
  exports.time(new Date, true),
  "] ",
  args.map(exports.stringify).join(" ")
].join(""))

// 2017-04-04T17:30:00.000Z => 2017-04-04 17:30[:00]
exports.time = (str, seconds = false) => {
  if (str instanceof Date) {
    str = str.toISOString()
  }
  return str.replace("T", " ").replace(seconds ? /\.\d{3}Z/ : /:\d\d\.\d{3}Z/, "")
}

exports.tokenize = str => {
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
