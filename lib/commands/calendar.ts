import { command, clamp, toInt } from '../command.js'
import * as f from '../format.js'
import { fetchCalendarEvents } from '../google/calendar.js'

export default command(
  'calendar',
  'Displays calendar events from Google Calendar',
  async function (future = '364', past = '0') {
    const { google } = this.config
    if (!google || !google.calendarId) {
      throw new Error('Requires `config.google.{ calendarId, token }`')
    }
    const token = await this.config.googleAuthToken!()
    const pastInt = clamp(toInt(past, -1), -364, 364)
    const futureInt = clamp(toInt(future, 364), pastInt, 728)
    const timeMin = new Date()
    const timeMax = new Date()
    timeMin.setDate(timeMin.getDate() - pastInt)
    timeMin.setHours(0, 0, 0, 0)
    timeMax.setDate(timeMax.getDate() + futureInt)
    timeMax.setHours(0, 0, 0, 0)
    const events = await fetchCalendarEvents({
      calendarId: google.calendarId,
      token,
      timeMin,
      timeMax,
    })
    return [
      `Showing Google Calendar events from ${f.date(timeMin)} to ${f.date(timeMax)}`,
      f.list(events),
    ]
  },
)
