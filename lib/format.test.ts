import { describe, it, expect } from 'vitest'
import * as f from './format.js'

describe('format', () => {
  describe('wrap()', () => {
    it('should require delimeter to be a string', () => {
      expect(() => f.wrap(undefined as any, 'a')).toThrow(TypeError)
      expect(() => f.wrap(null as any, 'b')).toThrow(TypeError)
    })

    it('should allow empty string delimeters', () => {
      expect(f.wrap('', 'hello')).toBe('hello')
    })

    it('should wrap single characters', () => {
      expect(f.wrap('*', 'hello')).toBe('*hello*')
    })

    it('should escape delimeters within the string', () => {
      expect(f.wrap('*', 'he*llo')).toBe('*he\\*llo*')
    })

    it('should handle multiple arguments', () => {
      expect(f.wrap('`', 'abra', 'kad``abra', 'allakhazam')).toBe(
        '`abra kad\\`\\`abra allakhazam`',
      )
    })
  })
})
