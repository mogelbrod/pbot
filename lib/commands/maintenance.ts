import { command } from '../command.js'
import { findPlaces } from '../google/places.js'

export default command(
  'maintenance',
  'Runs various maintenance tasks',
  async function () {
    const token = await this.config.googleAuthToken!()
    this.output('Running maintenance tasks')
    const sessions = await this.backend.table('Sessions')

    // Stats
    let unchanged = 0
    let changed = 0

    await Promise.all(
      sessions.map((session) => {
        const location = session.Location.trim()

        // Ignore complete records
        if (location === session.Location && session.GooglePlaceID) {
          unchanged += 1
          return Promise.resolve()
        }

        session.Location = location
        changed += 1

        let query = location.replace(/\bÅrsstämma /i, '')
        if (session.Address) {
          query += ', ' + session.Address
        }

        // Only lookup place if not yet mapped
        const placesPromise = session.GooglePlaceID
          ? Promise.resolve()
          : findPlaces(query, {
              googlePlacesKey: token,
              location: this.config.location!.coords,
              radius: this.config.location!.radius,
            })

        return placesPromise.then((places) => {
          if (places?.[0]) {
            session = this.backend.placeToSession(places[0], session)
          }
          return this.backend.updateRecord(session)
        })
      }),
    )

    return [
      `Maintenance completed: ${changed} sessions updated, ${unchanged} unchanged`,
    ]
  },
)
