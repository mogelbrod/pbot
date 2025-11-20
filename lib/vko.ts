import fetch from 'node-fetch'
import Papa from 'papaparse'
import type { Entity } from './types'

let cachedVkoEntries: Promise<VkoEntries> | undefined
let cachedTimestamp = 0

/** Returns VKO data table, fetching it from source if cache is older than `maxAge` */
export function getVkoEntries(maxAge = 3600e3): Promise<VkoEntries> {
  if (!cachedVkoEntries || Date.now() - cachedTimestamp > maxAge) {
    cachedVkoEntries = fetchVkoEntries()
  }
  return cachedVkoEntries
}

/** Fetch VKO data from source and process into a table */
export async function fetchVkoEntries(): Promise<VkoEntries> {
  cachedTimestamp = Date.now()

  const csvUrl =
    'https://docs.google.com/spreadsheets/d/149uVBs81T7fyytKBd-caPVkgrle41-q7LqrLB3fGqFU/gviz/tq?tqx=out:csv&sheet=Vadkostarölen.se'
  const res = await fetch(csvUrl)
  if (!res.ok) throw new Error('VKO error: ' + res.statusText)
  const csvText = await res.text()
  const results = Papa.parse<CSVEntry>(csvText, {
    skipEmptyLines: true,
    header: true,
    transformHeader: (header, index) => header.trim() || `_${index}`,
  })

  const entries: Record<string, VkoEntry> = {}

  for (const row of results.data) {
    const entry: VkoEntry = {
      _type: 'VkoEntry',
      barId: row.barId?.trim() || toSlug(row.Bar),
      name: row.Bar,
      lat: parseFloat(row.Lat),
      lng: parseFloat(row.Lng),
      beerPrice: parseFloat(row.VanligtPris),
      tags: row.Tags
        ? row.Tags.split(',').map((t) => t.trim().toLowerCase())
        : [],
      happyHour:
        row.HappyPris || row.Happyframtill
          ? {
              from: row.Happyfran || null,
              to: row.Happyframtill || null,
              price: row.HappyPris ? parseFloat(row.HappyPris) : null,
              allDays: (row.HHhelg || '').toLowerCase() === 'ja',
            }
          : null,
      link: row.Links || null,
      // OpenSun: row.OpenSun,
      // ClosedSun: row.ClosedSun,
      // OpenMon: row.OpenMon,
      // ClosedMon: row.ClosedMon,
      // OpenTue: row.OpenTue,
      // ClosedTue: row.ClosedTue,
      // OpenWed: row.OpenWed,
      // ClosedWed: row.ClosedWed,
      // OpenThu: row.OpenThu,
      // ClosedThu: row.ClosedThu,
      // OpenFri: row.OpenFri,
      // ClosedFri: row.ClosedFri,
      // OpenSat: row.OpenSat,
      // ClosedSat: row.ClosedSat,
    }

    if (!entries[entry.barId]) {
      entries[entry.barId] = entry
    } else {
      entries[entry.barId].rows ||= []
      entries[entry.barId].rows!.push(entry)
    }
  }

  cachedTimestamp = Date.now()
  return entries
}

/** Returns closest VKO entry for the given coordinates */
export async function getClosestVkoEntry(
  lat: number,
  lng: number,
  maxDistanceMeters = 10,
): Promise<VkoEntry | undefined> {
  const data = await getVkoEntries()
  let closestEntry: VkoEntry | undefined
  let minDistance = maxDistanceMeters
  for (const entry of Object.values(data)) {
    if (isNaN(entry.lat) || isNaN(entry.lng)) {
      continue
    }
    const distance = getDistance(lat, lng, entry.lat, entry.lng)
    if (distance < minDistance) {
      minDistance = distance
      closestEntry = entry
    }
  }
  return closestEntry
}

/**
 * Calculate distance between two lat/long coordinates using the Haversine formula.
 * @returns distance in meters
 */
function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3 // metres
  const φ1 = (lat1 * Math.PI) / 180 // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // in metres
}

function toSlug(str: string): string {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // "Nivå 22 (33cl)" → "niva-22-33cl";
}

export type VkoEntries = Record<string, VkoEntry>

export interface VkoEntry extends Entity {
  _type: 'VkoEntry'
  barId: string
  name: string
  lat: number
  lng: number
  beerPrice: number
  happyHour: {
    from: string | null
    to: string | null
    price: number | null
    allDays: boolean
  } | null
  link: string | null
  tags: string[]
  rows?: VkoEntry[]
}

interface CSVEntry {
  Bar: string
  Lat: string
  Lng: string
  VanligtPris: string
  Tags: string
  HappyPris: string
  Happyfran: string
  Happyframtill: string
  HHhelg: string
  Links: string
  barId: string
}
