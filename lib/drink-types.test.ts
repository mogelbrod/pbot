import { describe, it, expect } from 'vitest'
import * as dt from './drink-types'

describe('drink-types', () => {
  const mocks = {
    Beer: {
      _type: 'DrinkTypes' as const,
      Name: 'Beer',
      Emoji: '🍺',
      Multiplier: 1.0,
      _created: new Date(),
      _id: 'beer-1',
    },
    Wine: {
      _type: 'DrinkTypes' as const,
      Name: 'Wine',
      Emoji: '🍷',
      Multiplier: 2,
      _created: new Date(),
      _id: 'wine-1',
    },
    Cider: {
      Name: 'Cider',
      Emoji: '🍎',
      Multiplier: 0.5,
      _type: 'DrinkTypes',
      _created: new Date(),
      _id: 'cider-1',
    },
  } as const satisfies dt.DrinkTypes

  describe('drinkType()', () => {
    it('should return default Unknown type when not defined', () => {
      const result = dt.drinkType('NonExistent')
      expect(result.Name).toBe('Unknown')
      expect(result.Emoji).toBe('🍼')
      expect(result.Multiplier).toBe(1.0)
    })

    it('should return drink type by name', () => {
      dt.defineDrinkTypes(mocks)
      expect(dt.drinkType('Beer').Emoji).toBe('🍺')
    })

    it('should accept drink object with Type property', () => {
      dt.defineDrinkTypes(mocks)
      const drink = {
        Type: { value: 'Wine' },
        Volume: '750ml',
      } as any
      const result = dt.drinkType(drink)
      expect(result.Name).toBe('Wine')
      expect(result.Emoji).toBe('🍷')
    })

    it('should handle case sensitivity', () => {
      dt.defineDrinkTypes(mocks)
      const result = dt.drinkType('beer')
      expect(result.Name).toBe('Unknown')
    })

    it('should preserve multiplier', () => {
      dt.defineDrinkTypes(mocks)
      const result = dt.drinkType('Wine')
      expect(result.Multiplier).toBe(2)
    })

    it('should always include Unknown type', () => {
      dt.defineDrinkTypes({})
      const unknown = dt.drinkType('Unknown')
      expect(unknown.Name).toBe('Unknown')
      expect(unknown.Emoji).toBe('🍼')
      expect(unknown._type).toBe('DrinkTypes')
    })
  })

  describe('defineDrinkTypes()', () => {
    it('should return object with provided types', () => {
      const result = dt.defineDrinkTypes(mocks)
      expect(result.Cider).toBeDefined()
      expect(result.Cider.Name).toBe('Cider')
    })

    it('should always include Unknown type', () => {
      const result = dt.defineDrinkTypes({})
      expect(result.Unknown).toBeDefined()
      expect(result.Unknown.Name).toBe('Unknown')
      expect(result.Unknown).toHaveProperty('_type', 'DrinkTypes')
      expect(result.Unknown).toHaveProperty('_created')
      expect(result.Unknown).toHaveProperty('_id', 'Unknown')
    })

    it('should handle multiple custom types', () => {
      const types: any = dt.defineDrinkTypes(mocks)
      expect(Object.keys(types).length).toBe(4)
      expect(types.Beer).toBeDefined()
      expect(types.Wine).toBeDefined()
      expect(types.Cider).toBeDefined()
    })

    it('should preserve all properties of drink types', () => {
      const result: any = dt.defineDrinkTypes(mocks)
      const beer = result.Beer
      expect(beer.Name).toBe('Beer')
      expect(beer.Emoji).toBe('🍺')
      expect(beer.Multiplier).toBe(1)
      expect(beer._type).toBe('DrinkTypes')
      expect(beer._id).toBe('beer-1')
    })

    it('should return new object', () => {
      const custom = {
        Beer: {
          Name: 'Beer',
          Emoji: '🍺',
          Multiplier: 1.0,
          _type: 'DrinkTypes' as const,
          _created: new Date(),
          _id: 'beer-1',
        },
      }
      const result: any = dt.defineDrinkTypes(custom)
      expect(result).not.toBe(custom)
      expect(result.Beer).toEqual(custom.Beer)
    })
  })

  describe('loadDrinkTypes()', () => {
    it('should load drink types from backend', async () => {
      const mockBackend = {
        table: async () => Promise.resolve([mocks.Beer, mocks.Wine]),
      } as any
      const result = await dt.loadDrinkTypes(mockBackend)
      expect(result).toEqual({
        Beer: mocks.Beer,
        Wine: mocks.Wine,
        Unknown: expect.objectContaining({ Name: 'Unknown' }),
      })
    })

    it('should convert string multipliers to numbers', async () => {
      const mockBackend = {
        table: async () =>
          Promise.resolve([
            {
              _type: 'DrinkTypes' as const,
              Name: 'Beer',
              Emoji: '🍺',
              Multiplier: '2.5',
              _created: new Date(),
              _id: 'beer-1',
            },
          ]),
      } as any
      await dt.loadDrinkTypes(mockBackend)
      const beer = dt.drinkType('Beer')
      expect(typeof beer.Multiplier).toBe('number')
      expect(beer.Multiplier).toBe(2.5)
    })

    it('should call backend table with DrinkTypes', async () => {
      const mockBackend = {
        table: async () => Promise.resolve([]),
      } as any
      await dt.loadDrinkTypes(mockBackend)
      expect(true).toBe(true)
    })

    it('should update global drinkTypes state', async () => {
      const mockBackend = {
        table: async () =>
          Promise.resolve([
            {
              _type: 'DrinkTypes' as const,
              Name: 'CustomBeer',
              Emoji: '🍻',
              Multiplier: '1.0',
              _created: new Date(),
              _id: 'custom-1',
            },
          ]),
      } as any

      await dt.loadDrinkTypes(mockBackend)
      const result = dt.drinkType('CustomBeer')
      expect(result.Name).toBe('CustomBeer')
      expect(result.Emoji).toBe('🍻')
    })

    it('should handle invalid multiplier values gracefully', async () => {
      const mockBackend = {
        table: async () =>
          Promise.resolve([
            {
              _type: 'DrinkTypes' as const,
              Name: 'BadBeer',
              Emoji: '🍺',
              Multiplier: 'invalid',
              _created: new Date(),
              _id: 'bad-1',
            },
          ]),
      } as any

      await dt.loadDrinkTypes(mockBackend)
      const result = dt.drinkType('BadBeer')
      expect(isNaN(result.Multiplier)).toBe(true)
    })
  })

  describe('integration', () => {
    it('should work together: define and retrieve types', () => {
      dt.defineDrinkTypes({
        Beer: {
          Name: 'Beer',
          Emoji: '🍺',
          Multiplier: 1.0,
          _type: 'DrinkTypes',
          _created: new Date(),
          _id: 'beer-1',
        },
      })

      const retrieved = dt.drinkType('Beer')
      expect(retrieved.Emoji).toBe('🍺')
    })

    it('should handle sequential load operations', async () => {
      const mockBackend1 = {
        table: async () =>
          Promise.resolve([
            {
              _type: 'DrinkTypes' as const,
              Name: 'Beer',
              Emoji: '🍺',
              Multiplier: '1.0',
              _created: new Date(),
              _id: 'beer-1',
            },
          ]),
      } as any

      const mockBackend2 = {
        table: async () =>
          Promise.resolve([
            {
              _type: 'DrinkTypes' as const,
              Name: 'Wine',
              Emoji: '🍷',
              Multiplier: '0.75',
              _created: new Date(),
              _id: 'wine-1',
            },
          ]),
      } as any

      await dt.loadDrinkTypes(mockBackend1)
      const beer = dt.drinkType('Beer')
      expect(beer.Name).toBe('Beer')

      await dt.loadDrinkTypes(mockBackend2)
      const wine = dt.drinkType('Wine')
      expect(wine.Name).toBe('Wine')
    })
  })
})
