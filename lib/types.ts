export interface Config {
  /** Airtable key */
  key?: string
  /** Airtable base */
  base?: string
  /** Discord access token */
  discordToken?: string
  /** Discord default channel ID */
  disrcordDefaultChannel?: string
  /** Google Places private key */
  googlePlacesKey?: string

  /** Logger */
  log?(...args: any[]): void
}

export interface Backend {
  // config: any
  // data: Record<string, any>
  // inflight: Record<string, Promise<any>>
  tableNames: readonly EntityType[]
  tableName(str: string): EntityType
  parseRecord(record: any): any
  table<E extends EntityType>(
    name: E,
    args?: {
      fields?: Array<string>
      sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>
      filterByFormula?: string
      maxRecords?: number
    },
    useCache?: boolean,
  ): Promise<EntityForTable<E>[]>
  tables<T extends EntityType[]>(
    cache: boolean,
    ...names: T
  ): Promise<{ [K in keyof T]: EntityForTable<T[K] & EntityType>[] }>
  session(index?: string | number): Promise<Session>
  member(query: string | User): Promise<Member>
  create(table: string, data: any): Promise<any>
  updateRecord(record: any): Promise<any>
  update(table: string, id: string, data: any): Promise<any>
  deleteRecord(record: any): Promise<any>
  delete(table: string, id: string): Promise<any>
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
  _id?: string
  _created?: Date
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

export interface Drink extends Entity {
  _type: 'Drinks'
  Id: number
  Time: string // TODO: Date
  Type: string
  Volume: number
  'Aggregated Volume'?: string
  Sessions?: any[] // TODO:
  Members?: any[] // TODO:
}

export interface Member extends Entity {
  _type: 'Members'
  Email: string
  SlackID?: string
  DiscordID?: string
  Name: string
  Joined: string // TODO: Date
  Role: string
  Feedbacks?: any[] // TODO:
  Quotes?: any[] // TODO:
  Drinks?: any[] // TODO:
}

export interface Session extends Entity {
  _type: 'Sessions'
  Start: string // TODO: Date
  Location: string
  Address: string
  GooglePlaceID?: string
  Drinks?: any[] // TODO:
}

export interface Feedback extends Entity {
  _type: 'Feedback'
  Author: Member
  Feedback: string
}

export interface Quote extends Entity {
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
