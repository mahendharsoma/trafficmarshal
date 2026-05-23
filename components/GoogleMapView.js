'use client'

import { useEffect, useRef } from 'react'
import getLoader from '@/lib/googleMapsLoader'

export default function GoogleMapView({
  apiKey,
  center = { lat: 17.4500, lng: 78.5200 },
  zoom = 12,
  incidents = [],
  families = [],
  polygons = [],
  hotspots = [],
  focus = null,
  showTraffic = true,
  onIncidentClick = null,
  onMapClick = null,
  onHotspotClick = null,
  dispatchHighlight = null,
  fitToPolygons = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const trafficRef = useRef(null)
  const markersRef = useRef([])
  const polysRef = useRef([])
  const hotspotsRef = useRef([])
  const clickListenerRef = useRef(null)
  const circlesRef = useRef([])
  const infoRef = useRef(null)

  useEffect(() => {
    if (!apiKey || !containerRef.current) return
    let cancelled = false
    getLoader(apiKey).then((google) => {
      if (cancelled) return
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          center, zoom,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        })
        infoRef.current = new google.maps.InfoWindow()
      }
      if (showTraffic && !trafficRef.current) {
        trafficRef.current = new google.maps.TrafficLayer()
        trafficRef.current.setMap(mapRef.current)
      }
      // click handler for map (used to mark jams / interactions)
      if (onMapClick && mapRef.current && !clickListenerRef.current) {
        clickListenerRef.current = mapRef.current.addListener('click', (e) => {
          try { onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() }) } catch (err) { console.error('onMapClick error', err) }
        })
      }
    }).catch(e => console.error('Google Maps load error', e))
    return () => { cancelled = true }
  }, [apiKey])

  // Manage map click listener lifecycle when onMapClick changes
  useEffect(() => {
    if (!mapRef.current) return
    if (onMapClick && !clickListenerRef.current) {
      clickListenerRef.current = mapRef.current.addListener('click', (e) => {
        try { onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() }) } catch (err) { console.error('onMapClick error', err) }
      })
    }
    return () => {
      if (clickListenerRef.current && clickListenerRef.current.remove) clickListenerRef.current.remove()
      clickListenerRef.current = null
    }
  }, [onMapClick])

  // Render dispatch highlight circles (level -> radius)
  useEffect(() => {
    if (!mapRef.current) return
    // clear previous
    circlesRef.current.forEach(c => c.setMap(null))
    circlesRef.current = []
    if (!dispatchHighlight || !dispatchHighlight.lat) return
    const centerPt = { lat: Number(dispatchHighlight.lat), lng: Number(dispatchHighlight.lng) }
    const levels = [null, { r: 1000, color: '#22c55e' }, { r: 3000, color: '#f59e0b' }, { r: 5000, color: '#ef4444' }]
    const lvl = Math.max(0, Math.min(3, Number(dispatchHighlight.level || 0)))
    for (let i = 1; i <= lvl; i++) {
      const cfg = levels[i]
      const circle = new google.maps.Circle({
        center: centerPt,
        radius: cfg.r,
        strokeColor: cfg.color,
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: cfg.color,
        fillOpacity: 0.08,
        map: mapRef.current,
      })
      circlesRef.current.push(circle)
    }
    return () => { circlesRef.current.forEach(c => c.setMap(null)); circlesRef.current = [] }
  }, [dispatchHighlight])

  // Render polygons (zones/TPS boundaries)
  useEffect(() => {
    if (!mapRef.current) return
    polysRef.current.forEach(p => p.setMap(null))
    polysRef.current = []
    polygons.forEach(z => {
      if (!z.polygon || z.polygon.length < 3) return
      const poly = new google.maps.Polygon({
        paths: z.polygon.map(p => ({ lat: Number(p[0]), lng: Number(p[1]) })),
        strokeColor: z.color || '#3b82f6',
        strokeWeight: 2,
        fillColor: z.color || '#3b82f6',
        fillOpacity: 0.10,
        map: mapRef.current,
      })
      const center = z.polygon.reduce((acc, p) => ({ lat: acc.lat + Number(p[0]) / z.polygon.length, lng: acc.lng + Number(p[1]) / z.polygon.length }), { lat: 0, lng: 0 })
      poly.addListener('click', () => {
        infoRef.current.setContent(`<div style="font-family:sans-serif;font-size:13px"><b>${z.name}</b><br/>${z.zoneName || ''}</div>`)
        infoRef.current.setPosition(center)
        infoRef.current.open(mapRef.current)
      })
      polysRef.current.push(poly)
    })
    if (fitToPolygons && polygons.some(z => z.polygon && z.polygon.length >= 3)) {
      const bounds = new google.maps.LatLngBounds()
      polygons.forEach(z => {
        if (!z.polygon || z.polygon.length < 3) return
        z.polygon.forEach(p => bounds.extend({ lat: Number(p[0]), lng: Number(p[1]) }))
      })
      mapRef.current.fitBounds(bounds)
    }
  }, [polygons, fitToPolygons])

  // Render clickable hotspots (from SHO grid)
  useEffect(() => {
    if (!mapRef.current) return
    // clear previous
    hotspotsRef.current.forEach(h => h.setMap(null))
    hotspotsRef.current = []
    if (!hotspots || !hotspots.length) return
    hotspots.forEach(h => {
      const pos = { lat: Number(h.lat), lng: Number(h.lng) }
      const delay = Number(h.trafficDensity ?? h.congestion ?? 0)
      const status = h.status || (delay >= 35 ? 'heavy' : delay >= 15 ? 'moderate' : 'clear')
      const color = status === 'heavy' ? '#dc2626' : status === 'moderate' ? '#f59e0b' : '#16a34a'
      const label = status === 'heavy' ? 'H' : status === 'moderate' ? 'M' : 'C'
      const labelText = h.trafficDensity !== null && h.trafficDensity !== undefined ? `${label}` : String(h.incidentCount || 0)
      const statusTitle = status === 'heavy' ? 'Heavy Traffic' : status === 'moderate' ? 'Moderate Traffic' : 'Clear Traffic'
      const circle = new google.maps.Circle({
        center: pos,
        radius: status === 'heavy' ? 170 : status === 'moderate' ? 135 : 95,
        strokeColor: color,
        strokeWeight: 3,
        fillColor: color,
        fillOpacity: status === 'clear' ? 0.12 : 0.20,
        map: mapRef.current,
      })
      const titleText = h.trafficDensity !== null && h.trafficDensity !== undefined
        ? `${statusTitle} · ${delay}% delay`
        : `Hotspot ${h.id} · ${h.incidentCount} incident(s)`
      const marker = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: titleText,
        label: { text: labelText, color: '#fff', fontSize: '12px', fontWeight: '700' },
        icon: {
          path: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z',
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.5,
          anchor: new google.maps.Point(12, 22),
          labelOrigin: new google.maps.Point(12, 9),
        }
      })
      const clickFn = () => {
        if (onHotspotClick) onHotspotClick(h)
        infoRef.current.setContent(
          `<div style="font-family:sans-serif;font-size:13px;max-width:240px">
            <div style="font-weight:700;color:${color};font-size:14px">${statusTitle}</div>
            <div style="margin-top:4px"><b>Delay:</b> ${h.trafficDensity !== null && h.trafficDensity !== undefined ? `${delay}%` : '-'}</div>
            <div><b>Incidents:</b> ${h.incidentCount ?? h.density ?? 0}</div>
            <div><b>Location:</b> ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}</div>
            <div style="margin-top:6px;color:#475569;font-size:12px">Click the location card for details or use Navigate to open Google Maps.</div>
          </div>`
        )
        infoRef.current.setPosition(pos)
        infoRef.current.open(mapRef.current)
      }
      circle.addListener('click', clickFn)
      marker.addListener('click', clickFn)
      hotspotsRef.current.push(circle)
      hotspotsRef.current.push(marker)
    })
    return () => { hotspotsRef.current.forEach(h => h.setMap(null)); hotspotsRef.current = [] }
  }, [hotspots])

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    const sevColor = { critical: '#dc2626', high: '#ea580c', medium: '#f59e0b', low: '#10b981' }
    incidents.forEach(i => {
      if (!i.location?.coordinates) return
      const pos = { lat: Number(i.location.coordinates[1]), lng: Number(i.location.coordinates[0]) }
      const color = sevColor[i.severity] || '#dc2626'
      const marker = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: i.address,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
          scale: i.status === 'cleared' ? 6 : 11,
        },
      })
      marker.addListener('click', () => {
        infoRef.current.setContent(
          `<div style="font-family:sans-serif;font-size:13px;max-width:240px;">
            <div style="font-weight:bold;color:${color}">${(i.severity || 'medium').toUpperCase()} – ${i.status}</div>
            <div style="font-weight:600;margin-top:4px">${i.address || ''}</div>
            <div>Area: ${i.areaName || '-'}</div>
            <div>Delay: ${i.estimatedDelayMin ?? '-'} min</div>
            <div>Queue: ${i.queueLengthM ? (i.queueLengthM > 1000 ? (i.queueLengthM/1000).toFixed(1)+' km' : i.queueLengthM+' m') : '-'}</div>
            <div style="font-size:11px;color:#666;margin-top:4px">${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}</div>
          </div>`
        )
        infoRef.current.open(mapRef.current, marker)
        if (onIncidentClick) onIncidentClick(i)
      })
      markersRef.current.push(marker)
    })
    families.forEach(f => {
      if (f.lat == null || f.lng == null) return
      const pos = { lat: Number(f.lat), lng: Number(f.lng) }
      const riskColor = { emergency: '#dc2626', high: '#ea580c', medium: '#f59e0b', low: '#22c55e' }[f.riskCategory] || '#22c55e'
      const marker = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: f.seniorName,
        icon: {
          path: 'M -8,-8 L 8,-8 L 8,8 L -8,8 Z',
          fillColor: riskColor,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 1.2,
        },
      })
      marker.addListener('click', () => {
        infoRef.current.setContent(
          `<div style="font-family:sans-serif;font-size:13px;max-width:220px;">
            <div style="font-weight:bold;color:${riskColor}">${f.seniorName} (${f.age || '?'})</div>
            <div>${f.familyCode} · ${(f.riskCategory || 'low').toUpperCase()} risk</div>
            <div style="font-size:12px;color:#444">${f.address || ''}</div>
            <div style="font-size:11px;color:#666;margin-top:4px">${f.mobile || '-'}</div>
          </div>`
        )
        infoRef.current.open(mapRef.current, marker)
      })
      markersRef.current.push(marker)
    })
  }, [incidents, families])

  // Focus map on an incident
  useEffect(() => {
    if (focus && mapRef.current) {
      mapRef.current.panTo({ lat: Number(focus.lat), lng: Number(focus.lng) })
      mapRef.current.setZoom(focus.zoom || 16)
    }
  }, [focus])

  if (!apiKey) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-amber-50 text-amber-700 p-6">
        Google Maps API key missing. Set NEXT_PUBLIC_GOOGLE_MAPS_KEY in .env
      </div>
    )
  }

  return (
    <div style={{ height: '100%', width: '100%', minHeight: 400, position: 'relative' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: 400 }} />
      {hotspots?.length > 0 && (
        <div style={{ position: 'absolute', left: 12, bottom: 12, background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '8px 10px', boxShadow: '0 6px 18px rgba(15,23,42,0.18)', fontFamily: 'sans-serif', fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Traffic Points</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span><b style={{ color: '#dc2626' }}>H</b> Heavy</span>
            <span><b style={{ color: '#f59e0b' }}>M</b> Moderate</span>
            <span><b style={{ color: '#16a34a' }}>C</b> Clear</span>
          </div>
        </div>
      )}
    </div>
  )
}
