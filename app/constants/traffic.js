// Traffic-related constants
export const TRAFFIC_PRIORITY = { 
  heavy: 1, 
  moderate: 2, 
  clear: 3, 
  unknown: 3 
}

export const TRAFFIC_PRIORITY_LABEL = { 
  1: 'P1 — Extreme', 
  2: 'P2 — High', 
  3: 'P3 — Moderate' 
}

export const TRAFFIC_STATUS_LABEL = { 
  heavy: 'HEAVY', 
  moderate: 'MOD', 
  clear: 'CLEAR', 
  unknown: '—' 
}

export const TRAFFIC_SAMPLE_ROUTES = [
  { dlat: 0.006, dlng: 0 }, 
  { dlat: 0, dlng: 0.007 },
  { dlat: -0.006, dlng: 0 }, 
  { dlat: 0, dlng: -0.007 },
  { dlat: 0.006, dlng: 0.007 }, 
  { dlat: -0.006, dlng: -0.007 },
]

export const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
