import {
  TABLES,
  type EntityType,
  type GooglePlace,
  type Member,
  type NestedEnum,
  type TableName,
} from './types'

export const RELOADED_TABLES = [
  'Members',
  'Sessions',
] as const satisfies EntityType[]

export const LIST_ARGS = {
  Members: {
    sort: [{ field: 'Name' }],
    fields: 'Email DiscordID SlackID Name Joined Role'.split(' '),
    exclude: 'Drinks Sessions Feedback Quotes'.split(' '),
  },
  Sessions: {
    sort: [{ field: 'Start' }],
    fields: 'Start Location Address GooglePlaceID'.split(' '),
    exclude: 'Members Drinks'.split(' '),
  },
  Drinks: { sort: [{ field: 'Time' }] },
} as const

export function tableName(str: string): TableName {
  return str.replace(/^(.)(.+?)s?$/, (_, c, rest) => {
    let name = c.toUpperCase() + rest.toLowerCase()
    if (TABLES.indexOf(name) < 0) {
      name += 's'
    }
    return name
  }) as TableName
}

export function isAdmin(member: Member): boolean {
  return (
    member &&
    ['President', 'Accountant', 'Board Member', 'SupPleb'].indexOf(
      enumValue(member.Role),
    ) >= 0
  )
}

export function placeToSession<
  S extends { GooglePlaceID?: string; Address?: string },
>(place: GooglePlace | null | undefined, session: S): S {
  if (place) {
    session.GooglePlaceID = place.place_id
    session.Address = place.formatted_address!
  }
  return session
}

export function enumValue(nested: NestedEnum, returnId = false): string {
  return typeof nested === 'string'
    ? nested
    : returnId
      ? nested._id!
      : nested.value
}
