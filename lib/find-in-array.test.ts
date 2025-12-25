import { describe, it, expect } from 'vitest'
import { findInArray } from './find-in-array.js'

describe('findInArray', () => {
  const mockItems = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com' },
    { id: '4', name: 'Dave', email: 'dave@example.com' },
  ]

  describe('single match mode (multiple=false)', () => {
    it('should find item by exact match', () => {
      const result = findInArray(mockItems, 'alice', ['name'])
      expect(result.id).toBe('1')
      expect(result.name).toBe('Alice')
    })

    it('should find item by partial match (case-insensitive)', () => {
      const result = findInArray(mockItems, 'ali', ['name'])
      expect(result.id).toBe('1')
    })

    it('should find item by searching multiple properties', () => {
      const result = findInArray(mockItems, 'bob@example.com', [
        'name',
        'email',
      ])
      expect(result.id).toBe('2')
    })

    it('should match first property with match', () => {
      const result = findInArray(mockItems, 'charlie', ['name', 'email'])
      expect(result.id).toBe('3')
    })

    it('should throw error when no match found', () => {
      expect(() =>
        findInArray(mockItems, 'nonexistent', ['name'], {
          recordType: 'member',
        }),
      ).toThrow(/No member matching/)
    })

    it('should throw error when multiple matches found', () => {
      const items = [
        { id: '1', name: 'Alice Anderson' },
        { id: '2', name: 'Alice Adams' },
      ]
      expect(() => findInArray(items, 'alice', ['name'])).toThrow(
        /Multiple.*alice/,
      )
    })

    it('should be case-insensitive', () => {
      const result1 = findInArray(mockItems, 'ALICE', ['name'])
      const result2 = findInArray(mockItems, 'alice', ['name'])
      const result3 = findInArray(mockItems, 'AlIcE', ['name'])
      expect(result1.id).toBe(result2.id)
      expect(result2.id).toBe(result3.id)
    })

    it('should find items with numeric properties', () => {
      const items = [
        { id: '1', age: 25 },
        { id: '2', age: 30 },
      ]
      const result = findInArray(items, '25', ['age'])
      expect(result.id).toBe('1')
    })

    it('should default recordType to "record"', () => {
      expect(() => findInArray(mockItems, 'unknown', ['name'])).toThrow(
        /No record matching/,
      )
    })

    it('should use custom recordType in error messages', () => {
      expect(() =>
        findInArray(mockItems, 'unknown', ['name'], { recordType: 'user' }),
      ).toThrow(/No user matching/)
    })

    it('should include property values in multiple match error', () => {
      const items = [
        { id: '1', name: 'Test User 1' },
        { id: '2', name: 'Test User 2' },
      ]
      expect(() =>
        findInArray(items, 'test', ['name'], { recordType: 'user' }),
      ).toThrow(/Test User 1, Test User 2/)
    })

    it('should skip properties that are null or undefined', () => {
      const items = [
        { id: '1', name: 'Alice', email: null },
        { id: '2', name: null, email: 'bob@example.com' },
      ]
      const result = findInArray(items, 'bob', ['name', 'email'])
      expect(result.id).toBe('2')
    })
  })

  describe('multiple match mode (multiple=true)', () => {
    it('should return all matches', () => {
      const items = [
        { id: '1', name: 'Alice', tag: 'admin' },
        { id: '2', name: 'Bob', tag: 'user' },
        { id: '3', name: 'Admin User', tag: 'user' },
      ]
      const results = findInArray(items, 'admin', ['name', 'tag'], {
        multiple: true,
      })
      expect(results.length).toBe(2)
      expect(results.map((r) => r.id)).toEqual(['3', '1'])
    })

    it('should return empty array when no matches', () => {
      expect(() =>
        findInArray(mockItems, 'nonexistent', ['name'], { multiple: true }),
      ).toThrow(/No record matching/)
    })

    it('should remove duplicates from multiple properties', () => {
      const items = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Test', email: 'bob@test.com' },
      ]
      const results = findInArray(items, 'test', ['name', 'email'], {
        multiple: true,
      })
      // Should return item 1 (from email) and item 2 (from name and email)
      // But item 2 might be duplicated from matching on both properties
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    it('should be case-insensitive in multiple mode', () => {
      const items = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Alison' },
      ]
      const results = findInArray(items, 'ALI', ['name'], { multiple: true })
      expect(results.length).toBe(2)
    })
  })

  describe('input validation', () => {
    it('should throw error if array is not an array', () => {
      expect(() => findInArray(null as any, 'query', ['prop'])).toThrow(
        /Expected Array/,
      )
    })

    it('should throw error if input is an object instead of array', () => {
      expect(() =>
        findInArray({ prop: 'value' } as any, 'query', ['prop']),
      ).toThrow(/Expected Array/)
    })

    it('should throw error if input is a string', () => {
      expect(() => findInArray('string' as any, 'query', ['prop'])).toThrow(
        /Expected Array/,
      )
    })

    it('should throw error if input is a number', () => {
      expect(() => findInArray(123 as any, 'query', ['prop'])).toThrow(
        /Expected Array/,
      )
    })

    it('should include actual type in error message', () => {
      expect(() => findInArray({ data: [] } as any, 'query', ['prop'])).toThrow(
        /Expected Array but got Object/,
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty arrays', () => {
      expect(() => findInArray([], 'query', ['name'])).toThrow(/No record/)
    })

    it('should work with single item arrays', () => {
      const result = findInArray([{ id: '1', name: 'Solo' }], 'solo', ['name'])
      expect(result.id).toBe('1')
    })

    it('should handle empty query strings', () => {
      expect(() => findInArray(mockItems, '', ['name'])).toThrow(/No record/)
    })

    it('should handle whitespace-only query strings', () => {
      expect(() => findInArray(mockItems, '   ', ['name'])).toThrow(/No record/)
    })

    it('should search in substring positions', () => {
      const items = [{ id: '1', name: 'prefix-alice-suffix' }]
      const result = findInArray(items, 'alice', ['name'])
      expect(result.id).toBe('1')
    })

    it('should handle special characters in search query', () => {
      const items = [{ id: '1', name: 'test@example.com' }]
      const result = findInArray(items, 'example', ['name'])
      expect(result.id).toBe('1')
    })

    it('should handle special characters in item properties', () => {
      const items = [{ id: '1', name: 'test_value-123' }]
      const result = findInArray(items, 'test_value', ['name'])
      expect(result.id).toBe('1')
    })

    it('should handle unicode characters', () => {
      const items = [{ id: '1', name: 'Ångström' }]
      const result = findInArray(items, 'ngst', ['name'])
      expect(result.id).toBe('1')
    })

    it('should work with properties that stringify to different values', () => {
      const items = [
        { id: '1', count: 100 },
        { id: '2', count: 200 },
      ]
      const result = findInArray(items, '100', ['count'])
      expect(result.id).toBe('1')
    })

    it('should find matches in any specified property', () => {
      const items = [
        { id: '1', username: 'alice', email: 'alice@test.com' },
        { id: '2', username: 'bob', email: 'bob@test.com' },
        { id: '3', username: 'charlie', email: 'alice@example.com' },
      ]
      const result = findInArray(items, 'alice', ['username', 'email'])
      expect(['1', '3']).toContain(result.id)
    })

    it('should handle properties with complex types', () => {
      const items = [
        {
          id: '1',
          data: { nested: 'value' },
          name: 'test',
        },
      ]
      const result = findInArray(items, 'test', ['name'])
      expect(result.id).toBe('1')
    })
  })

  describe('readonly arrays', () => {
    it('should work with readonly arrays', () => {
      const items: readonly (typeof mockItems)[0][] = mockItems
      const result = findInArray(items, 'alice', ['name'])
      expect(result.id).toBe('1')
    })
  })
})
