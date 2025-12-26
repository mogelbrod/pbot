import { command, isInt } from '../command.js'
import * as f from '../format.js'
import { searchPlaces } from '../google/places.js'
import { vko } from '../vko.js'
import type { Session } from '../types.js'

export default command(
  'suggest',
  'Suggests establishments to visit',
  async function (
    query = 'pubs',
    price = '0-4',
    openNow = 'no',
    results = '10',
    radius = '5000',
  ) {
    // Sanitize arguments
    query = query.trim()
    const resultsInt =
      isInt(results) && results > 0 && results < 100 ? results : 20
    const radiusInt =
      isInt(radius) && radius > 0
        ? radius
        : this.config.location?.radius || 5000
    let [minPrice, maxPrice] = price.split('-')
    if (!isInt(maxPrice)) {
      maxPrice = isInt(minPrice) && minPrice > 0 ? minPrice : '4'
      minPrice = '0'
    }
    const isOpenNow = !!openNow && openNow !== 'no'
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let [sessions, rows, vkoEntries] = await Promise.all([
      this.backend.table('Sessions'),
      searchPlaces(query, {
        googlePlacesKey: this.config.google!.placesKey!,
        location: this.config.location!.coords,
        radius: radiusInt,
        targetCount: resultsInt,
        minPrice: +minPrice,
        maxPrice: +maxPrice,
        openNow: isOpenNow,
      }),
      vko.getEntries(),
    ])
    if (rows.length > resultsInt) {
      rows = rows.slice(0, resultsInt)
    }
    // Find latest session held at each Google Place ID
    const sessionByPlaceId = sessions.reduce(
      (obj, session) => {
        const id = session.GooglePlaceID
        if (id && (!obj[id] || obj[id].Start < session.Start)) {
          obj[id] = session
        }
        return obj
      },
      {} as Record<string, Session>,
    )
    // Inject additional info into each place
    for (const place of rows) {
      place.Session = sessionByPlaceId[place.place_id]
      const location = place.geometry?.location
      place.VkoEntry =
        location?.lat && location.lng
          ? await vko.getClosestEntry(location.lat, location.lng, 10)
          : undefined
    }
    // Prepend with header
    const link = f.linkify(query, f.placeURL(query, ''))
    const header = [
      `${rows.length} suggestions for "${link}"`,
      (+minPrice > 1 || +maxPrice < 4) && `between 💵 ${minPrice}-${maxPrice}`,
      isOpenNow && `that are currently open`,
    ]
      .filter(Boolean)
      .join(' ')
    return [[f.italic(header)], f.list(rows)]
  },
)
