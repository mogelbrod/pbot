import { describe, it, expect, beforeEach } from 'vitest'
import * as f from './format.js'

describe('format', () => {
  beforeEach(() => {
    f.setFancy(true) // Reset to fancy mode before each test
  })

  describe('setFancy() and basic()', () => {
    it('should enable/disable fancy mode', () => {
      expect(f.basic()).toBe(false)
      f.setFancy(false)
      expect(f.basic()).toBe(true)
      f.setFancy(true)
      expect(f.basic()).toBe(false)
    })

    it('should return the set value', () => {
      expect(f.setFancy(false)).toBe(false)
      expect(f.setFancy(true)).toBe(true)
    })
  })

  describe('escape()', () => {
    it('should escape markdown in fancy mode', () => {
      f.setFancy(true)
      expect(f.escape('*bold*')).toBe('\\*bold\\*')
      expect(f.escape('_italic_')).toBe('\\_italic\\_')
      expect(f.escape('`code`')).toBe('\\`code\\`')
      expect(f.escape('**bold** and __underline__')).toBe(
        '\\*\\*bold\\*\\* and \\_\\_underline\\_\\_',
      )
      expect(f.escape('~~strikethrough~~')).toBe('\\~\\~strikethrough\\~\\~')
      expect(f.escape('||spoiler||')).toBe('\\|\\|spoiler\\|\\|')
      expect(f.escape('`code` and **bold**')).toBe(
        '\\`code\\` and \\*\\*bold\\*\\*',
      )
    })

    it('should passthrough in basic mode', () => {
      f.setFancy(false)
      expect(f.escape('*bold*')).toBe('*bold*')
      expect(f.escape('_italic_')).toBe('_italic_')
    })

    it('should handle empty strings', () => {
      f.setFancy(true)
      expect(f.escape('')).toBe('')
    })
  })

  describe('capitalize()', () => {
    it('should capitalize first letter and lowercase rest', () => {
      expect(f.capitalize('hello')).toBe('Hello')
      expect(f.capitalize('HELLO')).toBe('Hello')
      expect(f.capitalize('hELLO')).toBe('Hello')
    })

    it('should handle umlauts and non-ASCII characters', () => {
      expect(f.capitalize('über')).toBe('Über')
      expect(f.capitalize('ÅÄÖÉÈ')).toBe('Åäöéè')
      expect(f.capitalize('café')).toBe('Café')
      expect(f.capitalize('москва')).toBe('Москва')
      expect(f.capitalize('日本')).toBe('日本')
    })

    it('should handle multi-word strings', () => {
      expect(f.capitalize('hello world')).toBe('Hello world')
      expect(f.capitalize('NEW YORK CITY')).toBe('New york city')
      expect(f.capitalize('múltiple wörds')).toBe('Múltiple wörds')
    })

    it('should handle single character strings', () => {
      expect(f.capitalize('a')).toBe('A')
      expect(f.capitalize('Z')).toBe('Z')
    })

    it('should handle single non-ASCII characters', () => {
      expect(f.capitalize('ä')).toBe('Ä')
      expect(f.capitalize('é')).toBe('É')
      expect(f.capitalize('ñ')).toBe('Ñ')
      expect(f.capitalize('å')).toBe('Å')
    })

    it('should handle strings starting with numbers', () => {
      expect(f.capitalize('123abc')).toBe('123abc')
    })
  })

  describe('stringify()', () => {
    it('should pass through strings', () => {
      expect(f.stringify('hello')).toBe('hello')
      expect(f.stringify('')).toBe('')
    })

    it('should format error objects with stack or message', () => {
      const err = new Error('test error')
      const result = f.stringify(err)
      expect(result).toContain('test error')
    })

    it('should JSON.stringify objects', () => {
      expect(f.stringify({ a: 1, b: 2 })).toBe('{\n  "a": 1,\n  "b": 2\n}')
      expect(f.stringify([1, 2, 3])).toBe('[\n  1,\n  2,\n  3\n]')
    })

    it('should handle null and undefined', () => {
      expect(f.stringify(null)).toBe('null')
      expect(f.stringify(undefined)).toBe('undefined')
    })
  })

  describe('isEntity()', () => {
    it('should recognize entities with _type field', () => {
      expect(f.isEntity({ _type: 'Drinks' })).toBe(true)
      expect(f.isEntity({ _type: 'Members', Name: 'John' })).toBe(true)
    })

    it('should reject non-entities', () => {
      expect(f.isEntity(null)).toBe(false)
      expect(f.isEntity(undefined)).toBe(false)
      expect(f.isEntity('string')).toBe(false)
      expect(f.isEntity(123)).toBe(false)
      expect(f.isEntity({})).toBe(false)
      expect(f.isEntity({ Name: 'John' })).toBe(false)
    })

    it('should require _type to be a string', () => {
      expect(f.isEntity({ _type: 123 })).toBe(false)
      expect(f.isEntity({ _type: null })).toBe(false)
    })
  })

  describe('tokenize()', () => {
    it('should split by whitespace', () => {
      expect(f.tokenize('hello world')).toEqual(['hello', 'world'])
      expect(f.tokenize('  multiple   spaces  ')).toEqual([
        'multiple',
        'spaces',
      ])
    })

    it('should honor single quotes', () => {
      expect(f.tokenize("'hello world'")).toEqual(['hello world'])
      expect(f.tokenize("'a' 'b'")).toEqual(['a', 'b'])
    })

    it('should honor double quotes', () => {
      expect(f.tokenize('"hello world"')).toEqual(['hello world'])
      expect(f.tokenize('"a" "b"')).toEqual(['a', 'b'])
    })

    it('should honor smart quotes', () => {
      expect(f.tokenize('"hello world"')).toEqual(['hello world'])
      expect(f.tokenize('"hello world"')).toEqual(['hello world'])
    })

    it('should handle backslash escaping', () => {
      expect(f.tokenize('hello\\ world')).toEqual(['hello world'])
      expect(f.tokenize('a\\tb')).toEqual(['atb'])
    })

    it('should handle escaped newlines in quotes', () => {
      expect(f.tokenize('"hello\\\nworld"')).toEqual(['hello\nworld'])
    })

    it('should handle escaped characters in quotes', () => {
      expect(f.tokenize('"hello\\"world"')).toEqual(['hello"world'])
    })

    it('should handle escaped characters in single quotes', () => {
      expect(f.tokenize("'hello\\'world'")).toEqual(["hello'world"])
      expect(f.tokenize("'a\\\\b'")).toEqual(['a\\b'])
      expect(f.tokenize("'test\\\"quote'")).toEqual(['test"quote'])
    })

    it('should handle empty strings', () => {
      expect(f.tokenize('')).toEqual([])
      expect(f.tokenize('   ')).toEqual([])
    })

    it('should handle mixed quotes and escaping', () => {
      expect(f.tokenize('\'hello\' "world" escaped\\ word')).toEqual([
        'hello',
        'world',
        'escaped word',
      ])
    })
  })

  describe('toFixed()', () => {
    it('should format numbers to decimals', () => {
      expect(f.toFixed(3.14159, 2)).toBe('3.14')
      expect(f.toFixed(1, 0)).toBe('1')
      expect(f.toFixed(1.5, 1)).toBe('1.5')
    })

    it('should use default 1 decimal', () => {
      expect(f.toFixed(3.14159)).toBe('3.1')
    })

    it('should return fallback for null/undefined', () => {
      expect(f.toFixed(null, 1)).toBe('0')
      expect(f.toFixed(undefined, 1)).toBe('0')
    })

    it('should use custom fallback', () => {
      expect(f.toFixed(null, 1, 'N/A')).toBe('N/A')
      expect(f.toFixed(undefined, 2, '?')).toBe('?')
    })
  })

  describe('escapeRegExp()', () => {
    it('should escape regex special characters', () => {
      expect(f.escapeRegExp('.*+?^$')).toBe('\\.\\*\\+\\?\\^\\$')
      expect(f.escapeRegExp('(a|b)')).toBe('\\(a\\|b\\)')
      expect(f.escapeRegExp('[a-z]')).toBe('\\[a-z\\]')
    })

    it('should handle strings without special chars', () => {
      expect(f.escapeRegExp('hello')).toBe('hello')
    })

    it('should handle empty strings', () => {
      expect(f.escapeRegExp('')).toBe('')
    })
  })

  describe('luckyURL()', () => {
    it('should build Google lucky search URL', () => {
      const url = f.luckyURL('javascript')
      expect(url).toContain('www.google.com/search')
      expect(url).toContain('q=javascript')
      expect(url).toContain('btnI')
    })

    it('should encode URL parameters', () => {
      const url = f.luckyURL('hello world')
      expect(url).toContain(encodeURIComponent('hello world'))
    })
  })

  describe('placeURL()', () => {
    it('should build Google Maps URL with query', () => {
      const url = f.placeURL('Stockholm')
      expect(url).toContain('google.com/maps/search')
      expect(url).toContain('query=Stockholm')
    })

    it('should include place_id when provided', () => {
      const url = f.placeURL('Stockholm', 'ChIJ...')
      expect(url).toContain('query_place_id=ChIJ...')
    })

    it('should return null when both query and placeId are missing', () => {
      expect(f.placeURL('')).toBeNull()
      expect(f.placeURL('', null)).toBeNull()
      expect(f.placeURL('', '')).toBeNull()
    })

    it('should work with just placeId', () => {
      const url = f.placeURL('', 'ChIJ...')
      expect(url).toContain('query_place_id=ChIJ...')
    })
  })

  describe('discordTag()', () => {
    it('should return tag in fancy mode', () => {
      f.setFancy(true)
      expect(f.discordTag('<@123>')).toBe('<@123>')
    })

    it('should return empty string in basic mode', () => {
      f.setFancy(false)
      expect(f.discordTag('<@123>')).toBe('')
    })
  })

  describe('DiscordTag()', () => {
    it('should create DiscordTag entity', () => {
      const tag = f.DiscordTag('<@123>')
      expect(tag._type).toBe('DiscordTag')
      expect(tag.value).toBe('<@123>')
    })
  })

  describe('bold(), italic(), code()', () => {
    beforeEach(() => {
      f.setFancy(true)
    })

    it('should format text in bold', () => {
      expect(f.bold('hello')).toBe('**hello**')
    })

    it('should format text in italics', () => {
      expect(f.italic('hello')).toBe('*hello*')
    })

    it('should format text as code', () => {
      expect(f.code('hello')).toBe('`hello`')
    })

    it('should escape delimiters in content', () => {
      expect(f.bold('he**llo')).toBe('**he\\**llo**')
      expect(f.italic('he*llo')).toBe('*he\\*llo*')
      expect(f.code('he`llo')).toBe('`he\\`llo`')
    })

    it('should passthrough in basic mode', () => {
      f.setFancy(false)
      expect(f.bold('hello')).toBe('hello')
      expect(f.italic('hello')).toBe('hello')
      expect(f.code('hello')).toBe('hello')
    })
  })

  describe('list()', () => {
    it('should create unordered ListResult', () => {
      const result = f.list(['a', 'b', 'c'])
      expect(result._type).toBe('ListResult')
      expect(result.items).toEqual(['a', 'b', 'c'])
      expect(result.numbered).toBe(false)
    })

    it('should create numbered ListResult', () => {
      const result = f.list(['a', 'b'], true)
      expect(result.numbered).toBe(true)
    })
  })

  describe('log()', () => {
    it('should format log with timestamp and arguments', () => {
      const result = f.log('test', 'message')
      expect(result).toContain('[')
      expect(result).toContain(']')
      expect(result).toContain('test message')
    })

    it('should stringify objects in log', () => {
      const result = f.log({ a: 1 })
      expect(result).toContain('a')
    })
  })

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

    it('should passthrough in basic mode', () => {
      f.setFancy(false)
      expect(f.wrap('*', 'hello')).toBe('hello')
    })

    it('should handle numeric arguments', () => {
      expect(f.wrap('`', 'value:', 123)).toBe('`value: 123`')
    })
  })

  describe('date()', () => {
    const testDate = new Date('2023-12-25T10:30:00Z')

    it('should format date without time in basic mode', () => {
      f.setFancy(false)
      const result = f.date(testDate)
      expect(result).toMatch(/2023-12-25/)
    })

    it('should format date with time in basic mode', () => {
      f.setFancy(false)
      const result = f.date(testDate, true)
      expect(result).toMatch(/2023-12-25/)
      expect(result).toContain(':')
    })

    it('should accept string or number dates', () => {
      f.setFancy(false)
      const dateStr = '2023-12-25'
      const result1 = f.date(dateStr)
      const result2 = f.date(testDate.getTime())
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
    })

    it('should respect basicOverride parameter', () => {
      f.setFancy(true)
      const result = f.date(testDate, false, true)
      // Should format as basic regardless of fancy mode
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    })
  })

  describe('linkify()', () => {
    it('should create markdown link with fancy URL', () => {
      f.setFancy(true)
      const result = f.linkify('Click here', 'https://example.com')
      expect(result).toContain('[Click here]')
      expect(result).toContain('https://example.com')
    })

    it('should passthrough text in basic mode', () => {
      f.setFancy(false)
      const result = f.linkify('Click here', 'https://example.com')
      expect(result).toBe('Click here')
    })

    it('should use lucky URL if no URL provided', () => {
      f.setFancy(true)
      const result = f.linkify('search query')
      expect(result).toContain('search query')
      expect(result).toContain('google.com')
    })

    it('should handle null URL', () => {
      f.setFancy(true)
      const result = f.linkify('search query', null)
      expect(result).toContain('google.com')
    })
  })

  describe('fancy()', () => {
    it('should handle string values', () => {
      const result = f.fancy('hello')
      expect(result).toBe('hello')
    })

    it('should handle numbers', () => {
      const result = f.fancy(42)
      expect(result).toBe(42)
    })

    it('should handle dates', () => {
      const date = new Date('2023-12-25')
      const result = f.fancy(date)
      expect(result).toBeDefined()
    })

    it('should handle arrays', () => {
      const result = f.fancy(['a', 'b', 'c'])
      expect(result).toContain('a')
      expect(result).toContain('b')
      expect(result).toContain('c')
    })

    it('should handle RawResult entities', () => {
      const entity = { _type: 'RawResult', raw: 'raw content' } as any
      const result = f.fancy(entity)
      expect(result).toBe('`raw content`')
    })

    it('should handle ListResult entities', () => {
      const entity: any = {
        _type: 'ListResult',
        items: ['item1', 'item2'],
        numbered: false,
      }
      const result = f.fancy(entity)
      expect(result).toContain('item1')
      expect(result).toContain('item2')
    })

    it('should handle null and undefined', () => {
      expect(f.fancy(null)).toBe('`null`')
      expect(f.fancy(undefined)).toBe('`undefined`')
    })

    it('should wrap long code in code blocks in fancy mode', () => {
      f.setFancy(true)
      const result = f.fancy({
        prop: 'value'.repeat(20),
      })
      expect(result).toMatch(/^```\n{\n.+\n}\n```$/)
    })

    it('should output complex objects as code blocks in fancy mode', () => {
      f.setFancy(true)
      const result = f.fancy({
        prop: 'value'.repeat(20),
      })
      expect(result).toMatch(/^```\n{\n.+\n}\n```$/)
    })
  })
})
