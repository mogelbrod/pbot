export interface Config {
  backend?: 'baserow' | 'airtable'
  baserow?: {
    /** Baserow databse token */
    token: string
    /** Baserow host */
    url: string
    /** Database ID */
    databaseId: number
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
  }

  /** Logger */
  log?(...args: any[]): void
}

export interface Backend {
  // config: any
  // data: Record<string, any>
  // inflight: Record<string, Promise<any>>
  tableNames: readonly TableName[]
  tableName(str: string): TableName
  parseRecord(record: any): any
  table<E extends TableName>(
    name: E,
    args?: {
      fields?: Array<string>
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
  create(table: TableName, data: any): Promise<any>
  updateRecord(record: any): Promise<any>
  update(table: TableName, id: string, data: any): Promise<any>
  deleteRecord(record: any): Promise<any>
  delete(table: TableName, id: string): Promise<any>
  isAdmin(member: Member): boolean
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

export type EntityUnion =
  | DiscordTag
  | Drink
  | Feedback
  | GooglePlace
  | Member
  | Quote
  | RawResult
  | Session

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

export interface Drink extends TableEntity {
  _type: 'Drinks'
  Id: number
  Time: string // TODO: Date
  Type: string
  Volume: number
  'Aggregated Volume'?: string
  Sessions: string[]
  Members: string[]
}

export interface Member extends TableEntity {
  _type: 'Members'
  Email: string
  SlackID?: string
  DiscordID?: string
  Name: string
  Joined: string // TODO: Date
  Role: string
  Feedbacks?: any[]
  Quotes: string[]
  Drinks: string[]
}

export interface Session extends TableEntity {
  _type: 'Sessions'
  Start: string // TODO: Date
  Location: string
  Address: string
  GooglePlaceID?: string
  Drinks?: string[]
}

export interface Feedback extends TableEntity {
  _type: 'Feedback'
  Author: Member
  Feedback: string
}

export interface Quote extends TableEntity {
  _type: 'Quotes'
  Author: Member
  Quote: string
}

export interface GooglePlace extends Entity {
  _type: 'GooglePlace'
  place_id: string
  name: string
  formatted_address?: string
  vicinity?: string
  rating?: number
  price_level?: number
  Session?: Session
}
