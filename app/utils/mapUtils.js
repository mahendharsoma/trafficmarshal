/**
 * Generate Google Maps URL for a location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Google Maps URL
 */
export const getMapUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`

/**
 * Generate Google Maps navigation URL
 * @param {number} lat - Destination latitude
 * @param {number} lng - Destination longitude
 * @returns {string} Google Maps navigation URL
 */
export const getNavUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

/**
 * Check if a point is inside a polygon
 * @param {Object} point - Point with lat and lng properties
 * @param {Array} polygon - Array of [lat, lng] coordinates
 * @returns {boolean} True if point is inside polygon
 */
export const isPointInsidePolygon = (point, polygon) => {
  if (!point || !polygon || polygon.length < 3) return true
  const x = Number(point.lng)
  const y = Number(point.lat)
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = Number(polygon[i][0])
    const xi = Number(polygon[i][1])
    const yj = Number(polygon[j][0])
    const xj = Number(polygon[j][1])
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Get traffic duration using Google DirectionsService
 * @param {Object} google - Google Maps API object
 * @param {Object} dirSvc - DirectionsService instance
 * @param {number} lat - Origin latitude
 * @param {number} lng - Origin longitude
 * @param {Object} route - Route delta with dlat and dlng
 * @param {string} trafficModel - Traffic model (OPTIMISTIC or BEST_GUESS)
 * @returns {Promise<number|null>} Duration in seconds or null
 */
export const getTrafficDuration = (google, dirSvc, lat, lng, route, trafficModel) => new Promise((resolve) => {
  try {
    const origin = new google.maps.LatLng(lat, lng)
    const destination = new google.maps.LatLng(lat + route.dlat, lng + route.dlng)
    const request = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
    }
    if (trafficModel && google.maps.TrafficModel) {
      request.drivingOptions = {
        departureTime: new Date(Date.now() + 2 * 60 * 1000),
        trafficModel,
      }
    }
    dirSvc.route(request, (result, status) => {
      if (status !== 'OK' || !result?.routes?.[0]?.legs?.[0]) return resolve(null)
      const leg = result.routes[0].legs[0]
      resolve(leg.duration_in_traffic?.value || leg.duration?.value || null)
    })
  } catch {
    resolve(null)
  }
})

/**
 * Get traffic density ratio (congestion level)
 * @param {Object} google - Google Maps API object
 * @param {Object} dirSvc - DirectionsService instance
 * @param {number} lat - Location latitude
 * @param {number} lng - Location longitude
 * @param {Object} route - Route delta
 * @returns {Promise<number|null>} Traffic density ratio or null
 */
export const getTrafficDensityRatio = async (google, dirSvc, lat, lng, route) => {
  const optimisticModel = google.maps.TrafficModel?.OPTIMISTIC || 'OPTIMISTIC'
  const bestGuessModel = google.maps.TrafficModel?.BEST_GUESS || 'BEST_GUESS'
  const [optimistic, bestGuess] = await Promise.all([
    getTrafficDuration(google, dirSvc, lat, lng, route, optimisticModel),
    getTrafficDuration(google, dirSvc, lat, lng, route, bestGuessModel),
  ])
  if (!optimistic || !bestGuess) return null
  return Math.max(1, bestGuess / optimistic)
}
