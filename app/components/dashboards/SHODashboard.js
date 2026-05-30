'use client'

import { useState, useEffect, useMemo } from 'react'
import { Siren, Radio, AlertTriangle, MapPin, Navigation } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/app/utils/api'
import { getMapUrl, getNavUrl, isPointInsidePolygon, getTrafficDensityRatio } from '@/app/utils/mapUtils'
import { GMAPS_KEY, TRAFFIC_PRIORITY, TRAFFIC_PRIORITY_LABEL, TRAFFIC_STATUS_LABEL, TRAFFIC_SAMPLE_ROUTES } from '@/app/constants/traffic'
import PhotoUploader from '@/app/components/shared/PhotoUploader'
import getLoader from '@/lib/googleMapsLoader'
import dynamic from 'next/dynamic'

const GoogleMapView = dynamic(() => import('@/components/GoogleMapView'), { ssr: false })

export default function SHODashboard({ user }) {
  const [marshals, setMarshals] = useState([])
  const [zones, setZones] = useState([])
  const [assignedTps, setAssignedTps] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [pendingJam, setPendingJam] = useState(null)
  const [dispatchInfo, setDispatchInfo] = useState(null)
  const [severity, setSeverity] = useState('high')
  const [address, setAddress] = useState('')
  const [photo, setPhoto] = useState(null)
  const [mapFocus, setMapFocus] = useState(null)
  const [nearestMarshals, setNearestMarshals] = useState([])
  const [assigningMarshalId, setAssigningMarshalId] = useState('')
  const [selectedResponder, setSelectedResponder] = useState(null)

  const normalizeText = (value) => String(value || '').trim().toLowerCase()

  const distanceKmBetween = (lat1, lng1, lat2, lng2) => {
    const dLat = (Number(lat1) - Number(lat2)) * 111
    const dLng = (Number(lng1) - Number(lng2)) * (111 * Math.cos((Number(lat1) * Math.PI) / 180))
    return Math.sqrt((dLat * dLat) + (dLng * dLng))
  }

  const loadAll = async () => {
    try {
      const [m, z, i] = await Promise.all([
        api('/marshals'), api(`/sho/${user.id}/tps`), api('/incidents'),
      ])
      setMarshals(m?.marshals || [])
      setZones(z?.zones || [])
      setAssignedTps(z?.tps || null)
      setIncidents(i?.incidents || [])
    } catch (e) { console.error('SHO load error', e) }
  }

  useEffect(() => {
    loadAll()
    const t = setInterval(loadAll, 4000)
    return () => clearInterval(t)
  }, [])

  const assignedZoneName = (assignedTps?.zoneName || zones?.[0]?.zoneName || zones?.[0]?.name || user.zone || '').trim()
  const assignedZoneId = assignedTps?.zoneId || zones?.[0]?.zoneId || user.zoneId || null
  const assignedTpsId = assignedTps?.id || zones?.[0]?.id || user.tpsId || null
  const assignedZonePolygon = zones?.[0]?.polygon
  const zoneCenter = useMemo(() => {
    const poly = assignedZonePolygon
    if (Array.isArray(poly) && poly.length > 0) {
      return poly.reduce(
        (acc, p) => ({ lat: acc.lat + Number(p[0]) / poly.length, lng: acc.lng + Number(p[1]) / poly.length }),
        { lat: 0, lng: 0 }
      )
    }
    if (zones?.[0]?.lat && zones?.[0]?.lng) return { lat: Number(zones[0].lat), lng: Number(zones[0].lng) }
    if (assignedTps?.lat && assignedTps?.lng) return { lat: Number(assignedTps.lat), lng: Number(assignedTps.lng) }
    return { lat: 17.45, lng: 78.52 }
  }, [assignedZonePolygon, zones, assignedTps])

  const handleMapClick = (latlng) => {
    if (zones?.[0]?.polygon?.length >= 3 && window.google?.maps?.geometry?.poly) {
      const point = new window.google.maps.LatLng(latlng.lat, latlng.lng)
      const polygon = new window.google.maps.Polygon({ paths: zones[0].polygon.map(p => ({ lat: Number(p[0]), lng: Number(p[1]) })) })
      if (!window.google.maps.geometry.poly.containsLocation(point, polygon)) {
        return toast.error('Select location inside your assigned zone area only')
      }
    }
    setPendingJam({ lat: latlng.lat, lng: latlng.lng })
    setDispatchInfo(null)
    toast.info('Jam location selected. Fill details and dispatch.')
  }

  const dispatchJam = async () => {
    if (!pendingJam) return
    const r = await api('/incidents', {
      method: 'POST',
      body: JSON.stringify({
        ...pendingJam, address: address || 'Marked by SHO', areaName: address || 'Traffic density location', severity, reportedBy: user.id, photoUrl: photo, manualAssign: true,
      })
    })
    if (r.error) return toast.error(r.error)
    setDispatchInfo({
      incidentId: r.incident.id, lat: pendingJam.lat, lng: pendingJam.lng,
      level: 1, dispatched: 0, manual: true,
    })
    const nm = await api(`/incidents/${r.incident.id}/nearest-marshals?radius=5000`)
    setNearestMarshals(nm?.marshals || [])
    toast.success(`Incident created. Select a marshal manually.`)
    setPhoto(null)
    loadAll()
  }

  const assignMarshal = async (marshalId) => {
    const selected = nearestMarshals.find(m => m.id === marshalId)
    if (!selected) return
    setSelectedResponder({
      id: selected.id,
      name: selected.name,
      role: 'marshal',
      status: selected.status,
      lat: selected.lat,
      lng: selected.lng,
    })
    toast.info(`${selected.name} selected. Click Submit Assignment to confirm.`)
  }

  const assignResponderFromMap = async (unit) => {
    const responderId = unit?.id || unit?.familyCode
    if (!responderId || unit.lat == null || unit.lng == null) return
    const responderName = unit?.name || unit?.seniorName || 'Responder'
    setSelectedResponder({
      id: responderId,
      name: responderName,
      role: unit.role,
      status: unit.status,
      lat: Number(unit.lat),
      lng: Number(unit.lng),
    })
    toast.info(`${responderName} selected. You can change selection and then submit.`)
  }

  const submitSelectedResponderAssignment = async () => {
    if (!selectedResponder?.id) {
      return toast.error('Select a marshal or volunteer first')
    }

    let activeDispatch = dispatchInfo
    if (!activeDispatch?.incidentId) {
      if (!pendingJam) {
        return toast.info('Select a traffic jam from scan list/map first, then click responder marker to assign')
      }
      const createRes = await api('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          ...pendingJam,
          address: address || 'Marked from traffic scan',
          areaName: address || 'Traffic scan hotspot',
          severity,
          reportedBy: user.id,
          photoUrl: photo || null,
          manualAssign: true,
        })
      })
      if (createRes.error) return toast.error(createRes.error)
      activeDispatch = {
        incidentId: createRes.incident.id,
        lat: pendingJam.lat,
        lng: pendingJam.lng,
        level: 1,
        dispatched: 0,
        manual: true,
      }
      setDispatchInfo(activeDispatch)
      toast.success('Traffic jam selected and incident created.')
    }
    const responderId = selectedResponder.id
    const responderName = selectedResponder.name
    if (selectedResponder.lat == null || selectedResponder.lng == null) {
      return toast.error('Selected responder location not available')
    }
    const targetLat = Number(activeDispatch.lat)
    const targetLng = Number(activeDispatch.lng)
    const distKm = distanceKmBetween(selectedResponder.lat, selectedResponder.lng, targetLat, targetLng)
    if (distKm > 10) {
      return toast.error('Select a nearby responder within 10 km of the jam center')
    }
    const status = String(selectedResponder.status || '').toLowerCase()
    if (!['online', 'active'].includes(status)) {
      return toast.error('Selected responder is offline and cannot be assigned')
    }
    setAssigningMarshalId(responderId)
    try {
      if (selectedResponder.role === 'volunteer') {
        const r = await api(`/incidents/${activeDispatch.incidentId}/assist`, {
          method: 'POST',
          body: JSON.stringify({ volunteerId: responderId }),
        })
        if (r.error) return toast.error(r.error)
        setDispatchInfo({
          ...activeDispatch,
          dispatched: 1,
          assignedMarshal: {
            id: responderId,
            name: responderName,
            role: 'volunteer',
            distanceKm: Number.isFinite(distKm) ? distKm.toFixed(2) : null,
          },
        })
        setNearestMarshals([])
        toast.success(`${responderName} (Volunteer) assigned from map`)
      } else {
        const r = await api(`/incidents/${activeDispatch.incidentId}/assign`, {
          method: 'POST',
          body: JSON.stringify({ marshalId: responderId, level: activeDispatch.level || 1 }),
        })
        if (r.error) return toast.error(r.error)
        setDispatchInfo({ ...activeDispatch, dispatched: 1, assignedMarshal: { ...r.assigned, role: 'marshal' } })
        setNearestMarshals([])
        toast.success(`${r.assigned.name} (Marshal) assigned from map`)
      }
      setSelectedResponder(null)
      loadAll()
    } finally {
      setAssigningMarshalId('')
    }
  }

  const escalate = async () => {
    if (!dispatchInfo) return
    const r = await api(`/incidents/${dispatchInfo.incidentId}/escalate`, { method: 'POST' })
    setDispatchInfo({ ...dispatchInfo, level: r.level, dispatched: (dispatchInfo.dispatched + (r.dispatch.dispatched || 0)) })
    toast.success(`Escalated to Level ${r.level} (${r.level === 2 ? '3 km' : '5 km'}). +${r.dispatch.dispatched} alerts.`)
    loadAll()
  }

  const cancelJam = () => { setPendingJam(null); setDispatchInfo(null); setNearestMarshals([]); setAssigningMarshalId(''); setSelectedResponder(null) }

  const shoIncidents = useMemo(() => {
    const polygon = assignedZonePolygon
    return incidents.filter(i => {
      if (i.reportedBy === user.id) return true
      if (!i.location) return false
      if (!polygon || polygon.length < 3) return true
      return isPointInsidePolygon({ lat: i.location.coordinates[1], lng: i.location.coordinates[0] }, polygon)
    })
  }, [incidents, assignedZonePolygon, user.id])

  const shoMarshals = useMemo(() => {
    if (!assignedZoneName && !assignedTpsId && !assignedZoneId) return []
    return marshals.filter(m => {
      if (m.role !== 'marshal') return false
      const tpsMatches = assignedTpsId ? [m.tpsId, m.psId].some(id => String(id || '') === String(assignedTpsId)) : false
      const zoneMatches = assignedZoneId ? String(m.zoneId || '') === String(assignedZoneId) : false
      const legacyZoneMatches = assignedZoneName ? normalizeText(m.zone) === normalizeText(assignedZoneName) : false
      return tpsMatches || zoneMatches || legacyZoneMatches
    })
  }, [marshals, assignedZoneName, assignedZoneId, assignedTpsId])

  const nearbyVolunteers = useMemo(() => {
    const centerLat = Number(zoneCenter.lat)
    const centerLng = Number(zoneCenter.lng)
    const nearKm = 10
    return marshals.filter(m => {
      if (m.role !== 'volunteer') return false
      const coords = m.currentLocation?.coordinates
      if (!coords) return false
      const lat = Number(coords[1])
      const lng = Number(coords[0])
      const dLat = (lat - centerLat) * 111
      const dLng = (lng - centerLng) * (111 * Math.cos((centerLat * Math.PI) / 180))
      return Math.sqrt((dLat * dLat) + (dLng * dLng)) <= nearKm
    })
  }, [marshals, zoneCenter])

  const mapUnits = useMemo(() => ([...shoMarshals, ...nearbyVolunteers]), [shoMarshals, nearbyVolunteers])

  // Traffic density grid: divide TPS area into 5x5 cells and compute incident density
  const trafficGrid = useMemo(() => {
    const grid = []
    const cellSize = 0.006
    if (!zones || zones.length === 0) return grid
    const poly = zones[0]?.polygon
    const center = poly?.length
      ? poly.reduce((acc, p) => ({ lat: acc.lat + Number(p[0]) / poly.length, lng: acc.lng + Number(p[1]) / poly.length }), { lat: 0, lng: 0 })
      : { lat: assignedTps?.lat || 17.45, lng: assignedTps?.lng || 78.52 }
    const centerLat = center.lat
    const centerLng = center.lng
    for (let i = 0; i < 25; i++) {
      const row = Math.floor(i / 5)
      const col = i % 5
      const lat = centerLat + (row - 2) * cellSize
      const lng = centerLng + (col - 2) * cellSize
      if (!isPointInsidePolygon({ lat, lng }, zones[0]?.polygon)) continue
      const incidentCount = shoIncidents.filter(inc => inc.location && Math.abs(inc.location.coordinates[1] - lat) < cellSize / 2 && Math.abs(inc.location.coordinates[0] - lng) < cellSize / 2).length
      grid.push({
        id: i,
        lat,
        lng,
        incidentCount,
        trafficDensity: null,
        trafficStatus: 'unknown',
        severity: incidentCount > 3 ? 'critical' : incidentCount > 1 ? 'high' : 'low'
      })
    }
    return grid
  }, [shoIncidents, zones, assignedTps])

  // Live traffic scan state (DirectionsService based)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 })
  const [congestionMap, setCongestionMap] = useState({}) // key -> ratio
  const [statusMap, setStatusMap] = useState({}) // key -> 'heavy'|'moderate'|'clear'
  const [scanFilter, setScanFilter] = useState('all') // all | heavy | moderate
  const [lastScanAt, setLastScanAt] = useState(null)

  // Scan traffic density across the computed grid using Google DirectionsService
  const scanTrafficGrid = async () => {
    if (!GMAPS_KEY) return toast.error('Google Maps API key missing')
    if (!trafficGrid || trafficGrid.length === 0) return toast.error('No grid to scan')
    setScanning(true)
    setScanProgress({ done: 0, total: trafficGrid.length })
    try {
      const google = await getLoader(GMAPS_KEY)
      const newCong = {}
      const newStatus = {}
      let unavailable = 0
      let done = 0

      const dirSvc = google.maps?.DirectionsService ? new google.maps.DirectionsService() : null
      if (!dirSvc) throw new Error('DirectionsService unavailable')

      const processCell = async (cell) => {
        try {
          const key = `${cell.lat},${cell.lng}`
          const samples = await Promise.allSettled(
            TRAFFIC_SAMPLE_ROUTES.map(route => getTrafficDensityRatio(google, dirSvc, cell.lat, cell.lng, route))
          )
          const ratios = samples
            .filter(result => result.status === 'fulfilled' && typeof result.value === 'number')
            .map(result => result.value)
          if (!ratios.length) {
            unavailable++
          } else {
            const average = ratios.reduce((a, b) => a + b, 0) / ratios.length
            newCong[key] = average
            if (average >= 1.12) newStatus[key] = 'heavy'
            else if (average >= 1.04) newStatus[key] = 'moderate'
            else newStatus[key] = 'clear'
          }
        } catch (cellError) {
          console.warn('Traffic scan cell failed', cellError)
          unavailable++
        } finally {
          done++
          setScanProgress({ done, total: trafficGrid.length })
        }
      }

      for (const cell of trafficGrid) {
        await processCell(cell)
        await new Promise(r => setTimeout(r, 80))
      }

      setCongestionMap(newCong)
      setStatusMap(newStatus)
      setLastScanAt(new Date())
      const heavyCount = Object.values(newStatus).filter(s => s === 'heavy').length
      toast.success(`Live vehicle movement scan complete — ${heavyCount} heavy, ${Object.values(newStatus).filter(s => s === 'moderate').length} moderate${unavailable ? `, ${unavailable} unavailable` : ''}`)
    } catch (e) {
      console.error('Scan error', e)
      toast.error('Traffic scan failed')
    }
    setScanning(false)
  }

  // derive hotspots passed to map: prefer live scan status if available
  const hotspotsForMap = (trafficGrid || []).map(c => {
    const key = `${c.lat},${c.lng}`
    const ratio = congestionMap[key]
    const trafficDensity = typeof ratio === 'number' ? Math.max(0, Math.round((ratio - 1) * 100)) : null
    const incidentCount = c.incidentCount || 0
    const densityLabel = trafficDensity !== null ? trafficDensity : incidentCount
    const severity = statusMap[key]
      ? (statusMap[key] === 'heavy' ? 'critical' : statusMap[key] === 'moderate' ? 'high' : 'low')
      : c.severity
    const status = statusMap[key] || 'unknown'
    const priority = TRAFFIC_PRIORITY[status] || 3
    return {
      ...c,
      incidentCount,
      trafficDensity,
      density: densityLabel,
      densityType: trafficDensity !== null ? 'delay' : 'incidents',
      severity,
      status,
      priority,
      priorityLabel: TRAFFIC_PRIORITY_LABEL[priority],
      statusLabel: TRAFFIC_STATUS_LABEL[status] || '—',
    }
  })

  const heavyCount = Object.values(statusMap).filter(s => s === 'heavy').length
  const moderateCount = Object.values(statusMap).filter(s => s === 'moderate').length
  const clearCount = Object.values(statusMap).filter(s => s === 'clear').length
  const scannedRatios = Object.values(congestionMap).filter(v => typeof v === 'number')
  const avgDelayPct = scannedRatios.length ? Math.round(((scannedRatios.reduce((a, b) => a + b, 0) / scannedRatios.length) - 1) * 100) : 0
  const maxDelayPct = scannedRatios.length ? Math.round((Math.max(...scannedRatios) - 1) * 100) : 0
  const liveTrafficStatus = heavyCount > 0 ? 'Heavy congestion' : moderateCount > 0 ? 'Moderate congestion' : scannedRatios.length ? 'Clear traffic' : 'Not scanned'
  const visibleHotspots = hotspotsForMap.filter(c => c.trafficDensity !== null || c.density > 0).filter(c => {
    if (scanFilter === 'all') return true
    const key = `${c.lat},${c.lng}`
    if (scanFilter === 'heavy') return statusMap[key] === 'heavy'
    if (scanFilter === 'moderate') return statusMap[key] === 'moderate'
    return true
  }).sort((a,b) => b.density - a.density)
  const heavyTrafficPlaces = hotspotsForMap.filter(c => c.status === 'heavy').sort((a, b) => b.density - a.density)
  const mapCenter = zoneCenter
  const visibleIncidents = shoIncidents
  const navigateToGrid = (lat, lng) => {
    window.open(getNavUrl(lat, lng), '_blank')
  }
  const selectTrafficGrid = (c) => {
    setPendingJam({ lat: c.lat, lng: c.lng })
    setDispatchInfo(null)
    setSelectedResponder(null)
    setMapFocus({ lat: c.lat, lng: c.lng, zoom: 16 })
    setSeverity(c.status === 'heavy' ? 'critical' : c.status === 'moderate' ? 'high' : 'medium')
    setAddress(`Grid #${c.id + 1} · ${c.priorityLabel} · ${c.statusLabel}${c.trafficDensity !== null ? ` · +${c.trafficDensity}% delay` : ''}`)
    toast.info('Selected traffic density grid. Now click a marshal/volunteer marker to assign.')
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-800 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-indigo-200 font-semibold">Traffic SHO Live Desk</div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{assignedZoneName || 'Assigned Zone'}</div>
            <div className="text-xs text-indigo-200 mt-1">Zone monitoring · Real-time jam dispatch and density scan</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs w-full sm:w-auto">
            <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-indigo-200">Marshals</div>
              <div className="font-bold text-base">{shoMarshals.length}</div>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-indigo-200">Incidents</div>
              <div className="font-bold text-base">{visibleIncidents.length}</div>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-indigo-200">Heavy</div>
              <div className="font-bold text-base">{heavyCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr),420px] lg:grid-cols-[minmax(0,1fr),380px] gap-4 min-h-[calc(100vh-170px)]">
      <div className="relative rounded-xl overflow-hidden border shadow-sm h-[54vw] min-h-[340px] max-h-[620px] lg:h-auto lg:max-h-none">
        <GoogleMapView
          apiKey={GMAPS_KEY}
          incidents={visibleIncidents}
          polygons={zones}
          focus={mapFocus}
          hotspots={visibleHotspots}
          onHotspotClick={selectTrafficGrid}
          families={mapUnits.filter(m => m.currentLocation?.coordinates).map(m => ({
            id: m.id,
            name: m.name,
            lat: m.currentLocation.coordinates[1],
            lng: m.currentLocation.coordinates[0],
            seniorName: m.name,
            riskCategory: `${m.role}_${m.status === 'offline' ? 'offline' : 'online'}`,
            familyCode: m.id,
            role: m.role,
            status: m.status,
          }))}
          onFamilyClick={assignResponderFromMap}
          onMapClick={handleMapClick}
          dispatchHighlight={dispatchInfo || (pendingJam ? { ...pendingJam, level: 0 } : null)}
          center={mapCenter}
          zoom={14}
          fitToPolygons
        />
        <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-lg px-3 py-2 shadow flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600" /> Marshal Online</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-800" /> Marshal Offline</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600" /> Volunteer Online</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400" /> Volunteer Offline</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600" /> Jam</span>
        </div>
      </div>
      <div className="space-y-3 overflow-auto lg:max-h-[calc(100vh-170px)] pr-0 lg:pr-1">
        <Card className="border-0 shadow-sm bg-white/95 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><Siren className="h-5 w-5 text-red-600" /> Mark Traffic Jam</CardTitle>
            <CardDescription>Only your assigned zone area is shown. Mark jams inside this boundary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!pendingJam && <p className="text-sm text-slate-500">No location selected. Click on the map.</p>}
            {pendingJam && (
              <>
                <div className="text-xs bg-slate-100 p-2 rounded font-mono">
                  📍 {pendingJam.lat.toFixed(5)}, {pendingJam.lng.toFixed(5)}
                </div>
                <Input placeholder="Address / Landmark" value={address} onChange={e => setAddress(e.target.value)} />
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                {selectedResponder && (
                  <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                    Selected: <span className="font-semibold">{selectedResponder.name}</span> ({selectedResponder.role})
                  </div>
                )}
                <PhotoUploader value={photo} onChange={setPhoto} label="Attach photo of jam" />
                {!dispatchInfo && (
                  <div className="flex gap-2">
                    <Button onClick={dispatchJam} className="flex-1 bg-red-600 hover:bg-red-700">
                      <Siren className="h-4 w-4 mr-1" /> Find Nearest Marshals
                    </Button>
                    <Button variant="outline" onClick={cancelJam}>Cancel</Button>
                  </div>
                )}
                {dispatchInfo && (
                  <div className="space-y-2">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
                      <div className="font-semibold flex items-center gap-1"><Radio className="h-4 w-4" /> Manual Marshal Assignment</div>
                      <div>{dispatchInfo.assignedMarshal ? `${dispatchInfo.assignedMarshal.name} assigned and notified` : 'Select one responder (map or list), then submit assignment'}</div>
                    </div>
                    {!dispatchInfo.assignedMarshal && selectedResponder && (
                      <div className="rounded border border-sky-200 bg-sky-50 p-3 text-xs">
                        <div className="font-semibold text-sky-800">Selected Responder</div>
                        <div className="mt-1 text-slate-700">{selectedResponder.name} · {selectedResponder.role} · {selectedResponder.status || 'unknown'}</div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={submitSelectedResponderAssignment}
                            disabled={assigningMarshalId === selectedResponder.id}
                          >
                            {assigningMarshalId === selectedResponder.id ? 'Assigning...' : 'Submit Assignment'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedResponder(null)}>Change Person</Button>
                        </div>
                      </div>
                    )}
                    {!dispatchInfo.assignedMarshal && (
                      <div className="space-y-2">
                        {nearestMarshals.map(m => (
                          <div key={m.id} className="flex items-center justify-between gap-2 rounded border bg-white p-2 text-xs">
                            <div>
                              <div className="font-semibold">{m.name}</div>
                              <div className="text-slate-500">{m.status} · {m.distanceKm} km away</div>
                            </div>
                            <Button size="sm" onClick={() => assignMarshal(m.id)} disabled={assigningMarshalId === m.id}>
                              Select
                            </Button>
                          </div>
                        ))}
                        {!nearestMarshals.length && <div className="text-xs text-slate-500 text-center border rounded p-3">No available marshal found within 5 km.</div>}
                      </div>
                    )}
                    {dispatchInfo.assignedMarshal && dispatchInfo.level < 3 && (
                      <Button variant="outline" onClick={escalate} className="w-full">
                        <AlertTriangle className="h-4 w-4 mr-1" /> Escalate to Level {dispatchInfo.level + 1} ({dispatchInfo.level === 1 ? '3 km' : '5 km'})
                      </Button>
                    )}
                    <Button variant="ghost" onClick={cancelJam} className="w-full">Done / Mark New</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-900 to-indigo-950 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Traffic Scan Summary</CardTitle>
            <CardDescription>Live Google traffic analytics inside your mapped police station area</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-indigo-300">Mapped Area</div>
                  <div className="text-sm font-semibold text-white">{assignedZoneName || 'Assigned Zone'}</div>
                  <div className="text-xs text-indigo-300">Zone operations</div>
                </div>
                <Badge className={liveTrafficStatus === 'Heavy congestion' ? 'bg-red-600' : liveTrafficStatus === 'Moderate congestion' ? 'bg-amber-500' : liveTrafficStatus === 'Clear traffic' ? 'bg-emerald-600' : 'bg-slate-500'}>
                  {liveTrafficStatus}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                <div>
                  <div className="font-bold text-white">{scannedRatios.length}</div>
                  <div className="text-indigo-300">Grids scanned</div>
                </div>
                <div>
                  <div className="font-bold text-white">+{avgDelayPct}%</div>
                  <div className="text-indigo-300">Avg delay</div>
                </div>
                <div>
                  <div className="font-bold text-white">+{maxDelayPct}%</div>
                  <div className="text-indigo-300">Max delay</div>
                </div>
              </div>
              <div className="text-[10px] text-indigo-300 mt-2">
                Last scan: {lastScanAt ? lastScanAt.toLocaleString('en-IN') : 'Not scanned yet'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-red-500/25 bg-red-500/15 p-2">
                <div className="text-lg font-bold text-red-300">{heavyCount}</div>
                <div className="text-[10px] text-red-300">Heavy</div>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/15 p-2">
                <div className="text-lg font-bold text-amber-300">{moderateCount}</div>
                <div className="text-[10px] text-amber-300">Moderate</div>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/15 p-2">
                <div className="text-lg font-bold text-emerald-300">{clearCount}</div>
                <div className="text-[10px] text-emerald-300">Clear</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2 text-indigo-200">Current Heavy Traffic Places</div>
              <div className="space-y-2 max-h-36 overflow-auto">
                {heavyTrafficPlaces.map(c => (
                  <button key={c.id} type="button" onClick={() => selectTrafficGrid(c)} className="w-full text-left rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs hover:bg-red-500/20">
                    <div className="font-semibold text-red-700">🚨 Grid #{c.id + 1}</div>
                    <div className="text-indigo-100">Lat: {c.lat.toFixed(6)}, Lng: {c.lng.toFixed(6)}{c.trafficDensity !== null ? ` (${c.trafficDensity}% delay)` : ''}</div>
                  </button>
                ))}
                {!heavyTrafficPlaces.length && <div className="text-center text-xs text-indigo-300 py-4">No heavy traffic detected. Run a scan to check.</div>}
              </div>
            </div>
          </CardContent>
        </Card>
          <Card className="border-0 shadow-sm bg-white/95 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Traffic Hotspots</CardTitle>
                  <div className="text-xs text-slate-600 shrink-0">Scanned: <span className="font-semibold">{heavyCount}</span> heavy · <span className="font-semibold">{moderateCount}</span> moderate</div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="grid grid-cols-3 gap-1 rounded bg-slate-50 p-1 flex-1">
                    <Button size="sm" className="w-full" variant={scanFilter === 'all' ? undefined : 'ghost'} onClick={() => setScanFilter('all')}>All</Button>
                    <Button size="sm" className="w-full whitespace-nowrap" variant={scanFilter === 'heavy' ? undefined : 'ghost'} onClick={() => setScanFilter('heavy')}>Heavy</Button>
                    <Button size="sm" className="w-full whitespace-nowrap" variant={scanFilter === 'moderate' ? undefined : 'ghost'} onClick={() => setScanFilter('moderate')}>Moderate</Button>
                  </div>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto sm:min-w-[170px]" onClick={scanTrafficGrid} disabled={scanning}>
                    {scanning ? `Scanning ${scanProgress.done}/${scanProgress.total}` : '🔍 Scan Density'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleHotspots.map(c => (
                <div key={c.id}
                  className="w-full px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <div className="flex-1">
                    <div className="font-medium flex flex-wrap items-center gap-2">
                      <span>Grid #{c.id + 1}</span>
                      <Badge variant={c.priority === 1 ? 'destructive' : c.priority === 2 ? 'secondary' : 'outline'} className="text-[10px]">{c.priorityLabel}</Badge>
                      <Badge className={`text-[10px] ${c.status === 'heavy' ? 'bg-red-600' : c.status === 'moderate' ? 'bg-amber-500' : c.status === 'clear' ? 'bg-emerald-600' : 'bg-slate-500'}`}>{c.statusLabel}</Badge>
                    </div>
                    <div className="text-xxs text-slate-500">
                      {c.trafficDensity !== null ? `+${c.trafficDensity}% delay` : `${c.incidentCount} incident${c.incidentCount === 1 ? '' : 's'}`}
                    </div>
                    {c.trafficDensity !== null && (
                      <div className="mt-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div className={`h-full ${c.status === 'heavy' ? 'bg-red-600' : c.status === 'moderate' ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, c.trafficDensity * 1.5)}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:justify-end">
                    <div className="text-slate-400 text-xs w-full sm:w-auto">{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</div>
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => selectTrafficGrid(c)}>Select</Button>
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => window.open(getMapUrl(c.lat, c.lng), '_blank')}><MapPin className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => navigateToGrid(c.lat, c.lng)}><Navigation className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              {!visibleHotspots.length && <div className="text-xs text-slate-500">No hotspots detected</div>}
            </CardContent>
          </Card>
        <Card className="border-0 shadow-sm bg-white/95 backdrop-blur">
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent Incidents</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-auto">
            {visibleIncidents.slice(0, 10).map(i => (
              <div key={i.id} className="text-xs border rounded p-2 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{i.address}</div>
                    <div className="text-slate-500">{new Date(i.createdAt).toLocaleTimeString()} · {i.severity}</div>
                  </div>
                  <Badge variant={i.status === 'cleared' ? 'default' : i.status === 'dispatched' ? 'secondary' : 'destructive'}>{i.status}</Badge>
                </div>
                {i.photoUrl && <img src={i.photoUrl} alt="jam" className="w-full h-24 object-cover rounded" />}
              </div>
            ))}
            {!visibleIncidents.length && <p className="text-xs text-slate-500">No incidents yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  )
}
