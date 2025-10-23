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
 * Omits properties whose key begin with an underscore, aka private properties.
 *
 * @param obj - Object to filter
 * @return Copy of obj
 */
export function omitUnderscored(obj: Record<string, any>) {
  return filter(obj, (key) => !key.startsWith('_'))
}
