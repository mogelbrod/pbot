import type { GoogleEvent } from './google/calendar'

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

export interface Backend {
  tableNames: readonly TableName[]
  parseRecord<Entity = TableEntityUnion>(record: any): Entity | null
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
  tables<T extends TableName[]>(
    cache: boolean,
    ...names: T
  ): Promise<{ [K in keyof T]: EntityForTable<T[K] & TableName>[] }>
  session(index?: string | number): Promise<Session>
  member(query: string | User | undefined): Promise<Member>
  create(table: TableName, data: Record<string, any>): Promise<any>
  updateRecord(record: TableEntityUnion): Promise<any>
  update(table: TableName, id: string, data: Record<string, any>): Promise<any>
  deleteRecord(record: TableEntityUnion): Promise<any>
  delete(table: TableName, id: string): Promise<any>
  time(str: string | Date, seconds?: boolean): string
  date(str: string | Date): string
  placeToSession(place: any, session: any): any
}

export interface User {
  id: string
  name: string
  displayName?: string
}

export type Output = string | number | Member | EntityUnion | Array<Output>

export interface Entity {
  _type: string
}

export interface TableEntity extends Entity {
  _id: string
  _created: Date
}

export type TableEntityUnion = Drink | Member | Session | Feedback | Quote

export type EntityUnion =
  | TableEntityUnion
  | DiscordTag
  | GooglePlace
  | GoogleEvent
  | RawResult
  | ListResult

export type EntityType = EntityUnion['_type']

export const TABLES = [
  'Members',
  'Sessions',
  'Drinks',
  'Feedback',
  'Quotes',
] as const satisfies EntityType[]
export type TableName = (typeof TABLES)[number]

export type EntityForTable<TableName extends EntityType> = Extract<
  EntityUnion,
  { _type: TableName }
>

export interface DiscordTag extends Entity {
  _type: 'DiscordTag'
  value: string
}

export interface RawResult extends Entity {
  _type: 'RawResult'
  raw: unknown
}

export interface ListResult extends Entity {
  _type: 'ListResult'
  items: Output[]
}

/**
 * Backend implementation specific enum value.
 * Use `enumValue(value)` to resolve to the string value.
 */
export type NestedEnum =
  | string
  | { _type?: TableName; _id?: string; value: string }

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

export interface Session extends TableEntity {
  _type: 'Sessions'
  Start: string
  Location: string
  Address: string
  GooglePlaceID?: string
  Drinks?: NestedEnum[]
}

export interface Feedback extends TableEntity {
  _type: 'Feedback'
  Author: Member[]
  Feedback: string
  Time: string
}

export interface Quote extends TableEntity {
  _type: 'Quotes'
  Author: Member[]
  Quote: string
  Time: string
}

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
}
