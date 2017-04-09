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

function toDrinkType(drink) {
  if (typeof drink === "object") {
    drink = drink.Type
  }
  return DRINK_TYPES[drink] || DRINK_TYPES.Unknown
}
exports.toDrinkType = toDrinkType
