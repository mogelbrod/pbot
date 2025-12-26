import { command, rejectError } from '../command.js'
import * as f from '../format.js'
import { findPlaces } from '../google/places.js'
import { isPresent } from '../utils.js'
import { vko } from '../vko.js'
import type { Output } from '../types.js'

export default command(
  'place',
  'Displays info for a given Google place',
  async function (query) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [allSessions, places, vkoEntries] = await Promise.all([
      this.backend.table('Sessions'),
      findPlaces(query, {
        googlePlacesKey: this.config.google?.placesKey as string,
        location: this.config.location!.coords,
        radius: this.config.location!.radius,
      }),
      vko.getEntries(),
    ])
    const place = places[0]
    if (!place) {
      return rejectError(`No places found matching query \`${query}\``)
    }
    const sessions: Output[] = []
    for (const session of allSessions) {
      if (session.GooglePlaceID !== place.place_id) continue
      sessions.push(['🗓', new Date(session.Start)])
    }

    const location = place.geometry?.location
    const vkoEntry =
      location?.lat && location.lng
        ? await vko.getClosestEntry(location.lat, location.lng, 10)
        : null

    return [
      place,
      vkoEntry,
      f.italic(
        sessions.length
          ? `${sessions.length} session(s) at this place:`
          : `No sessions at this place`,
      ),
      f.list(sessions),
    ].filter(isPresent)
  },
)
