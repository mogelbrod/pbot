import { describe, it, expect, vi } from 'vitest'
import { vko, type VkoEntry, type VkoEntries } from './vko.js'

describe('vko', () => {
  // Shared mock entries for tests
  const mockClose: VkoEntry = {
    _type: 'VkoEntry',
    barId: 'bar-1',
    name: 'Close Bar',
    lat: 59.32,
    lng: 18.06,
    beerPrice: 45,
    happyHour: null,
    link: null,
    tags: [],
  }
  const mockFar: VkoEntry = {
    _type: 'VkoEntry',
    barId: 'bar-2',
    name: 'Far Bar',
    lat: 59.2,
    lng: 17.9,
    beerPrice: 50,
    happyHour: null,
    link: null,
    tags: [],
  }
  const mockInvalid: VkoEntry = {
    _type: 'VkoEntry',
    barId: 'bar-invalid',
    name: 'Invalid Bar',
    lat: NaN,
    lng: NaN,
    beerPrice: 45,
    happyHour: null,
    link: null,
    tags: [],
  }

  describe('getClosestEntry()', () => {
    it('should return undefined when no entry is within maxDistanceMeters', async () => {
      const mockEntries: VkoEntries = {
        'bar-1': { ...mockFar, lat: 0, lng: 0 },
      }
      vi.spyOn(vko, 'getEntries').mockResolvedValue(mockEntries)
      const result = await vko.getClosestEntry(59.3, 18.0, 10)
      expect(result).toBeUndefined()

      vi.restoreAllMocks()
    })

    it('should skip entries with NaN coordinates', async () => {
      const mockEntries: VkoEntries = {
        'bar-invalid': mockInvalid,
        'bar-2': mockFar,
      }

      vi.spyOn(vko, 'getEntries').mockResolvedValue(mockEntries)

      const result = await vko.getClosestEntry(59.33, 18.08, 100000)
      expect(result?.barId).toBe('bar-2')

      vi.restoreAllMocks()
    })

    it('should find the closest entry among multiple', async () => {
      const mockEntries: VkoEntries = {
        'bar-1': mockClose,
        'bar-2': mockFar,
      }

      vi.spyOn(vko, 'getEntries').mockResolvedValue(mockEntries)

      const result = await vko.getClosestEntry(59.33, 18.08, 100000)
      expect(result?.barId).toBe('bar-1')

      vi.restoreAllMocks()
    })

    it('should respect maxDistanceMeters parameter', async () => {
      const mockEntries: VkoEntries = {
        'bar-2': mockFar,
      }

      vi.spyOn(vko, 'getEntries').mockResolvedValue(mockEntries)

      const result = await vko.getClosestEntry(59.33, 18.08, 1)
      expect(result).toBeUndefined()

      vi.restoreAllMocks()
    })

    it('should return the closest entry when multiple are within range', async () => {
      const mockEntries: VkoEntries = {
        'bar-1': mockClose,
        'bar-2': {
          ...mockFar,
          barId: 'bar-3',
          name: 'Very Close Bar',
          lat: 59.31,
          lng: 18.05,
        },
      }

      vi.spyOn(vko, 'getEntries').mockResolvedValue(mockEntries)

      const result = await vko.getClosestEntry(59.33, 18.08, 100000)
      expect(result?.barId).toBe('bar-1')

      vi.restoreAllMocks()
    })
  })

  describe('VkoEntry type', () => {
    it('should have required properties', () => {
      const entry: VkoEntry = {
        _type: 'VkoEntry',
        barId: 'test-1',
        name: 'Test Bar',
        lat: 59.3,
        lng: 18.0,
        beerPrice: 45,
        happyHour: {
          from: '16:00',
          to: '18:00',
          price: 35,
          allDays: false,
        },
        link: 'http://example.com',
        tags: ['beer', 'food'],
      }

      expect(entry._type).toBe('VkoEntry')
      expect(entry.barId).toBe('test-1')
      expect(entry.name).toBe('Test Bar')
      expect(entry.lat).toBe(59.3)
      expect(entry.lng).toBe(18.0)
      expect(entry.beerPrice).toBe(45)
      expect(entry.link).toBe('http://example.com')
    })

    it('should support null happyHour', () => {
      const entry: VkoEntry = {
        _type: 'VkoEntry',
        barId: 'test-1',
        name: 'Test Bar',
        lat: 59.3,
        lng: 18.0,
        beerPrice: 45,
        happyHour: null,
        link: null,
        tags: [],
      }

      expect(entry.happyHour).toBeNull()
    })

    it('should support optional rows property', () => {
      const entry: VkoEntry = {
        _type: 'VkoEntry',
        barId: 'test-1',
        name: 'Test Bar',
        lat: 59.3,
        lng: 18.0,
        beerPrice: 45,
        happyHour: null,
        link: null,
        tags: [],
        rows: [
          {
            _type: 'VkoEntry',
            barId: 'test-1-sub',
            name: 'Test Bar Sub',
            lat: 59.3,
            lng: 18.0,
            beerPrice: 40,
            happyHour: null,
            link: null,
            tags: [],
          },
        ],
      }

      expect(entry.rows).toHaveLength(1)
      expect(entry.rows![0].name).toBe('Test Bar Sub')
    })
  })

  describe('VkoEntries type', () => {
    it('should be a record of VkoEntry keyed by barId', () => {
      const entries: VkoEntries = {
        'bar-1': {
          _type: 'VkoEntry',
          barId: 'bar-1',
          name: 'Bar 1',
          lat: 59.3,
          lng: 18.0,
          beerPrice: 45,
          happyHour: null,
          link: null,
          tags: [],
        },
        'bar-2': {
          _type: 'VkoEntry',
          barId: 'bar-2',
          name: 'Bar 2',
          lat: 59.31,
          lng: 18.01,
          beerPrice: 50,
          happyHour: null,
          link: null,
          tags: [],
        },
      }

      expect(Object.keys(entries)).toEqual(['bar-1', 'bar-2'])
      expect(entries['bar-1'].name).toBe('Bar 1')
      expect(entries['bar-2'].beerPrice).toBe(50)
    })
  })
})
