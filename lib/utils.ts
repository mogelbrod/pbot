import ms from 'ms'
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

/**
 * Parse a window spec into start/end dates.
 * Supports ms-parseable formats (e.g., `7d`, `30d`) and
 * date ranges (`YYYY-MM-DD..YYYY-MM-DD` / `YYYY-MM-DD...YYYY-MM-DD`).
 * Use `.`/`..` for inclusive end date, or `...` to exclude end date.
 */
export function parseDuration(spec?: string): {
  start: Date
  end: Date
} {
  spec = spec?.trim() ?? ''

  // Try date range format with .. (inclusive) or ... (exclusive)
  const rangeMatch = spec.match(
    /^(\d{4})-(\d{2})-(\d{2})(\.{1,3})(\d{4})-(\d{2})-(\d{2})$/,
  )
  if (rangeMatch) {
    const [, y1, m1, d1, sep, y2, m2, d2] = rangeMatch
    const start = new Date(
      parseInt(y1, 10),
      parseInt(m1, 10) - 1,
      parseInt(d1, 10),
    )
    const end = new Date(
      parseInt(y2, 10),
      parseInt(m2, 10) - 1,
      parseInt(d2, 10) + (sep === '...' ? 0 : 1),
    )
    end.setMilliseconds(-1) // Set to end of previous day
    return { start, end }
  }

  // Try ms() format, default to 365d if invalid
  const duration =
    (ms((spec || '365d') as any) as unknown as number) ||
    (ms('365d') as unknown as number)
  const endDate = new Date()
  return {
    start: new Date(endDate.getTime() - duration),
    end: endDate,
  }
}

export function isInt(value: any): value is number {
  // eslint-disable-next-line eqeqeq
  return parseInt(value, 10) == value
}

/** Parse value as int, returning fallback if invalid */
export function toInt(value: any, fallback: number): number {
  const parsed = parseInt(value, 10)
  // eslint-disable-next-line eqeqeq
  return parsed == value ? parsed : fallback
}

/** Clamps value to [min, value, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function rejectError(message: string) {
  return Promise.reject(new Error(message))
}
