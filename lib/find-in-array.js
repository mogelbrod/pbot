export function findInArray(
  array,
  query,
  props,
  { recordType = 'record', multiple = false } = {},
) {
  if (!array || typeof array.filter !== 'function') {
    const type = {}.toString.call(array).slice(8, -1)
    throw new Error(`findInArray: Expected Array but got ${type}`)
  }
  const normalized = query.toLowerCase()
  let results = []

  for (const prop of props) {
    const matched = array.filter(
      (m) => m[prop] && m[prop].toLowerCase().indexOf(normalized) >= 0,
    )
    if (multiple) {
      results = results.concat(matched)
    } else {
      switch (matched.length) {
        case 0:
          continue
        case 1:
          return matched[0]
        default:
          const which = matched.map((m) => m[prop]).join(', ')
          throw new Error(
            `Multiple ${recordType}s matching \`${normalized}\` on ${prop}: ${which}`,
          )
      }
    }
  }

  if (multiple && results.length) {
    return results
  }

  throw new Error(`No ${recordType} matching query \`${normalized}\``)
}
