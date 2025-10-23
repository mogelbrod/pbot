import fetch from 'node-fetch'
import qs from 'query-string'
import { addType } from './format.js'
import type { GooglePlace } from './types.js'

export const TYPE = 'GooglePlace'
const DEFAULT_LOCATION = '59.343,18.05'

/**
 * Returns 0 or more places given a query, location & radius.
 *
 * Will return the best candidate, or null, by default.
 * Use `returnFirst = false` to return all candidates instead.
 *
 * @param query - Name/address of place to retrieve
 * @param o - Options
 * @param o.googlePlacesKey - Places API key
 * @param o.returnFirst - Use false to return all candidates
 *        instead of only the first
 * @param o.location - Latitude and longitude to search from
 * @param o.radius - Search radius in meters
 * @return Promise resolving to best candidate if returnFirst=true,
 *         otherwise an array with candidates
 */
export async function findPlaces(
  query: string,
  {
    googlePlacesKey,
    location = DEFAULT_LOCATION,
    radius = 5000,
  }: {
    googlePlacesKey: string
    location?: string
    radius?: number
  },
): Promise<GooglePlace[]> {
  assertKey(googlePlacesKey)

  const url =
    'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?' +
    qs.stringify({
      input: query,
      inputtype: 'textquery',
      locationsbias: 'circle:5000@59.332241,18.064516',
      fields: 'place_id,name,formatted_address',
      key: googlePlacesKey,
    })
  const res = await fetch(url)
  const json: any = await res.json()
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw Object.assign(new Error(`findPlace: Got status ${json.status}`), {
      inputData: { location, radius },
    })
  }
  return addType(json.candidates, TYPE)
}

/**
 * Returns a list of relevant places given a query (keyword), location, radius, etc.
 *
 * Uses Google Places "Text Search" API by default, but can be switched to
 * "Nearby Search" using the `nearby` flag.
 *
 * @see https://developers.google.com/places/web-service/search#TextSearchRequests
 * @see https://developers.google.com/places/web-service/search#PlaceSearchRequests
 *
 * @param query - Keywords to search for
 * @param o - Options
 * @param o.googlePlacesKey - Places API key
 * @param o.nearby - Switch from text to nearby search
 * @param o.location - Latitude and longitude to search from
 * @param o.radius - Search radius in meters
 * @param o.minPrice - Minimum price range (0-4)
 * @param o.maxPrice - Maximum price range (0-4)
 * @param o.type - Limit results to a specific type
 * @param o.openNow - Limit to places that are currently open
 * @param o.pageToken - Return more results for an earlier search
 * @param o.rankBy - Rank by prominence/distance (nearby mode only)
 * @param o.targetCount - Number of results to aim to return
 */
export function searchPlaces(
  query: string,
  options: {
    googlePlacesKey: string
    nearby?: boolean
    radius?: number
    location?: string
    minPrice?: number
    maxPrice?: number
    type?: string
    openNow?: boolean
    rankBy?: string
    pageToken?: string
    targetCount?: number
  },
): Promise<any[]> {
  const {
    googlePlacesKey,
    nearby = false,
    radius = 5000,
    location = DEFAULT_LOCATION,
    minPrice = 0,
    maxPrice = 4,
    type = undefined,
    openNow = false,
    rankBy = 'prominence',
    pageToken = undefined,
    targetCount = 0,
  } = options

  assertKey(googlePlacesKey)

  const params = {
    location,
    radius,
    key: googlePlacesKey,
    type,
    minprice: minPrice,
    maxprice: maxPrice,
    pagetoken: pageToken,
    input: undefined as string | undefined,
    query: undefined as string | undefined,
    opennow: undefined as boolean | undefined,
    rankby: undefined as string | undefined,
  }
  params[nearby ? 'input' : 'query'] = query
  if (openNow) {
    params.opennow = true
  }
  if (nearby) {
    params.rankby = rankBy
  }

  const endpoint = nearby ? 'nearbysearch' : 'textsearch'
  const url =
    `https://maps.googleapis.com/maps/api/place/${endpoint}/json?` +
    qs.stringify(params)
  return (
    fetch(url)
      // TODO: Handle status (= 'INVALID_REQUEST' => retry after 1s)
      .then((res) => res.json())
      .then((json: any) => {
        // Requested page has not yet been generated
        if (json.status === 'INVALID_REQUEST' && pageToken) {
          // Retry after waiting for a bit
          return new Promise((resolve) => setTimeout(resolve, 500)).then(() =>
            searchPlaces(query, options),
          )
        }

        // Error handling
        if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
          throw Object.assign(
            new Error(`searchPlaces: Got status ${json.status}`),
            { inputData: params },
          )
        }

        // Determine if we need to fetch additional page(s)
        const resultsCount = (json && json.results && json.results.length) || 0
        const remainingCount = targetCount - resultsCount
        if (remainingCount <= 0 || !json.next_page_token) {
          return addType(json.results, TYPE) // no more pages to fetch
        }

        // Recursively fetch next page(s)
        const nextOptions = Object.assign({}, options)
        nextOptions.targetCount = remainingCount
        nextOptions.pageToken = json.next_page_token
        return searchPlaces(query, nextOptions).then((nextResults) => {
          return json.results.concat(nextResults)
        })
      })
  )
}

function assertKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !key.length) {
    throw new Error(`Missing required googlePlacesKey config value`)
  }
}
