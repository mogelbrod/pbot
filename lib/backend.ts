import {
  TABLES,
  type EntityType,
  type GooglePlace,
  type Member,
  type NestedEnum,
  type TableName,
} from './types'

/** Default tables to reload when refreshing cache without explicit selection. */
export const RELOADED_TABLES = [
  'Members',
  'Sessions',
] as const satisfies EntityType[]

/**
 * Default list/select arguments for known tables across backends.
 * Backends may use these as sensible defaults for field inclusion/exclusion and sorting.
 */
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

/** Lower-cased aliases for {@link TABLES} used by {@link tableName}. */
const TABLE_ALIASES = TABLES.reduce(
  (obj, name) => {
    const lower = name.toLowerCase()
    obj[lower] = name
    obj[lower + 's'] = name
    obj[lower.replace(/s$/, '')] = name
    return obj
  },
  // Pre-defined aliases
  {
    types: 'DrinkTypes',
    users: 'Members',
  } as Record<string, TableName>,
)

/**
 * Normalize a string to a valid `TableName`.
 * @param str - Arbitrary table name candidate
 * @returns Normalized `TableName`
 */
export function tableName(str: string): TableName {
  const name = TABLE_ALIASES[str.toLowerCase()]
  if (!name) {
    throw new Error(`Unknown table name: ${str}`)
  }
  return name
}

/**
 * Determine whether a member has an administrative role.
 * @param member - Member entity
 * @returns `true` if role is one of admin-like values
 */
export function isAdmin(member: Member): boolean {
  return (
    member &&
    ['President', 'Accountant', 'Board Member', 'SupPleb'].indexOf(
      enumValue(member.Role),
    ) >= 0
  )
}

/**
 * Copy relevant fields from a `GooglePlace` into a session-like object.
 * @param place - Place result (may be null/undefined)
 * @param session - Mutable session shape to enrich
 * @returns The same `session` reference for chaining
 */
export function placeToSession<
  S extends { GooglePlaceID?: string; Address?: string },
>(place: GooglePlace | null | undefined, session: S): S {
  if (place) {
    session.GooglePlaceID = place.place_id
    session.Address = place.formatted_address!
  }
  return session
}

/**
 * Resolve a backend-specific enum representation to its string value or id.
 * @param nested - Enum value (string or `{ value, _id }` object)
 * @param returnId - When `true`, returns `_id` if present
 */
export function enumValue(nested: NestedEnum, returnId = false): string {
  return typeof nested === 'string'
    ? nested
    : returnId
      ? nested._id!
      : nested.value
}
