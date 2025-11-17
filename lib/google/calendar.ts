import fetch from 'node-fetch'
import qs from 'query-string'
import type { Entity } from '../types'
import { assertToken } from './auth'

export async function fetchCalendarEvents({
  calendarId,
  token,
  timeMin,
  timeMax,
}: {
  calendarId: string
  token: string
  timeMin: Date
  timeMax: Date
}): Promise<GoogleEvent[]> {
  assertToken(token)

  // https://developers.google.com/workspace/calendar/api/v3/reference/events/list
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?` +
      qs.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: 100,
      }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
  const data = (await response.json()) as GoogleEventsResponse
  for (const event of data.items) {
    event._type = 'GoogleEvent'
  }
  return data.items
}

export interface GoogleEventsResponse {
  items: GoogleEvent[]
  summary: string
  description: string
  updated: string
  timeZone: string
  accessRole: string
}

/** {@link https://developers.google.com/workspace/calendar/api/v3/reference/events#resource} */
export interface GoogleEvent extends Entity {
  // Added for `Entity` compatibility
  _type: 'GoogleEvent'

  kind: 'calendar#event'
  // etag: etag
  id: string
  status: string
  htmlLink: string
  created: string
  updated: string
  summary: string
  description: string
  location: string
  colorId: string
  creator: {
    id: string
    email: string
    displayName: string
    self: boolean
  }
  organizer: {
    id: string
    email: string
    displayName: string
    self: boolean
  }
  start: {
    date: string
    dateTime: string
    timeZone: string
  }
  end: {
    date: string
    dateTime: string
    timeZone: string
  }
  endTimeUnspecified: boolean
  recurrence: [string]
  recurringEventId: string
  originalStartTime: {
    date: string
    dateTime: string
    timeZone: string
  }
  transparency: string
  visibility: string
  iCalUID: string
  sequence: number
  attendees: Array<{
    id: string
    email: string
    displayName: string
    organizer: boolean
    self: boolean
    resource: boolean
    optional: boolean
    responseStatus: string
    comment: string
    additionalGuests: number
  }>
  attendeesOmitted: boolean
  extendedProperties: {
    private: {
      [key: string]: string
    }
    shared: {
      [key: string]: string
    }
  }
  hangoutLink: string
  // conferenceData: {
  //   createRequest: {
  //     requestId: string
  //     conferenceSolutionKey: {
  //       type: string
  //     }
  //     status: {
  //       statusCode: string
  //     }
  //   }
  //   entryPoints: [
  //     {
  //       entryPointType: string
  //       uri: string
  //       label: string
  //       pin: string
  //       accessCode: string
  //       meetingCode: string
  //       passcode: string
  //       password: string
  //     },
  //   ]
  //   conferenceSolution: {
  //     key: {
  //       type: string
  //     }
  //     name: string
  //     iconUri: string
  //   }
  //   conferenceId: string
  //   signature: string
  //   notes: string
  // }
  gadget: {
    type: string
    title: string
    link: string
    iconLink: string
    width: number
    height: number
    display: string
    preferences: {
      [key: string]: string
    }
  }
  anyoneCanAddSelf: boolean
  guestsCanInviteOthers: boolean
  guestsCanModify: boolean
  guestsCanSeeOtherGuests: boolean
  privateCopy: boolean
  locked: boolean
  reminders: {
    useDefault: boolean
    overrides: Array<{
      method: string
      minutes: number
    }>
  }
  source: {
    url: string
    title: string
  }
  workingLocationProperties: {
    type: string
    homeOffice: any
    customLocation: {
      label: string
    }
    officeLocation: {
      buildingId: string
      floorId: string
      floorSectionId: string
      deskId: string
      label: string
    }
  }
  outOfOfficeProperties: {
    autoDeclineMode: string
    declineMessage: string
  }
  focusTimeProperties: {
    autoDeclineMode: string
    declineMessage: string
    chatStatus: string
  }
  attachments: Array<{
    fileUrl: string
    title: string
    mimeType: string
    iconLink: string
    fileId: string
  }>
  birthdayProperties: {
    contact: string
    type: string
    customTypeName: string
  }
  eventType: string
}
