import type { EntityType, EntityForTable, Obj } from './types'

export function addType<T extends Obj | Obj[], Type extends EntityType>(
  objectOrArray: T,
  type: Type,
): T extends Obj[] ? Array<EntityForTable<Type>> : EntityForTable<Type> {
  if (Array.isArray(objectOrArray)) {
    objectOrArray.forEach((obj) => addType(obj, type))
  } else if (objectOrArray && typeof objectOrArray === 'object') {
    objectOrArray._type = type
  }
  return objectOrArray as any
}

/**
 * Filter function for objects like array.filter().
 * Returns a copy of the original object that only includes properties that the
 * predicate returned a truthy value for.
 *
 * @param obj - Object to filter
 * @param predicate - Filter function called with `(key, value)`
 * @return Filtered copy of original object
 */
export function filter<Obj extends Record<string, any>>(
  obj: Obj,
  predicate: (key: string, value: Obj[keyof Obj]) => boolean,
): Obj {
  return Object.keys(obj).reduce((filtered: Obj, key) => {
    if (predicate(key, obj[key])) {
      ;(filtered as any)[key] = obj[key]
    }
    return filtered
  }, {} as Obj)
}

/**
 * Type guard that filters out `null`, `undefined`, and empty strings.
 * Can be used with `Array.prototype.filter`.
 *
 * @example
 * ```ts
 * const arr = ['a', 'b', '', null, undefined]
 * const filtered = arr.filter(isPresent) // -> ['a', 'b']
 * ```
 *
 * @param value - The value to check.
 * @returns `true` if the value is not `null`, `undefined`, or `''`.
 */
export function isPresent<T>(
  value: T,
): value is Exclude<T, null | undefined | ''> {
  return value !== null && value !== undefined && value !== ''
}

/**
 * Omits properties whose key begin with an underscore, aka private properties.
 *
 * @param obj - Object to filter
 * @return Copy of obj
 */
export function omitUnderscored<T extends Record<string, any>>(
  obj: T,
): Omit<T, UnderscoredKeys<T>> {
  return filter(obj, (key) => !key.startsWith('_')) as Omit<
    T,
    UnderscoredKeys<T>
  >
}

export type OmitUnderscored<T extends Record<string, any>> = Omit<
  T,
  UnderscoredKeys<T>
>
export type UnderscoredKeys<U> = {
  [K in keyof U]: K extends string
    ? K extends `_${string}`
      ? K
      : never
    : never
}[keyof U]
