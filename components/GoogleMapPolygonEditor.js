'use client'

import { useEffect, useRef, useState } from 'react'
import getLoader from '@/lib/googleMapsLoader'

// Simplify points by minimum distance (meters) between consecutive samples
function simplifyByDistance(points, google, minMeters = 8) {
  if (!points.length) return points
  const out = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const last = out[out.length - 1]
    const d = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(last.lat, last.lng),
      new google.maps.LatLng(points[i].lat, points[i].lng)
    )
    if (d >= minMeters) out.push(points[i])
  }
  return out
}

export default function GoogleMapPolygonEditor({
  apiKey,
  polygon = null,
  onChange,
  center = { lat: 17.4500, lng: 78.5200 },
  zoom = 13,
}) {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const polyRef = useRef(null)
  const drawingRef = useRef(null)
  const googleRef = useRef(null)
  const freehandStateRef = useRef({ active: false, polyline: null, points: [], listeners: [] })
  const [mode, setMode] = useState('polygon') // 'polygon' or 'freehand'

  useEffect(() => {
    if (!apiKey || !ref.current) return
    let cancelled = false
    getLoader(apiKey).then((google) => {
      if (cancelled) return
      googleRef.current = google
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(ref.current, {
          center, zoom, mapTypeControl: true, streetViewControl: false,
          gestureHandling: 'greedy',
        })
      }
      if (polygon && polygon.length > 2) {
        if (polyRef.current) polyRef.current.setMap(null)
        polyRef.current = new google.maps.Polygon({
          paths: polygon.map(p => ({ lat: Number(p[0]), lng: Number(p[1]) })),
          editable: true, draggable: true,
          fillColor: '#3b82f6', fillOpacity: 0.25, strokeColor: '#3b82f6', strokeWeight: 2,
        })
        polyRef.current.setMap(mapRef.current)
        attachListeners(polyRef.current)
        const bounds = new google.maps.LatLngBounds()
        polygon.forEach(p => bounds.extend({ lat: Number(p[0]), lng: Number(p[1]) }))
        mapRef.current.fitBounds(bounds)
      }
      if (!drawingRef.current) {
        drawingRef.current = new google.maps.drawing.DrawingManager({
          drawingMode: (polygon && polygon.length > 2) ? null : google.maps.drawing.OverlayType.POLYGON,
          drawingControl: false,
          polygonOptions: {
            editable: true, draggable: true,
            fillColor: '#3b82f6', fillOpacity: 0.25, strokeColor: '#3b82f6', strokeWeight: 2,
          },
        })
        drawingRef.current.setMap(mapRef.current)
        google.maps.event.addListener(drawingRef.current, 'polygoncomplete', (poly) => {
          if (polyRef.current) polyRef.current.setMap(null)
          polyRef.current = poly
          drawingRef.current.setDrawingMode(null)
          attachListeners(poly)
          emit(poly)
        })
      }
    })
    return () => { cancelled = true; detachFreehand() }
  }, [apiKey])

  function attachListeners(poly) {
    const google = googleRef.current
    const path = poly.getPath()
    google.maps.event.addListener(path, 'set_at', () => emit(poly))
    google.maps.event.addListener(path, 'insert_at', () => emit(poly))
    google.maps.event.addListener(path, 'remove_at', () => emit(poly))
  }
  function emit(poly) {
    const path = poly.getPath()
    const coords = []
    for (let i = 0; i < path.getLength(); i++) {
      const ll = path.getAt(i)
      coords.push([ll.lat(), ll.lng()])
    }
    if (onChange) coords.length > 2 && onChange(coords)
  }

  function attachFreehand() {
    const google = googleRef.current
    const map = mapRef.current
    if (!google || !map) return
    detachFreehand()
    map.setOptions({ draggable: false, gestureHandling: 'none' })
    const state = freehandStateRef.current
    state.active = false; state.points = []
    const onMouseDown = (e) => {
      state.active = true
      state.points = [{ lat: e.latLng.lat(), lng: e.latLng.lng() }]
      if (state.polyline) state.polyline.setMap(null)
      state.polyline = new google.maps.Polyline({
        path: state.points, map,
        strokeColor: '#3b82f6', strokeWeight: 3,
      })
    }
    const onMouseMove = (e) => {
      if (!state.active) return
      state.points.push({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      state.polyline.setPath(state.points)
    }
    const onMouseUp = (e) => {
      if (!state.active) return
      state.active = false
      // simplify and create polygon
      const simplified = simplifyByDistance(state.points, google, 8)
      state.polyline.setMap(null); state.polyline = null
      if (simplified.length < 3) { state.points = []; return }
      if (polyRef.current) polyRef.current.setMap(null)
      polyRef.current = new google.maps.Polygon({
        paths: simplified, map,
        editable: true, draggable: true,
        fillColor: '#3b82f6', fillOpacity: 0.25, strokeColor: '#3b82f6', strokeWeight: 2,
      })
      attachListeners(polyRef.current)
      emit(polyRef.current)
      state.points = []
      // restore draggable
      map.setOptions({ draggable: true, gestureHandling: 'greedy' })
      // auto-switch back to polygon mode
      setMode('polygon')
      detachFreehand()
    }
    state.listeners = [
      google.maps.event.addListener(map, 'mousedown', onMouseDown),
      google.maps.event.addListener(map, 'mousemove', onMouseMove),
      google.maps.event.addListener(map, 'mouseup', onMouseUp),
    ]
  }
  function detachFreehand() {
    const google = googleRef.current
    const state = freehandStateRef.current
    state.listeners.forEach(l => google?.maps.event.removeListener(l))
    state.listeners = []
    if (state.polyline) { state.polyline.setMap(null); state.polyline = null }
    state.active = false; state.points = []
    if (mapRef.current) mapRef.current.setOptions({ draggable: true, gestureHandling: 'greedy' })
  }

  // Toggle freehand
  useEffect(() => {
    if (mode === 'freehand') {
      // disable polygon-click drawing
      if (drawingRef.current) drawingRef.current.setDrawingMode(null)
      attachFreehand()
    } else {
      detachFreehand()
      // re-enable polygon click-draw only if no polygon yet
      if (drawingRef.current && !polyRef.current && googleRef.current) {
        drawingRef.current.setDrawingMode(googleRef.current.maps.drawing.OverlayType.POLYGON)
      }
    }
  }, [mode])

  const clearPolygon = () => {
    if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null }
    if (drawingRef.current && googleRef.current) {
      drawingRef.current.setDrawingMode(googleRef.current.maps.drawing.OverlayType.POLYGON)
    }
    setMode('polygon')
    if (onChange) onChange(null)
  }

  if (!apiKey) {
    return <div className="h-full w-full flex items-center justify-center bg-amber-50 text-amber-700">Google Maps API key missing</div>
  }

  return (
    <div className="relative h-full w-full">
      <div ref={ref} style={{ height: '100%', width: '100%', minHeight: 400 }} />
      <div className="absolute top-3 left-3 z-10 bg-white border rounded-lg shadow-md p-1 flex gap-1 text-xs">
        <button
          type="button"
          className={`px-3 py-1.5 rounded font-medium ${mode === 'polygon' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          onClick={() => setMode('polygon')}
        >📐 Click points</button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded font-medium ${mode === 'freehand' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          onClick={() => setMode('freehand')}
        >✏️ Freehand</button>
      </div>
      <button
        onClick={clearPolygon}
        type="button"
        className="absolute bottom-3 right-3 z-10 bg-white border rounded px-3 py-1.5 text-xs font-medium shadow hover:bg-slate-50"
      >Clear / Redraw</button>
      {mode === 'freehand' && (
        <div className="absolute bottom-3 left-3 z-10 bg-blue-600 text-white rounded px-3 py-1.5 text-xs shadow">
          Hold mouse & drag to sketch the boundary freehand
        </div>
      )}
    </div>
  )
}
