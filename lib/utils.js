/**
 * Filter function for objects like array.filter().
 * Returns a copy of the original object that only includes properties that the
 * predicate returned a truthy value for.
 *
 * @param {Object} obj - Object to filter
 * @param {Function} predicate - Filter function called with `(key, value)`
 * @return {Object} Filtered copy of original object
 */
export function filter(obj, predicate) {
  return Object.keys(obj).reduce((filtered, key) => {
    if (predicate(key, obj[key])) {
      filtered[key] = obj[key]
    }
    return filtered
  }, {})
}

/**
 * Omits properties whose key begin with an underscore, aka private properties.
 *
 * @param {Object} obj - Object to filter
 * @return {Object} Copy of obj
 */
export function omitUnderscored(obj) {
  return filter(obj, (key) => !key.startsWith('_'))
}
