const fetch = require('node-fetch')
const qs = require('query-string')
const { addType } = require('./format')

const TYPE = 'GooglePlace'
const DEFAULT_LOCATION = '59.332241,18.064516'

Object.assign(exports, {
  TYPE,
  findPlace,
  searchPlaces,
})

/**
 * Returns 0 or more places given a query, location & radius.
 *
 * Will return the best candidate, or null, by default.
 * Use `returnFirst = false` to return all candidates instead.
 *
 * @param {String} query - Name/address of place to retrieve
 * @param {Object} o - Options
 * @param {String} o.googlePlacesKey - Places API key
 * @param {Boolean} [o.returnFirst=true] - Use false to return all candidates
 *        instead of only the first
 * @param {String} [o.location] Latitude and longitude to search from
 * @param {Number} [o.radius=5000] Search radius in meters
 * @return {Promise} Promise resolving to best candidate if returnFirst=true,
 *         otherwise an array with candidates
 */
function findPlace(query, {
  googlePlacesKey,
  returnFirst = true,
  location = DEFAULT_LOCATION,
  radius = 5000,
}) {
  const url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?' + qs.stringify({
    input: query,
    inputtype: 'textquery',
    locationsbias: 'circle:5000@59.332241,18.064516',
    fields: 'place_id,name,formatted_address',
    key: googlePlacesKey,
  })
  return fetch(url)
    .then(res => res.json())
    .then(res => addType(returnFirst ? res.candidates[0] : res.candidates, TYPE))
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
 * @param {String} query - Keywords to search for
 * @param {Object} options - Options
 * @param {String} options.googlePlacesKey - Places API key
 * @param {Boolean} [options.nearby] Switch from text to nearby search
 * @param {String} [options.location] Latitude and longitude to search from
 * @param {Number} [options.radius=5000] Search radius in meters
 * @param {Number} [options.minPrice=0] Minimum price range (0-4)
 * @param {Number} [options.maxPrice=0] Maximum price range (0-4)
 * @param {String} [options.type] Limit results to a specific type
 * @param {Boolean} [options.openNow=false] Limit to places that are currently open
 * @param {String} [options.pageToken] Return more results for an earlier search
 * @param {String} [options.rankBy=prominence] Rank by prominence/distance (nearby mode only)
 * @return {Promise}
 */
function searchPlaces(query, options = {}) {
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

  const params = {
    location,
    radius,
    key: googlePlacesKey,
    type,
    opennow: openNow,
    minprice: minPrice,
    maxprice: maxPrice,
    pagetoken: pageToken,
  }
  params[nearby ? 'input' : 'query'] = query
  if (nearby) { params.rankby = rankBy }

  const endpoint = nearby ? 'nearbysearch' : 'textsearch'
  const url = `https://maps.googleapis.com/maps/api/place/${endpoint}/json?` +
    qs.stringify(params)
  return fetch(url)
    // TODO: Handle status (= 'INVALID_REQUEST' => retry after 1s)
    .then(res => res.json())
    .then(json => {
      // Requested page has not yet been generated
      if (json.status === 'INVALID_REQUEST' && pageToken) {
        // Retry after waiting for a bit
        return new Promise(resolve => setTimeout(resolve, 500))
          .then(() => searchPlaces(query, options))
      }

      // Error handling
      if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
        throw Object.assign(
          new Error(`search: Got status ${json.status} while searching'`),
          { inputData: params }
        )
      }

      // Determine if we need to fetch additional page(s)
      const resultsCount = json && json.results && json.results.length || 0
      const remainingCount = targetCount - resultsCount
      if (remainingCount <= 0 || !json.next_page_token) {
        return addType(json.results, TYPE) // no more pages to fetch
      }

      // Recursively fetch next page(s)
      const nextOptions = Object.assign({}, options)
      nextOptions.targetCount = remainingCount
      nextOptions.pageToken = json.next_page_token
      return searchPlaces(query, nextOptions)
        .then(nextResults => {
          return json.results.concat(nextResults)
        })
    })
}
