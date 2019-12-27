const fetch = require('node-fetch')
const qs = require('query-string')

Object.assign(exports, {
  findPlace,
})

function findPlace(input, googlePlacesKey) {
  const params = {
    input,
    inputtype: 'textquery',
    locationsbias: 'circle:5000@59.332241,18.064516',
    fields: 'place_id,name,formatted_address',
    key: googlePlacesKey,
  }
  const url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?' +
    qs.stringify(params)
  return fetch(url).then(res => res.json())
}
