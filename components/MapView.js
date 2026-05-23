'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function colorIcon(color, label) {
  return L.divIcon({
    className: 'custom-marshal-icon',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function jamIcon() {
  return L.divIcon({
    className: 'custom-jam-icon',
    html: `<div style="background:#dc2626;width:34px;height:34px;border-radius:50%;border:4px solid #fff;box-shadow:0 0 0 4px rgba(220,38,38,.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">!</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function HeatmapLayer({ points }) {
  const map = useMap()
  const layerRef = useRef(null)
  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }
    if (!points || points.length === 0) return
    layerRef.current = L.heatLayer(points, { radius: 35, blur: 25, maxZoom: 17, max: 1.0,
      gradient: { 0.2: '#22c55e', 0.4: '#facc15', 0.7: '#f97316', 1.0: '#dc2626' }
    }).addTo(map)
    return () => { if (layerRef.current) map.removeLayer(layerRef.current) }
  }, [map, points])
  return null
}

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) { if (onClick) onClick(e.latlng) }
  })
  return null
}

const statusColor = (s) => s === 'active' ? '#22c55e' : s === 'online' ? '#3b82f6' : '#9ca3af'
const roleLabel = (r) => r === 'marshal' ? 'M' : 'V'

export default function MapView({
  marshals = [], zones = [], incidents = [], onMapClick, dispatchHighlight = null,
  center = [17.45, 78.52], zoom = 12, showHeatmap = true,
}) {
  // Heatmap from marshal density (active+online weighted higher)
  const heatPoints = marshals
    .filter(m => m.status !== 'offline')
    .map(m => [
      m.currentLocation.coordinates[1],
      m.currentLocation.coordinates[0],
      m.status === 'active' ? 1.0 : 0.6,
    ])

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {showHeatmap && <HeatmapLayer points={heatPoints} />}

      {zones.map((z, i) => (
        <Polygon key={i} positions={z.polygon} pathOptions={{ color: z.color, weight: 2, fillOpacity: 0.08 }}>
          <Popup><strong>{z.name}</strong> Zone</Popup>
        </Polygon>
      ))}

      {marshals.map(m => (
        <Marker
          key={m.id}
          position={[m.currentLocation.coordinates[1], m.currentLocation.coordinates[0]]}
          icon={colorIcon(statusColor(m.status), roleLabel(m.role))}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold">{m.name}</div>
              <div>Role: {m.role}</div>
              <div>Zone: {m.zone}</div>
              <div>Status: <span style={{color: statusColor(m.status)}}>{m.status.toUpperCase()}</span></div>
              <div>Points: {m.points || 0}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {incidents.filter(i => i.status !== 'cleared').map(i => (
        <Marker key={i.id} position={[i.location.coordinates[1], i.location.coordinates[0]]} icon={jamIcon()}>
          <Popup>
            <div className="text-sm">
              <div className="font-bold text-red-600">TRAFFIC JAM</div>
              <div>{i.address}</div>
              <div>Severity: {i.severity}</div>
              <div>Level: {i.level}</div>
              <div>Status: {i.status}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {dispatchHighlight && (
        <>
          <Circle center={[dispatchHighlight.lat, dispatchHighlight.lng]} radius={1000} pathOptions={{ color: '#22c55e', fillOpacity: 0.05 }} />
          {dispatchHighlight.level >= 2 && <Circle center={[dispatchHighlight.lat, dispatchHighlight.lng]} radius={3000} pathOptions={{ color: '#f59e0b', fillOpacity: 0.05 }} />}
          {dispatchHighlight.level >= 3 && <Circle center={[dispatchHighlight.lat, dispatchHighlight.lng]} radius={5000} pathOptions={{ color: '#ef4444', fillOpacity: 0.05 }} />}
        </>
      )}

      {onMapClick && <ClickHandler onClick={onMapClick} />}
    </MapContainer>
  )
}
