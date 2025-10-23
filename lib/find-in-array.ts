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
