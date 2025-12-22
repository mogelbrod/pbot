import type { EntityType, EntityForTable, Obj } from './types'

/**
 * Mutably stamps an entity or array of entities with the provided `_type`.
 * @param objectOrArray - Object or array to annotate
 * @param type - Discriminant to assign to `_type`
 * @returns The same object/array typed as the target entity variant
 */
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
 * Filter an object's properties into a new object based on a predicate.
 * @param obj - Source object
 * @param predicate - Called with `(key, value)`; return truthy to include
 * @returns New object with selected properties
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
 * Type guard that removes `null`, `undefined` and empty strings.
 * @example
 * const arr = ['a', 'b', '', null, undefined].filter(isPresent)
 * // -> ['a', 'b']
 */
export function isPresent<T>(
  value: T,
): value is Exclude<T, null | undefined | ''> {
  return value !== null && value !== undefined && value !== ''
}

/**
 * Create a shallow copy omitting properties whose keys start with `_`.
 * Commonly used to strip backend/private fields before writes.
 * @param obj - Source object
 * @returns Copy without underscored keys
 */
export function omitUnderscored<T extends Record<string, any>>(
  obj: T,
): Omit<T, UnderscoredKeys<T>> {
  return filter(obj, (key) => !key.startsWith('_')) as Omit<
    T,
    UnderscoredKeys<T>
  >
}

/** Utility type that removes underscored keys from `T`. */
export type OmitUnderscored<T extends Record<string, any>> = Omit<
  T,
  UnderscoredKeys<T>
>
/** Helper type yielding keys of `U` that start with `_`. */
export type UnderscoredKeys<U> = {
  [K in keyof U]: K extends string
    ? K extends `_${string}`
      ? K
      : never
    : never
}[keyof U]
