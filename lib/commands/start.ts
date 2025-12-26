import { command, commands } from '../command.js'
import * as f from '../format.js'
import { findPlaces } from '../google/places.js'
import { placeToSession } from '../backend.js'
import type { OmitUnderscored } from '../utils.js'
import type { Session } from '../types.js'

export default command(
  'start',
  'Begins a new session',
  async function (location = 'Unknown') {
    let session: OmitUnderscored<Session> = {
      Start: new Date().toISOString(),
      Location: location,
      Address: '',
    }
    return findPlaces(location, {
      googlePlacesKey: this.config.google!.placesKey!,
      location: this.config.location!.coords,
      radius: this.config.location!.radius,
    })
      .catch((error) => {
        this.output(error)
        return null
      })
      .then((places) => {
        if (places && places[0]) {
          session = placeToSession(places[0], session)
        }
        return this.backend.create('Sessions', session)
      })
      .then((res) => {
        this.output([['Started new session', res]])
        return commands.timer.fn.call(
          this,
          '2h',
          `${f.discordTag('@everyone')} End of regular session`,
        )
      })
  },
)
