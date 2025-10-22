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
  tableNames: readonly string[]
  tableName(str: string): string
  parseRecord(record: any): any
  table(name: string, args?: any, useCache?: boolean): Promise<any>
  tables(...names: any[]): Promise<any[]>
  session(index?: string | number): Promise<any>
  member(query: string | User): Promise<any>
  create(table: string, data: any): Promise<any>
  updateRecord(record: any): Promise<any>
  update(table: string, id: string, data: any): Promise<any>
  deleteRecord(record: any): Promise<any>
  delete(table: string, id: string): Promise<any>
  isAdmin(member: any): boolean
  time(str: string | Date, seconds?: boolean): string
  date(str: string | Date): string
  placeToSession(place: any, session: any): any
}

export interface User {
  id: string
  name: string
  displayName?: string
}
