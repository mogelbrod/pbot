import type { GoogleEvent } from './google/calendar'
import type { VkoEntry } from './vko'

/** Generic object map with string keys. */
export type Obj = Record<string, any>

/**
 * Runtime configuration for PBot.
 * Provides backend selection, credentials, Discord settings and Google integrations.
 */
export interface Config {
  backend?: 'baserow' | 'airtable'
  baserow?: {
    /** Baserow databse token */
    token: string
    /** Baserow host */
    url: string
  }
  airtable?: {
    /** Airtable key */
    token: string
    /** Airtable base */
    base: string
  }
  discord?: {
    /** Discord access token */
    token: string
    /** Discord default channel ID */
    defaultChannel: string
  }
  location?: {
    /** Default coordinates for location-based searches (lat,long) */
    coords: string
    /** Default search radius in meters */
    radius: number
  }
  google?: {
    /** Google Places private key */
    placesKey?: string
    /** Google Calendar ID (looks like an email) */
    calendarId?: string
    serviceAccount?: {
      type: string
      project_id: string
      private_key_id: string
      private_key: string
      client_email: string
      client_id: string
      auth_uri: string
      token_uri: string
      auth_provider_x509_cert_url: string
      client_x509_cert_url: string
      universe_domain: string
    }
  }

  /** Method to get valid Google Authorization token using above `google.serviceAccount` */
  googleAuthToken?: () => Promise<string>

  /** Logger */
  log?(...args: any[]): void
}

/**
 * Abstraction for data backends.
 * Implementations should fulfill table CRUD, lookups and formatting helpers.
 */
export interface Backend {
  /** Converts a raw backend record into the appropriate entity */
  parseRecord<Entity = TableEntityUnion>(record: any): Entity | null
  /** Returns entries for a single table, according to the `args` provided (if any) */
  table<E extends TableName>(
    name: E,
    args?: {
      fields?: Array<string>
      exclude?: Array<string>
      sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>
      filterByFormula?: string
      maxRecords?: number
    } | null,
    useCache?: boolean,
  ): Promise<EntityForTable<E>[]>
  /** Returns all entries for the specified tables */
  tables<T extends TableName[]>(
    cache: boolean,
    ...names: T
  ): Promise<{ [K in keyof T]: EntityForTable<T[K] & TableName>[] }>
  /** Returns a PB session entry by index. Negative integers provide reverse order access. */
  session(index?: string | number): Promise<Session>
  /** Returns a PB member entry by discord ID, {@link User}, or searching id/name/email for the given query. */
  member(query: string | User | undefined): Promise<Member>
  /** Create a new entry in the specified table */
  create(table: TableName, data: Record<string, any>): Promise<any>
  /** Update an existing entry in the specified table */
  update(table: TableName, id: string, data: Record<string, any>): Promise<any>
  /** Delete an existing entry from the specified table */
  delete(table: TableName, id: string): Promise<any>
  /** Update a fully qualified record */
  updateRecord(record: TableEntityUnion): Promise<any>
  /** Delete a fully qualified record */
  deleteRecord(record: TableEntityUnion): Promise<any>
  /** Converts a timestamp to the time format expected by the backend implementation */
  time(str: string | Date, seconds?: boolean): string
  /** Converts a timestamp to the date format expected by the backend implementation */
  date(str: string | Date): string
  /** Converts a place object to a session object */
  placeToSession(place: any, session: any): Session
}

/** Minimal user representation bound to Discord context. */
export interface User {
  id: string
  name: string
  displayName?: string
}

/** The supported output shape returned by commands and bot handlers. */
export type Output =
  | string
  | number
  | boolean
  | Date
  | Member
  | EntityUnion
  | Array<Output>

/** Base entity carrying a discriminant `_type`. */
export interface Entity {
  _type: string
}

/** Base table-backed entity with unique ID and creation date. */
export interface TableEntity extends Entity {
  _id: string
  _created: Date
}

/** Union of all table-backed entities. */
export type TableEntityUnion =
  | Drink
  | DrinkType
  | Member
  | Session
  | Feedback
  | Quote

/** Union of all entities that can be formatted/rendered by the bot. */
export type EntityUnion =
  | TableEntityUnion
  | DiscordTag
  | GooglePlace
  | GoogleEvent
  | VkoEntry
  | RawResult
  | ListResult

/** Discriminant type string for any entity. */
export type EntityType = EntityUnion['_type']

/** Supported table names for the backends */
export const TABLES = [
  'Members',
  'Sessions',
  'Drinks',
  'DrinkTypes',
  'Feedback',
  'Quotes',
] as const satisfies EntityType[]

/** Union of valid table names. */
export type TableName = (typeof TABLES)[number]

/**
 * Extract a specific entity variant from `EntityUnion` by `_type`.
 * @template TableName - Target entity `_type`
 */
export type EntityForTable<TableName extends EntityType> = Extract<
  EntityUnion,
  { _type: TableName }
>

/** Lightweight entity to carry raw Discord tag decorations. */
export interface DiscordTag extends Entity {
  _type: 'DiscordTag'
  value: string
}

/** Wrapper to force formatting of an arbitrary value without entity semantics. */
export interface RawResult extends Entity {
  _type: 'RawResult'
  raw: unknown
}

/** Entity representing a rendered list of outputs. */
export interface ListResult extends Entity {
  _type: 'ListResult'
  items: Output[]
  numbered?: boolean
}

/**
 * Backend implementation specific enum value.
 * Use `enumValue(value)` to resolve to the string value.
 */
export type NestedEnum =
  | string
  | { _type?: TableName; _id?: string; value: string }

/** Drink record with volume aggregation and member/session links. */
export interface Drink extends TableEntity {
  _type: 'Drinks'
  Id: number
  Time: string
  Type: string
  Volume: number
  'Aggregated Volume'?: string
  Sessions: NestedEnum[]
  Members: NestedEnum[]
}

/** Drink type record. */
export interface DrinkType extends TableEntity {
  _type: 'DrinkTypes'
  Name: string
  Emoji: string
  Multiplier: number
}

/** Member record with identifiers and relational links. */
export interface Member extends TableEntity {
  _type: 'Members'
  Email: string
  SlackID?: string
  DiscordID?: string
  Name: string
  Joined: string
  Role: NestedEnum
  Feedbacks?: NestedEnum[]
  Quotes: NestedEnum[]
  Drinks: NestedEnum[]
}

/** Session record describing a PB meeting/date/time and place. */
export interface Session extends TableEntity {
  _type: 'Sessions'
  Start: string
  Location: string
  Address: string
  GooglePlaceID?: string
  Drinks?: NestedEnum[]
}

/** Feedback record authored by members. */
export interface Feedback extends TableEntity {
  _type: 'Feedback'
  Author: Member[]
  Feedback: string
  Time: string
}

/** Quote record authored by members. */
export interface Quote extends TableEntity {
  _type: 'Quotes'
  Author: Member[]
  Quote: string
  Time: string
}

/**
 * Google Places result entity.
 * @remarks Some fields are optional depending on the endpoint used.
 */
export interface GooglePlace extends Entity {
  _type: 'GooglePlace'
  place_id: string
  name: string
  formatted_address?: string
  vicinity?: string
  rating?: number
  price_level?: number
  geometry?: {
    location?: {
      lat: number
      lng: number
    }
  }
  Session?: Session
  /** Manually injected via `getClosestVkoEntry()` */
  VkoEntry?: VkoEntry
}
