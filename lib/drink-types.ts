import { enumValue } from './backend'
import type { Backend, Drink, DrinkType, NestedEnum } from './types'

export type DrinkTypes = Record<string, DrinkType>

/** Drink types defined through {@link loadDrinkTypes}/{@link defineDrinkTypes}. */
let drinkTypes: DrinkTypes
defineDrinkTypes({})

/** Return drink type metadata (emoji, multiplier) for the given type name. */
export function drinkType(drink: string | { Type: NestedEnum }) {
  if (typeof drink === 'object') {
    drink = enumValue(drink.Type)
  }
  return drinkTypes[drink] || drinkTypes.Unknown
}

/** Convert a drink to the beer-equivalent volume (cl). */
export function drinkToBeerEquivalent(d: Drink) {
  return d.Volume * drinkType(d).Multiplier
}

/** Re-define drink types. */
export function defineDrinkTypes(types: DrinkTypes): DrinkTypes {
  return (drinkTypes = {
    ...types,
    Unknown: {
      Name: 'Unknown' as const,
      Emoji: '🍼',
      Multiplier: 1.0,
      _type: 'DrinkTypes' as const,
      _created: new Date(),
      _id: 'Unknown',
    },
  })
}

/** Load drink types from the backend. */
export async function loadDrinkTypes(backend: Backend) {
  const records = await backend.table('DrinkTypes', null, false)
  const types = Object.values(records).reduce((obj, type) => {
    type.Multiplier = Number(type.Multiplier) // baserow returns string
    obj[type.Name] = type
    return obj
  }, {} as DrinkTypes)
  return defineDrinkTypes(types)
}
