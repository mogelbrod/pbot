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
 * TODO: Remove or simplify.
 */
export function parseWindow(spec?: string): {
  start: Date
  end: Date
  label: string
} {
  const now = new Date()
  let start: Date
  let end: Date
  let label = ''

  const toStartOfDay = (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }
  const toEndExclusive = (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    x.setDate(x.getDate() + 1)
    return x
  }

  if (!spec || !spec.trim()) {
    const duration = ms('365d') as unknown as number
    end = now
    start = new Date(end.getTime() - duration)
    label = 'Last 365 days'
    return { start, end, label }
  }

  spec = spec.trim()

  const yearMatch = spec.match(/^([0-9]{4})$/)
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10)
    start = new Date(Date.UTC(y, 0, 1))
    end = new Date(Date.UTC(y + 1, 0, 1))
    label = String(y)
    return { start, end, label }
  }

  const ymMatch = spec.match(/^([0-9]{4})-([0-9]{2})$/)
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10)
    const m = parseInt(ymMatch[2], 10) - 1
    start = new Date(Date.UTC(y, m, 1))
    end = new Date(Date.UTC(y, m + 1, 1))
    label = `${ymMatch[1]}-${ymMatch[2]}`
    return { start, end, label }
  }

  const rangeMatch = spec.match(/^(.+)\.\.(.+)$/)
  if (rangeMatch) {
    const [a, b] = [rangeMatch[1], rangeMatch[2]]
    const parseDay = (s: string): Date | null => {
      const m = s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/)
      if (!m) return null
      return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    }
    const parseMonth = (s: string): Date | null => {
      const m = s.match(/^([0-9]{4})-([0-9]{2})$/)
      if (!m) return null
      return new Date(Date.UTC(+m[1], +m[2] - 1, 1))
    }
    const aDay = parseDay(a) || parseMonth(a)
    const bDay = parseDay(b) || parseMonth(b)
    if (aDay && bDay) {
      start = toStartOfDay(aDay)
      // If b specified as YYYY-MM, end at next month start; if YYYY-MM-DD, end exclusive next day
      const bIsMonth = /^[0-9]{4}-[0-9]{2}$/.test(b)
      end = bIsMonth
        ? new Date(Date.UTC(bDay.getUTCFullYear(), bDay.getUTCMonth() + 1, 1))
        : toEndExclusive(bDay)
      label = `${spec}`
      return { start, end, label }
    }
  }

  const dur = ms(spec as any) as unknown as number
  if (dur && dur > 0) {
    end = now
    start = new Date(end.getTime() - dur)
    label = `Last ${spec}`
    return { start, end, label }
  }

  const fallbackDur = ms('365d') as unknown as number
  end = now
  start = new Date(end.getTime() - fallbackDur)
  label = 'Last 365 days'
  return { start, end, label }
}
