import { describe, it, expect } from 'vitest'
import * as u from './utils.js'

describe('utils', () => {
  describe('addType()', () => {
    it('should add _type to single object', () => {
      const obj: any = { name: 'test' }
      const result = u.addType(obj, 'Members') as any
      expect(result._type).toBe('Members')
      expect(result.name).toBe('test')
    })

    it('should add _type to array of objects', () => {
      const arr: any[] = [{ name: 'a' }, { name: 'b' }]
      const result = u.addType(arr, 'Drinks') as any[]
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]._type).toBe('Drinks')
      expect(result[1]._type).toBe('Drinks')
    })

    it('should mutate the original object', () => {
      const obj: any = { id: '1' }
      const result = u.addType(obj, 'Sessions') as any
      expect(obj._type).toBe('Sessions')
      expect(result === obj).toBe(true)
    })

    it('should handle empty arrays', () => {
      const arr: any[] = []
      const result = u.addType(arr, 'Members')
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('should handle nested arrays', () => {
      const arr = [{ id: '1' }, { id: '2' }, { id: '3' }]
      const result = u.addType(arr, 'Drinks')
      result.forEach((item) => {
        expect(item._type).toBe('Drinks')
      })
    })

    it('should handle null/undefined gracefully', () => {
      const nullResult = u.addType(null as any, 'Members')
      const undefResult = u.addType(undefined as any, 'Members')
      expect(nullResult).toBe(null)
      expect(undefResult).toBe(undefined)
    })
  })

  describe('filter()', () => {
    it('should filter object properties by predicate', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = u.filter(obj, (key) => key !== 'b')
      expect(result).toEqual({ a: 1, c: 3 })
      expect(result.b).toBeUndefined()
    })

    it('should filter by value', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = u.filter(obj, (_, value) => value > 1)
      expect(result).toEqual({ b: 2, c: 3 })
    })

    it('should handle empty objects', () => {
      const obj = {}
      const result = u.filter(obj, () => true)
      expect(result).toEqual({})
    })

    it('should return empty object if all filtered', () => {
      const obj = { a: 1, b: 2 }
      const result = u.filter(obj, () => false)
      expect(result).toEqual({})
    })

    it('should receive both key and value in predicate', () => {
      const obj = { name: 'john', age: 30 }
      const calls: [string, any][] = []
      u.filter(obj, (key, value) => {
        calls.push([key, value])
        return true
      })
      expect(calls).toEqual([
        ['name', 'john'],
        ['age', 30],
      ])
    })

    it('should not mutate original object', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const original = { ...obj }
      u.filter(obj, () => true)
      expect(obj).toEqual(original)
    })
  })

  describe('isPresent()', () => {
    it('should filter out null values', () => {
      const arr = ['a', 'b', null, 'c']
      const result = arr.filter(u.isPresent)
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should filter out undefined values', () => {
      const arr = ['a', undefined, 'b', undefined]
      const result = arr.filter(u.isPresent)
      expect(result).toEqual(['a', 'b'])
    })

    it('should filter out empty strings', () => {
      const arr = ['a', '', 'b', '', 'c']
      const result = arr.filter(u.isPresent)
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should keep 0 and false', () => {
      const arr = [0, false, 'text', null, undefined]
      const result = arr.filter(u.isPresent)
      expect(result).toEqual([0, false, 'text'])
    })

    it('should work with mixed types', () => {
      const arr: any[] = [
        'string',
        123,
        true,
        null,
        undefined,
        '',
        false,
        0,
        [],
        {},
      ]
      const result = arr.filter(u.isPresent)
      expect(result).toEqual(['string', 123, true, false, 0, [], {}])
    })
  })

  describe('omitUnderscored()', () => {
    it('should remove properties starting with underscore', () => {
      const obj = { name: 'john', _id: '123', age: 30, _hidden: 'secret' }
      const result = u.omitUnderscored(obj)
      expect(result).toEqual({ name: 'john', age: 30 })
    })

    it('should preserve public properties', () => {
      const obj = { public1: 'a', public2: 'b', _private: 'c' }
      const result = u.omitUnderscored(obj)
      expect(result).toEqual({ public1: 'a', public2: 'b' })
    })

    it('should handle empty objects', () => {
      const obj = {}
      const result = u.omitUnderscored(obj)
      expect(result).toEqual({})
    })

    it('should handle objects with only underscored properties', () => {
      const obj = { _a: 1, _b: 2, _c: 3 }
      const result = u.omitUnderscored(obj)
      expect(result).toEqual({})
    })

    it('should not mutate original object', () => {
      const obj = { name: 'test', _internal: 'value' }
      const original = { ...obj }
      u.omitUnderscored(obj)
      expect(obj).toEqual(original)
    })

    it('should handle multiple underscores', () => {
      const obj = { __double: 'private', _single: 'private', public: 'value' }
      const result = u.omitUnderscored(obj)
      expect(result).toEqual({ public: 'value' })
    })
  })

  describe('parseDuration()', () => {
    const YEAR = 24 * 60 * 60 * 1000

    it('should parse date range (YYYY-MM-DD..YYYY-MM-DD)', () => {
      const result = u.parseDuration('2023-01-01..2023-12-31')
      expect(result.start.getDate()).toBe(1)
      expect(result.start.getMonth()).toBe(0)
      expect(result.start.getFullYear()).toBe(2023)
      expect(result.end.getDate()).toBe(31)
      expect(result.end.getMonth()).toBe(11)
      expect(result.end.getFullYear()).toBe(2023)
      expect(new Date('2023-12-31T23:59:59').getTime()).toBeLessThan(
        result.end.getTime(),
      )
    })

    it('should parse exclusive date range (YYYY-MM-DD...YYYY-MM-DD)', () => {
      const result = u.parseDuration('2023-01-01...2023-12-31')
      expect(result.start.getDate()).toBe(1)
      expect(result.start.getMonth()).toBe(0)
      expect(result.start.getFullYear()).toBe(2023)
      expect(result.end.getDate()).toBe(30)
      expect(result.end.getMonth()).toBe(11)
      expect(result.end.getFullYear()).toBe(2023)
      expect(new Date('2023-12-31T23:59:59').getTime()).toBeGreaterThan(
        result.end.getTime(),
      )
      expect(new Date('2023-12-31T00:01:00').getTime()).toBeGreaterThan(
        result.end.getTime(),
      )
    })

    it('should parse ms duration format', () => {
      const result = u.parseDuration('7d')
      const now = Date.now()
      const dayInMs = YEAR
      expect(result.end.getTime()).toBeLessThanOrEqual(now)
      expect(result.start.getTime()).toBeLessThan(result.end.getTime())
      expect(result.end.getTime() - result.start.getTime()).toBeGreaterThan(
        7 * dayInMs - 1000,
      )
    })

    it('should default to last 365 days when spec is empty', () => {
      const result = u.parseDuration('')
      const dayInMs = YEAR
      expect(result.end.getTime() - result.start.getTime()).toBeGreaterThan(
        365 * dayInMs - 1000,
      )
    })

    it('should default to last 365 days when spec is undefined', () => {
      const result = u.parseDuration(undefined)
      const dayInMs = YEAR
      expect(result.end.getTime() - result.start.getTime()).toBeGreaterThan(
        365 * dayInMs - 1000,
      )
    })

    it('should default to last 365 days for invalid format', () => {
      const result = u.parseDuration('invalid-format')
      const dayInMs = YEAR
      expect(result.end.getTime() - result.start.getTime()).toBeGreaterThan(
        365 * dayInMs - 1000,
      )
    })

    it('should trim whitespace from spec', () => {
      const result = u.parseDuration('  7d  ')
      expect(result.start.getTime()).toBeLessThan(result.end.getTime())
    })

    it('should have end date greater than start date', () => {
      const specs = ['7d', '30d', '2023-01-01..2023-12-31']
      specs.forEach((spec) => {
        const result = u.parseDuration(spec)
        expect(result.end.getTime()).toBeGreaterThan(result.start.getTime())
      })
    })
  })
})
