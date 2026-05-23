import { Loader } from '@googlemaps/js-api-loader'

let loaderPromise = null

export function getLoader(apiKey) {
  if (!loaderPromise) {
    // Use a superset of libraries required by various components
    loaderPromise = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['maps', 'marker', 'drawing', 'geometry', 'places'],
    }).load()
  }
  return loaderPromise
}

export default getLoader
