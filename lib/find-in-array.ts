/**
 * Search utility that finds items in an array by matching a string
 * against one or more properties (case-insensitive).
 *
 * - When `multiple` is `false` (default), returns a single match or throws
 *   on none/multiple.
 * - When `multiple` is `true`, returns all matches (or throws on none).
 *
 * @param array - Array to search
 * @param query - Case-insensitive search string
 * @param props - Properties on `Item` to match against (values are stringified)
 * @param options - Behavior overrides
 * @param options.recordType - Label used in error messages
 * @param options.multiple - When `true`, returns all matches
 * @returns Single `Item` or array of `Item`s depending on `multiple`
 */
export function findInArray<Item, Multiple extends boolean | undefined = false>(
  array: readonly Item[],
  query: string,
  props: Readonly<Array<keyof Item>>,
  {
    recordType = 'record',
    multiple = false,
  }: { recordType?: string; multiple?: Multiple } = {},
): Multiple extends true ? Item[] : Item {
  if (!array || typeof array.filter !== 'function') {
    const type = {}.toString.call(array).slice(8, -1)
    throw new Error(`findInArray: Expected Array but got ${type}`)
  }
  const normalized = query.toLowerCase()
  let results: Item[] = []

  for (const prop of props) {
    const matched = array.filter(
      (m) => m[prop] && String(m[prop]).toLowerCase().indexOf(normalized) >= 0,
    )
    if (multiple) {
      results = results.concat(matched)
    } else {
      switch (matched.length) {
        case 0:
          continue
        case 1:
          return matched[0] as any
        default:
          const which = matched.map((m) => m[prop]).join(', ')
          throw new Error(
            `Multiple ${recordType}s matching \`${normalized}\` on ${prop as string}: ${which}`,
          )
      }
    }
  }

  if (multiple && results.length) {
    return results as any
  }

  throw new Error(`No ${recordType} matching query \`${normalized}\``)
}
