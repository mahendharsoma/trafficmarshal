'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Siren, Heart } from 'lucide-react'

// Import extracted components
import LoginScreen from '@/app/components/auth/LoginScreen'
import AppHeader from '@/app/components/layout/AppHeader'
import SHODashboard from '@/app/components/dashboards/SHODashboard'
import MarshalDashboard from '@/app/components/dashboards/MarshalDashboard'
import VolunteerDashboard from '@/app/components/dashboards/VolunteerDashboard'
import AdminDashboard from '@/app/components/dashboards/AdminDashboard'
import FamilyManagement from '@/app/components/tabs/FamilyManagement'

// Import DCPDashboard and all embedded components from backup (Keep embedded for now - large component)
import dynamic from 'next/dynamic'

// Note: DCPDashboard is kept in original format below due to complexity
// It contains FamilyManagement, EscalationsTab, and AssignedVisitsCard embedded
// These can be extracted in a future refactoring phase

import { useEffect as useEffect2, useState as useState2, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs as Tabs2, TabsContent as TabsContent2, TabsList as TabsList2, TabsTrigger as TabsTrigger2 } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ShieldAlert, MapPin, Users, Activity, Trophy, LogOut, Siren as SirenIcon, Navigation, CheckCircle2, AlertTriangle, Radio, BarChart3, Clock, Camera, Image as ImageIcon, Plus, Pencil, Trash2, UserPlus, FileText, Heart as HeartIcon, Building2, ShieldCheck, Stethoscope, Calendar, Bell, ExternalLink, Eye } from 'lucide-react'

const GoogleMapView = dynamic(() => import('@/components/GoogleMapView'), { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-100">Loading map…</div> })
const GoogleMapPolygonEditor = dynamic(() => import('@/components/GoogleMapPolygonEditor'), { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-100">Loading editor…</div> })

// Import constants and utilities from extracted files
import { GMAPS_KEY, TRAFFIC_PRIORITY, TRAFFIC_PRIORITY_LABEL, TRAFFIC_STATUS_LABEL, TRAFFIC_SAMPLE_ROUTES } from '@/app/constants/traffic'
import { api } from '@/app/utils/api'
import { getMapUrl, getNavUrl, getTrafficDensityRatio } from '@/app/utils/mapUtils'
import { compressImage, watermarkPhoto } from '@/app/utils/imageUtils'
import { exportCSV } from '@/app/utils/exportUtils'
import getLoader from '@/lib/googleMapsLoader'

// Keep legacy helper for compatibility
const isPointInsidePolygon = (point, polygon) => {
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

function PhotoUploader({ value, onChange, label = 'Add Photo' }) {
  const [busy, setBusy] = useState(false)
  const handle = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const b64 = f.type.startsWith('video/')
        ? await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(f)
          })
        : await compressImage(f)
      onChange(b64)
    } catch (err) { toast.error('Upload failed') }
    setBusy(false)
  }
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative">
          {String(value).startsWith('data:video/')
            ? <video src={value} controls className="w-full h-32 object-cover rounded border" />
            : <img src={value} alt="upload" className="w-full h-32 object-cover rounded border" />}
          <Button type="button" size="sm" variant="destructive" className="absolute top-1 right-1 h-6 px-2 text-xs" onClick={() => onChange(null)}>Remove</Button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
          <Camera className="h-4 w-4" />
          {busy ? 'Compressing...' : label}
          <input type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handle} disabled={busy} />
        </label>
      )}
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      if (!r) return toast.error('No response from server. Check database/API configuration.')
      if (r.error) return toast.error(r.error)
      if (!r.user) return toast.error('Login response missing user details')
      localStorage.setItem('mksc_user', JSON.stringify(r.user))
      onLogin(r.user)
      toast.success(`Welcome ${r.user.name}`)
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const seed = async () => {
    const r = await api('/seed', { method: 'POST' })
    toast.success(r.seeded ? `Seeded ${r.users} users & ${r.marshals} marshals` : r.msg)
  }

  const quickFill = (u, p) => { setUsername(u); setPassword(p) }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-6 items-center">
        <div className="text-white space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-3 rounded-xl"><ShieldAlert className="h-8 w-8" /></div>
            <div>
              <h1 className="text-3xl font-bold">MKSC Control Center</h1>
              <p className="text-blue-200">Malkajgiri Police Commissionerate</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold">Traffic Marshal Coordination System</h2>
          <p className="text-blue-100">Real-time deployment, proximity dispatch, and live attendance for Begumpet, Alwal, Thirumalgiri & Uppal zones.</p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Feature icon={<MapPin className="h-5 w-5" />} text="Live Heatmap & Markers" />
            <Feature icon={<Siren className="h-5 w-5" />} text="Tiered Proximity Dispatch" />
            <Feature icon={<Activity className="h-5 w-5" />} text="Attendance Logs" />
            <Feature icon={<Trophy className="h-5 w-5" />} text="Performance Rewards" />
          </div>
        </div>
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Login with your MKSC credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. rksc / sho1 / marshal1" required />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <div className="mt-5 text-xs space-y-2">
              <p className="font-semibold text-slate-700">Demo accounts (click to fill):</p>
              <div className="grid grid-cols-2 gap-1.5">
                <DemoBtn onClick={() => quickFill('rksc', 'rksc123')} label="Super Admin (rksc)" />
                <DemoBtn onClick={() => quickFill('dcp1', 'dcp123')} label="DCP Malkajgiri" />
                <DemoBtn onClick={() => quickFill('sho1', 'sho123')} label="SHO Begumpet" />
                <DemoBtn onClick={() => quickFill('marshal1', 'marshal123')} label="Marshal #1" />
                <DemoBtn onClick={() => quickFill('volunteer1', 'volunteer123')} label="Volunteer #1" />
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={seed}>
                Seed Demo Data (run once)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const Feature = ({ icon, text }) => (
  <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur">
    {icon}<span className="text-sm">{text}</span>
  </div>
)
const DemoBtn = ({ onClick, label }) => (
  <button type="button" onClick={onClick} className="text-left px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 truncate">{label}</button>
)

// ----- HEADER -----
function AppHeader({ user, onLogout }) {
  const roleColor = { super_admin: 'bg-purple-600', dcp: 'bg-indigo-600', sho: 'bg-blue-600', marshal: 'bg-green-600', volunteer: 'bg-amber-600' }
  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg"><ShieldAlert className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="font-bold text-lg leading-tight">MKSC Control Center</h1>
            <p className="text-xs text-slate-500">Traffic Marshal Coordination</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`${roleColor[user.role]} text-white`}>{user.role.replace('_', ' ').toUpperCase()}</Badge>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-slate-500">{user.zone}</div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}><LogOut className="h-4 w-4 mr-1" /> Logout</Button>
        </div>
      </div>
    </header>
  )
}

// ----- SHO DASHBOARD -----
function SHODashboard({ user }) {
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
  const [gridFilter, setGridFilter] = useState('')
  const [gridStatusFilter, setGridStatusFilter] = useState('all')
  const [nearestMarshals, setNearestMarshals] = useState([])
  const [assigningMarshalId, setAssigningMarshalId] = useState('')

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

  const handleMapClick = (latlng) => {
    if (zones?.[0]?.polygon?.length >= 3 && window.google?.maps?.geometry?.poly) {
      const point = new window.google.maps.LatLng(latlng.lat, latlng.lng)
      const polygon = new window.google.maps.Polygon({ paths: zones[0].polygon.map(p => ({ lat: Number(p[0]), lng: Number(p[1]) })) })
      if (!window.google.maps.geometry.poly.containsLocation(point, polygon)) {
        return toast.error('Select location inside your assigned Traffic Police Station area only')
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
    if (!dispatchInfo?.incidentId || !marshalId) return
    setAssigningMarshalId(marshalId)
    const r = await api(`/incidents/${dispatchInfo.incidentId}/assign`, { method: 'POST', body: JSON.stringify({ marshalId, level: dispatchInfo.level || 1 }) })
    setAssigningMarshalId('')
    if (r.error) return toast.error(r.error)
    setDispatchInfo({ ...dispatchInfo, dispatched: 1, assignedMarshal: r.assigned })
    setNearestMarshals([])
    toast.success(`${r.assigned.name} assigned and notified`)
    loadAll()
  }

  const escalate = async () => {
    if (!dispatchInfo) return
    const r = await api(`/incidents/${dispatchInfo.incidentId}/escalate`, { method: 'POST' })
    setDispatchInfo({ ...dispatchInfo, level: r.level, dispatched: (dispatchInfo.dispatched + (r.dispatch.dispatched || 0)) })
    toast.success(`Escalated to Level ${r.level} (${r.level === 2 ? '3 km' : '5 km'}). +${r.dispatch.dispatched} alerts.`)
    loadAll()
  }

  const cancelJam = () => { setPendingJam(null); setDispatchInfo(null); setNearestMarshals([]); setAssigningMarshalId('') }

  const shoIncidents = useMemo(() => {
    if (!assignedTps?.id) return []
    const polygon = zones?.[0]?.polygon
    return incidents.filter(i => {
      const belongsToTps = i.tpsId === assignedTps.id || i.psId === assignedTps.id || i.reportedBy === user.id
      if (!belongsToTps || !i.location) return false
      return isPointInsidePolygon({ lat: i.location.coordinates[1], lng: i.location.coordinates[0] }, polygon)
    })
  }, [incidents, assignedTps, user.id, zones])

  const shoMarshals = useMemo(() => {
    if (!assignedTps?.id) return []
    const polygon = zones?.[0]?.polygon
    return marshals.filter(m => {
      const belongsToTps = m.tpsId === assignedTps.id || m.zone === assignedTps.zoneName
      const coords = m.currentLocation?.coordinates
      return belongsToTps && (!coords || isPointInsidePolygon({ lat: coords[1], lng: coords[0] }, polygon))
    })
  }, [marshals, assignedTps, zones])

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
      const dirSvc = new google.maps.DirectionsService()
      const newCong = {}
      const newStatus = {}
      let unavailable = 0
      let done = 0

      const concurrency = 4

      const processCell = async (cell, globalIdx) => {
        const key = `${cell.lat},${cell.lng}`
        const samples = await Promise.all(TRAFFIC_SAMPLE_ROUTES.map(route => getTrafficDensityRatio(google, dirSvc, cell.lat, cell.lng, route)))
        const ratios = samples.filter(v => typeof v === 'number')
        if (!ratios.length) {
          unavailable++
          done++
          setScanProgress({ done, total: trafficGrid.length })
          return
        }
        const average = ratios.reduce((a, b) => a + b, 0) / ratios.length
        newCong[key] = average
        if (average >= 1.12) newStatus[key] = 'heavy'
        else if (average >= 1.04) newStatus[key] = 'moderate'
        else newStatus[key] = 'clear'
        done++
        setScanProgress({ done, total: trafficGrid.length })
      }

      for (let i = 0; i < trafficGrid.length; i += concurrency) {
        const batch = trafficGrid.slice(i, i + concurrency)
        await Promise.all(batch.map((cell, j) => processCell(cell, i + j)))
        // small delay between batches to avoid short bursts
        await new Promise(r => setTimeout(r, 120))
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
  const mapCenter = assignedTps?.lat && assignedTps?.lng ? { lat: assignedTps.lat, lng: assignedTps.lng } : { lat: 17.45, lng: 78.52 }
  const visibleIncidents = shoIncidents
  const navigateToGrid = (lat, lng) => {
    window.open(getNavUrl(lat, lng), '_blank')
  }
  const selectTrafficGrid = (c) => {
    setPendingJam({ lat: c.lat, lng: c.lng })
    setDispatchInfo(null)
    setMapFocus({ lat: c.lat, lng: c.lng, zoom: 16 })
    setSeverity(c.status === 'heavy' ? 'critical' : c.status === 'moderate' ? 'high' : 'medium')
    setAddress(`Grid #${c.id + 1} · ${c.priorityLabel} · ${c.statusLabel}${c.trafficDensity !== null ? ` · +${c.trafficDensity}% delay` : ''}`)
    toast.info('Selected traffic density grid')
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-800 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-indigo-200 font-semibold">Traffic SHO Live Desk</div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{assignedTps?.name || 'Assigned Traffic PS'}</div>
            <div className="text-xs text-indigo-200 mt-1">{assignedTps?.zoneName || user.zone || '-'} · Real-time jam dispatch and density scan</div>
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
          families={shoMarshals.map(m => ({ lat: m.currentLocation.coordinates[1], lng: m.currentLocation.coordinates[0], seniorName: m.name, riskCategory: m.status, familyCode: m.id }))}
          onMapClick={handleMapClick}
          dispatchHighlight={dispatchInfo || (pendingJam ? { ...pendingJam, level: 0 } : null)}
          center={mapCenter}
          zoom={14}
          fitToPolygons
        />
        <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-lg px-3 py-2 shadow flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Active</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500" /> Online (Ready)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400" /> Offline</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600" /> Jam</span>
        </div>
      </div>
      <div className="space-y-3 overflow-auto lg:max-h-[calc(100vh-170px)] pr-0 lg:pr-1">
        <Card className="border-0 shadow-sm bg-white/95 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><Siren className="h-5 w-5 text-red-600" /> Mark Traffic Jam</CardTitle>
            <CardDescription>Only your assigned Traffic Police Station area is shown. Mark jams inside this boundary.</CardDescription>
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
                      <div>{dispatchInfo.assignedMarshal ? `${dispatchInfo.assignedMarshal.name} assigned and notified` : 'Select one nearest available marshal below'}</div>
                    </div>
                    {!dispatchInfo.assignedMarshal && (
                      <div className="space-y-2">
                        {nearestMarshals.map(m => (
                          <div key={m.id} className="flex items-center justify-between gap-2 rounded border bg-white p-2 text-xs">
                            <div>
                              <div className="font-semibold">{m.name}</div>
                              <div className="text-slate-500">{m.status} · {m.distanceKm} km away</div>
                            </div>
                            <Button size="sm" onClick={() => assignMarshal(m.id)} disabled={assigningMarshalId === m.id}>
                              {assigningMarshalId === m.id ? 'Assigning...' : 'Assign'}
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
                  <div className="text-sm font-semibold text-white">{assignedTps?.name || 'Assigned Traffic PS'}</div>
                  <div className="text-xs text-indigo-300">{assignedTps?.zoneName || user.zone || '-'}</div>
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
                    <div className="text-indigo-100">Lat: {c.lat.toFixed(6)}, Lng: {c.lng.toFixed(6)}{c.trafficDensity !== null ? ` ({c.trafficDensity}% delay)` : ''}</div>
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

// Activity report submission card for marshals
function ActivityReportCard({ onSubmit }) {
  const [open, setOpen] = useState(false)
  const [severity, setSeverity] = useState('medium')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!photo && !description) { toast.error('Add a description or photo'); return }
    setBusy(true)
    await onSubmit({ severity, description, photo })
    setBusy(false)
    setOpen(false)
    setSeverity('medium'); setDescription(''); setPhoto(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:bg-slate-50 transition">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-amber-600" /> Submit Activity Report</CardTitle>
            <CardDescription>Photo + location + severity (+25 pts)</CardDescription>
          </CardHeader>
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Activity / Incident Report</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the situation..." rows={3} />
          </div>
          <div>
            <Label>Photo</Label>
            <PhotoUploader value={photo} onChange={setPhoto} label="Capture / upload photo" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Submitting...' : 'Submit Report'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----- MARSHAL DASHBOARD -----
function MarshalDashboard({ user, onStaleUser }) {
  const [me, setMe] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [marshals, setMarshals] = useState([])
  const [zones, setZones] = useState([])
  const [incidents, setIncidents] = useState([])
  const [stale, setStale] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportIncidentId, setReportIncidentId] = useState(null)
  const [reportSummary, setReportSummary] = useState('')
  const [reportSeverity, setReportSeverity] = useState('low')

  const load = async () => {
    try {
      const [meRes, al, m, z, i] = await Promise.all([
        api(`/marshals/${user.id}`),
        api(`/alerts/marshal-${user.id}`),
        api('/marshals'),
        api('/zones'),
        api('/incidents'),
      ])
      if (meRes?.error || !meRes?.marshal) {
        setStale(true)
        return
      }
      setMe(meRes.marshal)
      setAlerts(al?.alerts || [])
      setMarshals(m?.marshals || [])
      setZones(z?.zones || [])
      setIncidents(i?.incidents || [])
    } catch (e) {
      console.error('Load error', e)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [])

  const toggleStatus = async () => {
    if (!me) return
    const newStatus = me.status === 'offline' ? 'online' : 'offline'
    await api(`/marshals/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
    toast.success(`You are now ${newStatus.toUpperCase()}`)
    load()
  }

  const useMyGPS = () => {
    if (!navigator.geolocation) return toast.error('GPS not supported')
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await api(`/marshals/${user.id}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
      toast.success('Location updated from GPS')
      load()
    }, () => toast.error('GPS denied'))
  }

  const acceptAlert = async (alertId, incidentId) => {
    await api(`/alerts/${alertId}/accept`, { method: 'POST' })
    await api(`/marshals/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) })
    toast.success('Alert accepted. Status set to ACTIVE.')
    load()
  }

  const reachAlert = async (alertId) => {
    await api(`/alerts/${alertId}/reach`, { method: 'POST' })
    toast.success('Marked as Reached')
    load()
  }
  const controlAlert = async (alertId) => {
    await api(`/alerts/${alertId}/control`, { method: 'POST' })
    toast.success('Marked Under Control')
    load()
  }
  const rejectAlert = async (alertId) => {
    if (!confirm('Reject this alert?')) return
    await api(`/alerts/${alertId}/reject`, { method: 'POST' })
    toast.success('Alert rejected')
    load()
  }
  const submitReport = async (incidentId) => {
    setReportIncidentId(incidentId)
    setReportSummary('')
    setReportSeverity('low')
    setReportOpen(true)
  }
  const sendFinalReport = async () => {
    if (!reportIncidentId) return
    if (!reportSummary.trim()) return toast.error('Final report summary is required')
    const r = await api('/incident-reports', { method: 'POST', body: JSON.stringify({ incidentId: reportIncidentId, marshalId: user.id, summary: reportSummary.trim(), finalSeverity: reportSeverity }) })
    if (r.error) return toast.error(r.error)
    toast.success(`Incident closed & report sent. +${r.points} points`)
    setReportOpen(false)
    setReportIncidentId(null)
    setReportSummary('')
    load()
  }

  const clearTraffic = async (incidentId) => {
    const r = await api(`/incidents/${incidentId}/clear`, { method: 'POST', body: JSON.stringify({ marshalId: user.id }) })
    toast.success(`Traffic cleared! +${r.points} points awarded`)
    load()
  }

  const navigateTo = (lat, lng) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
  }
  const shareCurrentLocation = async () => {
    if (!navigator.geolocation) return toast.error('GPS not supported')
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setPosition(newPos)
      await api(`/marshals/${user.id}/location`, { method: 'PATCH', body: JSON.stringify(newPos) })
      await load(newPos)
      toast.success('Live coordinates shared')
    }, () => toast.error('GPS permission denied'), { enableHighAccuracy: true, timeout: 8000 })
  }

  if (stale) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-xl border shadow-sm text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Session out of sync</h2>
        <p className="text-sm text-slate-600">Your account data was refreshed on the server (database migration). Please sign in again to continue.</p>
        <Button onClick={() => { localStorage.removeItem('mksc_user'); onStaleUser?.() }} className="w-full">Sign in again</Button>
      </div>
    )
  }
  if (!me) return <div className="p-8 text-center">Loading your profile...</div>

  const statusBg = me.status === 'active' ? 'bg-green-50 border-green-300' : me.status === 'online' ? 'bg-blue-50 border-blue-300' : 'bg-slate-100 border-slate-300'

  const submitActivity = async ({ severity, description, photo }) => {
    let lat = me.currentLocation.coordinates[1]
    let lng = me.currentLocation.coordinates[0]
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }))
        lat = pos.coords.latitude; lng = pos.coords.longitude
      } catch {}
    }
    const r = await api('/activities', {
      method: 'POST',
      body: JSON.stringify({
        marshalId: user.id, marshalName: me.name, lat, lng,
        address: me.zone, severity, description, photoUrl: photo,
      })
    })
    if (r.error) return toast.error(r.error)
    toast.success(`Activity submitted! +${r.pointsAwarded} points`)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-700 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.14),transparent_60%)]" />
        <div className="relative px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-200 font-semibold">Marshal Field Command</div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{me.name}</div>
            <div className="text-xs text-emerald-100 mt-1">{me.zone} · {me.role.toUpperCase()} · {me.points} pts</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs w-full sm:w-auto">
            <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-emerald-200">Status</div>
              <div className="font-bold text-base">{me.status.toUpperCase()}</div>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-emerald-200">Alerts</div>
              <div className="font-bold text-base">{alerts.length}</div>
            </div>
          </div>
        </div>
      </div>

    <div className="grid lg:grid-cols-[1fr,400px] gap-4 h-[calc(100vh-170px)] min-h-[620px]">
      <div className="relative rounded-xl overflow-hidden border shadow-sm h-[54vw] min-h-[340px] max-h-[620px] lg:h-auto lg:max-h-none">
        <GoogleMapView
          apiKey={GMAPS_KEY}
          incidents={incidents}
          polygons={zones}
          families={marshals.map(m => ({ lat: m.currentLocation.coordinates[1], lng: m.currentLocation.coordinates[0], seniorName: m.name, riskCategory: m.status, familyCode: m.id }))}
          center={{ lat: me.currentLocation.coordinates[1], lng: me.currentLocation.coordinates[0] }}
          zoom={14}
        />
      </div>
      <div className="space-y-3 overflow-auto lg:max-h-[calc(100vh-170px)]">
        <Card className={`${statusBg} shadow-sm border-2`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Status: <span className="font-bold">{me.status.toUpperCase()}</span></span>
              <Switch checked={me.status !== 'offline'} onCheckedChange={toggleStatus} />
            </CardTitle>
            <CardDescription>{me.zone} · {me.role.toUpperCase()} · {me.points} pts</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={useMyGPS} className="w-full">
              <Navigation className="h-4 w-4 mr-1" /> Use My GPS Location
            </Button>
          </CardContent>
        </Card>

        <ActivityReportCard onSubmit={submitActivity} />

        <AssignedVisitsCard user={user} marshalInfo={me} />

        <Card className="border-0 shadow-sm bg-white/95 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Siren className="h-4 w-4 text-red-600" /> Active Dispatch Requests ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 && <p className="text-sm text-slate-500">No active alerts. Stay online to receive dispatches.</p>}
            {alerts.map(a => {
              const i = a.incident
              if (!i) return null
              const lat = i.location.coordinates[1], lng = i.location.coordinates[0]
              const steps = ['pending', 'accepted', 'reached', 'under_control']
              const curIdx = steps.indexOf(a.status)
              return (
                <div key={a.id} className="border-2 border-red-200 bg-red-50 rounded-xl p-3 space-y-2 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-red-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Level {a.level} · {a.distanceKm} km away</div>
                      <div className="text-sm font-medium">{i.address}</div>
                      <div className="text-xs text-slate-600">Severity: {i.severity} · {new Date(i.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <Badge className={a.status === 'pending' ? 'bg-red-600' : a.status === 'accepted' ? 'bg-amber-500' : a.status === 'reached' ? 'bg-blue-600' : 'bg-emerald-600'}>
                      {a.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  {/* Stepper */}
                  <div className="flex items-center gap-1 my-2">
                    {steps.map((s, idx) => (
                      <div key={s} className="flex-1 flex items-center">
                        <div className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold ${idx <= curIdx ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {idx + 1}
                        </div>
                        {idx < steps.length - 1 && <div className={`flex-1 h-0.5 ${idx < curIdx ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {a.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => acceptAlert(a.id, i.id)} className="flex-1 bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rejectAlert(a.id)}>Reject</Button>
                      </>
                    )}
                    {a.status === 'accepted' && (
                      <Button size="sm" onClick={() => reachAlert(a.id)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                        📍 Mark Reached
                      </Button>
                    )}
                    {a.status === 'reached' && (
                      <Button size="sm" onClick={() => controlAlert(a.id)} className="flex-1 bg-amber-600 hover:bg-amber-700">
                        🚧 Under Control
                      </Button>
                    )}
                    {a.status === 'under_control' && (
                      <Button size="sm" onClick={() => submitReport(i.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                        ✅ Close & Report to SHO
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigateTo(lat, lng)}>
                      <Navigation className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  )
}

// ----- USER MANAGEMENT TAB (Super Admin) -----
function UserManagementTab() {
  const [users, setUsers] = useState([])
  const [zones, setZones] = useState([])
  const [tpsList, setTpsList] = useState([])
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const empty = { username: '', password: '', name: '', role: 'marshal', phone: '', zoneId: '', tpsId: '', zoneIds: [] }
  const [form, setForm] = useState(empty)

  const load = async () => {
    const [u, z, t] = await Promise.all([api('/admin/users'), api('/admin/zones'), api('/admin/tps')])
    setUsers(u?.users || []); setZones(z?.zones || []); setTpsList(t?.tps || [])
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true) }
  const openEdit = (u) => {
    setEditing(u)
    setForm({ username: u.username, password: '', name: u.name, role: u.role, phone: u.phone || '',
      zoneId: u.zoneId || '', tpsId: u.tpsId || '', zoneIds: u.zoneIds || [] })
    setOpen(true)
  }
  const save = async () => {
    // Role-based validation
    if (form.role === 'dcp' && (!form.zoneIds || form.zoneIds.length === 0))
      return toast.error('DCP must be mapped to at least one Zone')
    if ((form.role === 'sho' || form.role === 'marshal') && (!form.zoneId || !form.tpsId))
      return toast.error('SHO/Marshal must be mapped to a Zone and Traffic Police Station')

    if (editing) {
      const body = { name: form.name, phone: form.phone, role: form.role }
      if (form.password) body.password = form.password
      if (['sho', 'marshal'].includes(form.role)) { body.zoneId = form.zoneId; body.tpsId = form.tpsId }
      else if (form.role === 'dcp') { body.zoneIds = form.zoneIds; body.zoneId = null; body.tpsId = null }
      else { body.zoneId = null; body.tpsId = null }
      const r = await api(`/admin/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      if (r.error) return toast.error(r.error)
      toast.success('User updated')
    } else {
      if (!form.username || !form.password || !form.name) return toast.error('Username, password & name required')
      const payload = { username: form.username, password: form.password, name: form.name, role: form.role, phone: form.phone }
      if (['sho', 'marshal'].includes(form.role)) { payload.zoneId = form.zoneId; payload.tpsId = form.tpsId }
      else if (form.role === 'dcp') payload.zoneIds = form.zoneIds
      const r = await api('/admin/users', { method: 'POST', body: JSON.stringify(payload) })
      if (r.error) return toast.error(r.error)
      toast.success('User created')
    }
    setOpen(false); load()
  }
  const del = async (u) => { if (!confirm(`Delete ${u.name}?`)) return; await api(`/admin/users/${u.id}`, { method: 'DELETE' }); toast.success('Deleted'); load() }

  const filtered = filter === 'all' ? users : users.filter(u => u.role === filter)
  const roleColors = { super_admin: 'bg-purple-600', dcp: 'bg-indigo-600', sho: 'bg-blue-600', marshal: 'bg-green-600', volunteer: 'bg-amber-600' }
  const availableTps = tpsList.filter(t => t.zoneId === form.zoneId)
  const toggleZoneId = (zid) => setForm(f => ({ ...f, zoneIds: f.zoneIds.includes(zid) ? f.zoneIds.filter(x => x !== zid) : [...f.zoneIds, zid] }))

  const needsZoneTps = ['sho', 'marshal'].includes(form.role)
  const needsZones = form.role === 'dcp'
  const needsNothing = ['super_admin', 'volunteer'].includes(form.role)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">User Management</CardTitle>
              <CardDescription>Role-based mapping: Super Admin &amp; Volunteer (no mapping), DCP (Zones), SHO/Marshal (Zone + TPS)</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="dcp">DCP</SelectItem>
                  <SelectItem value="sho">Traffic SHO</SelectItem>
                  <SelectItem value="marshal">Marshal</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full sm:w-auto" onClick={openCreate}><UserPlus className="h-4 w-4 mr-1" /> Add User</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-left bg-slate-100 sticky top-0">
                <tr>
                  <th className="p-2">Username</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Zone(s)</th>
                  <th className="p-2">Traffic PS</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b">
                    <td className="p-2 font-mono text-xs">{u.username}</td>
                    <td className="p-2 font-medium">{u.name}</td>
                    <td className="p-2"><Badge className={`${roleColors[u.role]} text-white`}>{u.role}</Badge></td>
                    <td className="p-2 text-xs">
                      {u.role === 'dcp' ? (u.zoneIds.length ? zones.filter(z => u.zoneIds.includes(z.id)).map(z => z.name).join(', ') : '-') : (u.zoneName || u.zone || '-')}
                    </td>
                    <td className="p-2 text-xs">{u.tpsName || '-'}</td>
                    <td className="p-2 text-xs">{u.phone || '-'}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => del(u)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>{editing ? 'Update user role mapping and contact details.' : 'Create a new user with role and mapping.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Username</Label>
              <Input value={form.username} disabled={!!editing} onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            {!editing && (
              <div>
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v, zoneId: '', tpsId: '', zoneIds: [] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="dcp">DCP</SelectItem>
                  <SelectItem value="sho">Traffic SHO</SelectItem>
                  <SelectItem value="marshal">Marshal</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsNothing && (
              <div className="bg-slate-100 border rounded p-3 text-xs text-slate-600">
                ℹ {form.role === 'super_admin' ? 'Super Admin' : 'Volunteer'} requires no Zone/PS mapping.
                {form.role === 'volunteer' && ' Volunteers receive nearby incidents based on their live GPS location.'}
              </div>
            )}
            {needsZoneTps && (
              <>
                <div>
                  <Label>Zone *</Label>
                  <Select value={form.zoneId} onValueChange={v => setForm({ ...form, zoneId: v, tpsId: '' })}>
                    <SelectTrigger><SelectValue placeholder="Select Zone" /></SelectTrigger>
                    <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Traffic Police Station *</Label>
                  <Select value={form.tpsId} onValueChange={v => setForm({ ...form, tpsId: v })} disabled={!form.zoneId}>
                    <SelectTrigger><SelectValue placeholder={form.zoneId ? (availableTps.length ? 'Select TPS' : 'No TPS in this zone') : 'Select Zone first'} /></SelectTrigger>
                    <SelectContent>{availableTps.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {form.zoneId && !availableTps.length && <p className="text-xs text-amber-600 mt-1">No Traffic PS exists in this zone. Create one in the Traffic PS tab first.</p>}
                </div>
              </>
            )}
            {needsZones && (
              <div>
                <Label>Assign Zones * (one or more)</Label>
                <div className="border rounded-lg p-2 max-h-44 overflow-y-auto space-y-1">
                  {zones.map(z => (
                    <label key={z.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input type="checkbox" checked={form.zoneIds.includes(z.id)} onChange={() => toggleZoneId(z.id)} />
                      <span className="text-sm">{z.name}</span>
                      {z.description && <span className="text-xs text-slate-400">– {z.description}</span>}
                    </label>
                  ))}
                  {!zones.length && <p className="text-xs text-slate-500 px-2">No zones yet. Create zones in the Zones tab.</p>}
                </div>
                {form.zoneIds.length > 0 && <p className="text-xs text-slate-500 mt-1">{form.zoneIds.length} zone(s) selected</p>}
              </div>
            )}
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ----- ACTIVITIES TAB -----
function ActivitiesTab() {
  const [activities, setActivities] = useState([])
  useEffect(() => {
    const load = async () => { const r = await api('/activities'); setActivities(r.activities || []) }
    load(); const t = setInterval(load, 5000); return () => clearInterval(t)
  }, [])
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Marshal Activity Reports</CardTitle><CardDescription>Photos, locations, severity submitted from the field</CardDescription></CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-auto">
          {activities.map(a => (
            <div key={a.id} className="border rounded-lg overflow-hidden bg-white">
              {a.photoUrl && <img src={a.photoUrl} alt="" className="w-full h-40 object-cover" />}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{a.marshalName}</div>
                  <Badge className={a.severity === 'critical' ? 'bg-red-600' : a.severity === 'high' ? 'bg-orange-600' : a.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-500'}>{a.severity}</Badge>
                </div>
                <div className="text-xs text-slate-600">{a.address}</div>
                <div className="text-sm">{a.description}</div>
                <div className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {!activities.length && <div className="col-span-full text-sm text-slate-500 text-center py-6">No activity reports yet.</div>}
        </div>
      </CardContent>
    </Card>
  )
}

// CSV export utility
const exportCSV = (filename, headers, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ====================================================================
// VOLUNTEER DASHBOARD - GPS-driven nearby incidents (no zone/PS mapping)
// ====================================================================
function VolunteerDashboard({ user, onStaleUser }) {
  const [me, setMe] = useState(null)
  const [position, setPosition] = useState(null)
  const [nearbyIncidents, setNearbyIncidents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stale, setStale] = useState(false)
  const [radiusKm, setRadiusKm] = useState(10)

  const updateFromCurrentGPS = async (showToast = false) => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setPosition(newPos)
      await api(`/marshals/${user.id}/location`, { method: 'PATCH', body: JSON.stringify(newPos) })
      await load(newPos)
      if (showToast) toast.success('Using your current live coordinates')
    }, () => toast.error('GPS permission denied'), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 })
  }

  const load = async (pos) => {
    try {
      const meRes = await api(`/marshals/${user.id}`)
      if (meRes?.error || !meRes?.marshal) { setStale(true); return }
      setMe(meRes.marshal)
      if (pos) {
        const r = await api(`/incidents/nearby?lat=${pos.lat}&lng=${pos.lng}&radius=${radiusKm * 1000}`)
        setNearbyIncidents(r?.incidents || [])
      }
      const al = await api(`/alerts/marshal-${user.id}`)
      setAlerts(al?.alerts || [])
    } catch (e) { console.error('Vol load', e) }
  }

  // GPS tracking
  useEffect(() => {
    let watchId
    if (navigator.geolocation) {
      updateFromCurrentGPS()
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setPosition(newPos)
          // send to backend
          await api(`/marshals/${user.id}/location`, { method: 'PATCH', body: JSON.stringify(newPos) })
          load(newPos)
        },
        (e) => console.warn('GPS error', e.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      )
    }
    return () => watchId && navigator.geolocation.clearWatch(watchId)
  }, [radiusKm])

  // Periodic refresh
  useEffect(() => {
    if (!position) return
    const t = setInterval(() => load(position), 5000)
    return () => clearInterval(t)
  }, [position, radiusKm])

  const toggleStatus = async () => {
    if (!me) return
    const newStatus = me.status === 'offline' ? 'online' : 'offline'
    await api(`/marshals/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
    toast.success(`You are now ${newStatus.toUpperCase()}`)
    load(position)
  }

  const acceptInc = async (incidentId) => {
    const al = alerts.find(a => a.incidentId === incidentId)
    if (al) {
      await api(`/alerts/${al.id}/accept`, { method: 'POST' })
    } else {
      const r = await api(`/incidents/${incidentId}/assist`, { method: 'POST', body: JSON.stringify({ volunteerId: user.id }) })
      if (r.error) return toast.error(r.error)
    }
    toast.success('Assistance shared with traffic team — navigate to location')
    load(position)
  }
  const rejectInc = async (incidentId) => {
    const al = alerts.find(a => a.incidentId === incidentId)
    if (!al) return
    await api(`/alerts/${al.id}/reject`, { method: 'POST' })
    toast.success('Rejected')
    load(position)
  }
  const closeInc = async (incidentId) => {
    const al = alerts.find(a => a.incidentId === incidentId)
    if (al) await api(`/alerts/${al.id}/control`, { method: 'POST' })
    const r = await api('/incident-reports', { method: 'POST', body: JSON.stringify({ incidentId, marshalId: user.id, summary: 'Cleared by volunteer', finalSeverity: 'low' }) })
    toast.success(`Cleared! +${r.points} pts`)
    load(position)
  }
  const shareCurrentLocation = async () => {
    updateFromCurrentGPS(true)
  }

  if (stale) return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-xl border text-center space-y-4">
      <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
      <h2 className="text-lg font-bold">Session out of sync</h2>
      <Button onClick={() => { localStorage.removeItem('mksc_user'); onStaleUser?.() }} className="w-full">Sign in again</Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-200 font-semibold">Volunteer Rapid Assist</div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{user.name}</div>
            <div className="text-xs text-cyan-100 mt-1">GPS-based nearby incident discovery and first response support</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs w-full sm:w-auto">
            <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-cyan-200">Nearby</div>
              <div className="font-bold text-base">{nearbyIncidents.length}</div>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-cyan-200">Points</div>
              <div className="font-bold text-base">{me?.points || 0}</div>
            </div>
          </div>
        </div>
      </div>

    <div className="grid lg:grid-cols-[1fr,400px] gap-4 h-[calc(100vh-170px)] min-h-[620px]">
      <div className="rounded-xl overflow-hidden border shadow-sm relative h-[54vw] min-h-[340px] max-h-[620px] lg:h-auto lg:max-h-none">
        {position ? (
          <GoogleMapView apiKey={GMAPS_KEY} incidents={nearbyIncidents}
            focus={{ lat: position.lat, lng: position.lng, zoom: 15 }}
            center={position}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-slate-100 flex-col gap-3 text-slate-600">
            <Navigation className="h-12 w-12 animate-pulse" />
            <p>Waiting for GPS location… Please allow location access.</p>
          </div>
        )}
      </div>
      <div className="overflow-auto space-y-3 lg:max-h-[calc(100vh-170px)]">
        <Card className={`${me?.status === 'active' ? 'bg-green-50 border-green-300' : me?.status === 'online' ? 'bg-blue-50 border-blue-300' : 'bg-slate-100'} shadow-sm border-2`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>{user.name}</span>
              <Switch checked={me?.status !== 'offline'} onCheckedChange={toggleStatus} />
            </CardTitle>
            <CardDescription>
              Status: <strong>{me?.status?.toUpperCase() || '...'}</strong> · Points: {me?.points || 0}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div className="font-mono bg-slate-100 p-2 rounded">
              📍 {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'No GPS yet'}
            </div>
            <Button variant="outline" size="sm" onClick={shareCurrentLocation} className="w-full">
              <Navigation className="h-4 w-4 mr-1" /> Share Current Live Coordinates
            </Button>
            <div className="flex items-center gap-2">
              <span>Search radius:</span>
              <Select value={String(radiusKm)} onValueChange={v => setRadiusKm(Number(v))}>
                <SelectTrigger className="w-24 h-7"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 km</SelectItem>
                  <SelectItem value="2">2 km</SelectItem>
                  <SelectItem value="5">5 km</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white/95 backdrop-blur">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Siren className="h-4 w-4 text-red-600" /> Nearby Traffic & Jam Areas ({nearbyIncidents.length})</CardTitle><CardDescription>Showing traffic problems within {radiusKm} km of your current GPS location</CardDescription></CardHeader>
          <CardContent className="space-y-2 max-h-[60vh] overflow-auto">
            {nearbyIncidents.length === 0 && <p className="text-sm text-slate-500">No incidents within {radiusKm} km. You'll be notified when one is reported nearby.</p>}
            {nearbyIncidents.map(i => {
              const al = alerts.find(a => a.incidentId === i.id)
              const lat = i.location.coordinates[1], lng = i.location.coordinates[0]
              return (
                <div key={i.id} className="border-2 border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{i.address}</div>
                      <div className="text-xs text-slate-600">{(i.distanceM / 1000).toFixed(2)} km away · {i.severity}</div>
                    </div>
                    {al && <Badge>{al.status}</Badge>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(!al || al.status === 'pending') && (
                      <>
                        <Button size="sm" onClick={() => acceptInc(i.id)} className="flex-1 bg-green-600 hover:bg-green-700">Assist Team</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectInc(i.id)}>Reject</Button>
                      </>
                    )}
                    {al && ['accepted', 'reached'].includes(al.status) && (
                      <Button size="sm" onClick={() => closeInc(i.id)} className="flex-1 bg-blue-600 hover:bg-blue-700">Mark Cleared</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')}>
                      <Navigation className="h-3 w-3 mr-1" /> Navigate
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  )
}

// ====================================================================
// AUDIT LOGS TAB
// ====================================================================
function AuditLogsTab() {
  const [logs, setLogs] = useState([])
  const [filterRole, setFilterRole] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const load = async () => {
    const qs = new URLSearchParams()
    if (filterRole) qs.set('role', filterRole)
    if (filterAction) qs.set('action', filterAction)
    const r = await api(`/admin/audit?${qs.toString()}`)
    setLogs(r?.logs || [])
  }
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [filterRole, filterAction])
  const download = () => {
    exportCSV('audit_logs.csv',
      ['Time', 'Actor', 'Role', 'Action', 'Target Type', 'Target ID', 'Details'],
      logs.map(l => [new Date(l.createdAt).toLocaleString(), l.actorName, l.actorRole, l.action, l.targetType, l.targetId, JSON.stringify(l.details)])
    )
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Audit Logs</CardTitle>
          <CardDescription>Complete activity trail across the system</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterRole || 'all'} onValueChange={v => setFilterRole(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="dcp">DCP</SelectItem>
              <SelectItem value="sho">SHO</SelectItem>
              <SelectItem value="marshal">Marshal</SelectItem>
              <SelectItem value="volunteer">Volunteer</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="w-full sm:w-auto" onClick={download}><FileText className="h-4 w-4 mr-1" /> Export CSV</Button>
        </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="text-left"><th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Role</th><th className="p-2">Action</th><th className="p-2">Target</th><th className="p-2">Details</th></tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b">
                  <td className="p-2 text-xs font-mono">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="p-2">{l.actorName || '-'}</td>
                  <td className="p-2"><Badge variant="outline" className="text-[10px]">{l.actorRole}</Badge></td>
                  <td className="p-2"><Badge className="bg-slate-700 text-[10px]">{l.action}</Badge></td>
                  <td className="p-2 text-xs">{l.targetType}</td>
                  <td className="p-2 text-xs font-mono text-slate-500 max-w-xs truncate">{l.details ? JSON.stringify(l.details) : '-'}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan="6" className="text-center py-6 text-slate-500">No audit entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================================================================
// ZONES MANAGEMENT TAB (Super Admin)
// ====================================================================
function ZonesTab() {
  const [zones, setZones] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const load = async () => { const r = await api('/admin/zones'); setZones(r?.zones || []) }
  useEffect(() => { load() }, [])
  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); setOpen(true) }
  const openEdit = (z) => { setEditing(z); setForm({ name: z.name, description: z.description || '' }); setOpen(true) }
  const save = async () => {
    if (!form.name) return toast.error('Name required')
    const r = editing
      ? await api(`/admin/zones/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      : await api('/admin/zones', { method: 'POST', body: JSON.stringify(form) })
    if (r.error) return toast.error(r.error)
    toast.success(editing ? 'Zone updated' : 'Zone created'); setOpen(false); load()
  }
  const del = async (z) => {
    if (!confirm(`Delete zone "${z.name}"? This will also remove its Traffic PS.`)) return
    await api(`/admin/zones/${z.id}`, { method: 'DELETE' }); toast.success('Deleted'); load()
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Zone Management</CardTitle>
          <CardDescription>Create and manage zones. DCPs are assigned to zones.</CardDescription>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Zone</Button>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {zones.map(z => (
            <div key={z.id} className="border rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-lg">{z.name}</div>
                  <div className="text-xs text-slate-500">{z.description || 'No description'}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(z)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(z)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-2 truncate">ID: {z.id}</div>
            </div>
          ))}
          {!zones.length && <div className="col-span-full text-center text-sm text-slate-500 py-8">No zones yet.</div>}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Zone' : 'Create Zone'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Zone Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Secunderabad" /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ====================================================================
// TRAFFIC POLICE STATIONS TAB (Super Admin) - with polygon drawing
// ====================================================================
function TrafficPSTab() {
  const [tpsList, setTpsList] = useState([])
  const [zones, setZones] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', zoneId: '', address: '', lat: '', lng: '', polygon: null })

  const load = async () => {
    const [t, z] = await Promise.all([api('/admin/tps'), api('/admin/zones')])
    setTpsList(t?.tps || []); setZones(z?.zones || [])
  }
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', zoneId: zones[0]?.id || '', address: '', lat: '', lng: '', polygon: null })
    setOpen(true)
  }
  const openEdit = (t) => {
    setEditing(t)
    setForm({ name: t.name, zoneId: t.zoneId, address: t.address || '', lat: t.lat || '', lng: t.lng || '', polygon: t.polygon })
    setOpen(true)
  }
  const save = async () => {
    if (!form.name || !form.zoneId) return toast.error('Name and Zone required')
    const payload = {
      name: form.name, zoneId: form.zoneId, address: form.address,
      lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null,
      polygon: form.polygon,
    }
    const r = editing
      ? await api(`/admin/tps/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await api('/admin/tps', { method: 'POST', body: JSON.stringify(payload) })
    if (r.error) return toast.error(r.error)
    toast.success(editing ? 'TPS updated' : 'TPS created'); setOpen(false); load()
  }
  const del = async (t) => {
    if (!confirm(`Delete "${t.name}"?`)) return
    await api(`/admin/tps/${t.id}`, { method: 'DELETE' }); toast.success('Deleted'); load()
  }

  const polygonCount = (poly) => poly && Array.isArray(poly) ? poly.length : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Traffic Police Stations</CardTitle>
          <CardDescription>Draw polygon coverage area on Google Maps. SHOs/Marshals are mapped to TPS.</CardDescription>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Traffic PS</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[580px]">
            <thead className="bg-slate-100 text-left">
              <tr><th className="p-2">Name</th><th className="p-2">Zone</th><th className="p-2">Address</th><th className="p-2">Coordinates</th><th className="p-2">Polygon</th><th className="p-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {tpsList.map(t => (
                <tr key={t.id} className="border-b">
                  <td className="p-2 font-medium">{t.name}</td>
                  <td className="p-2"><Badge variant="outline">{t.zoneName}</Badge></td>
                  <td className="p-2 text-xs">{t.address || '-'}</td>
                  <td className="p-2 text-xs font-mono">{t.lat ? `${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}` : '-'}</td>
                  <td className="p-2"><Badge variant={polygonCount(t.polygon) > 2 ? 'default' : 'secondary'}>{polygonCount(t.polygon)} pts</Badge></td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del(t)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  </td>
                </tr>
              ))}
              {!tpsList.length && <tr><td colSpan="6" className="text-center py-6 text-slate-500">No traffic police stations.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Create Traffic Police Station'}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Begumpet Traffic PS" /></div>
              <div><Label>Zone *</Label>
                <Select value={form.zoneId} onValueChange={v => setForm({ ...form, zoneId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Latitude</Label><Input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="17.4399" /></div>
                <div><Label>Longitude</Label><Input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="78.4738" /></div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
                <div className="font-semibold mb-1">Polygon Status</div>
                <div>{polygonCount(form.polygon) > 2 ? `✓ ${polygonCount(form.polygon)} points drawn` : '⚠ No polygon yet — use ✏️ Freehand or 📐 Click-points tool on the map'}</div>
                <div className="text-slate-500 mt-1 leading-relaxed">Tip: <strong>Freehand</strong> — hold & drag mouse to sketch boundary (lines do not need to be perfectly straight). <strong>Click points</strong> — click to add vertices; double-click to close.</div>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden" style={{ height: 460 }}>
              <GoogleMapPolygonEditor
                apiKey={GMAPS_KEY}
                polygon={form.polygon}
                onChange={(coords) => setForm(f => ({ ...f, polygon: coords }))}
                center={form.lat && form.lng ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } : { lat: 17.45, lng: 78.52 }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ====================================================================
// DCP DASHBOARD - real-time traffic monitoring with Google Maps Traffic Layer
// ====================================================================
function DCPDashboard({ user }) {
  const [zones, setZones] = useState([])
  const [tpsList, setTpsList] = useState([])
  const [tpsFilter, setTpsFilter] = useState('all')
  const [range, setRange] = useState('live')
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState({ hourly: [], psWise: [] })
  const [focus, setFocus] = useState(null)
  const [selected, setSelected] = useState(null)
  const [trafficScanning, setTrafficScanning] = useState(false)
  const [trafficScanProgress, setTrafficScanProgress] = useState({ done: 0, total: 0 })
  const [trafficCongestionMap, setTrafficCongestionMap] = useState({})
  const [trafficStatusMap, setTrafficStatusMap] = useState({})
  const [trafficScanFilter, setTrafficScanFilter] = useState('all')
  const [trafficLastScanAt, setTrafficLastScanAt] = useState(null)

  const load = async () => {
    try {
      const [zt, st, an, inc] = await Promise.all([
        api(`/dcp/${user.id}/tps`),
        api(`/dcp/${user.id}/stats`),
        api(`/dcp/${user.id}/analytics`),
        api(`/dcp/${user.id}/incidents?shoId=${tpsFilter}&range=${range}`),
      ])
      setZones(zt?.zones || [])
      setTpsList(zt?.tps || [])
      setStats(st?.stats || null)
      setAnalytics(an || { hourly: [], psWise: [] })
      setIncidents(inc?.incidents || [])
    } catch (e) { console.error('DCP load', e) }
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [tpsFilter, range])

  const onCardClick = (i) => {
    setSelected(i)
    setFocus({ lat: i.location.coordinates[1], lng: i.location.coordinates[0], zoom: 16 })
  }
  const openInGoogleMaps = (i) => {
    const lat = i.location.coordinates[1], lng = i.location.coordinates[0]
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
  }

  const sevBg = (s) => ({ critical: 'bg-red-50 border-red-300', high: 'bg-orange-50 border-orange-300', medium: 'bg-amber-50 border-amber-300', low: 'bg-emerald-50 border-emerald-300' }[s] || 'bg-slate-50 border-slate-200')
  const sevBadge = (s) => ({ critical: 'bg-red-600', high: 'bg-orange-600', medium: 'bg-amber-500', low: 'bg-emerald-600' }[s] || 'bg-slate-500')

  // Color palette for polygons by zone
  const zoneColorMap = useMemo(() => {
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
    return Object.fromEntries(zones.map((z, i) => [z.id, palette[i % palette.length]]))
  }, [zones])

  const tpsPolygons = useMemo(() => tpsList
    .filter(t => tpsFilter === 'all' || t.id === tpsFilter)
    .map(t => ({
      name: t.name, zoneName: t.zoneName, polygon: t.polygon, color: zoneColorMap[t.zoneId],
    }))
    .filter(t => t.polygon), [tpsList, tpsFilter, zoneColorMap])

  const dcpTrafficGrid = useMemo(() => tpsPolygons.flatMap((t, tIdx) => {
    if (!t.polygon || t.polygon.length < 3) return []
    const center = t.polygon.reduce((acc, p) => ({ lat: acc.lat + Number(p[0]) / t.polygon.length, lng: acc.lng + Number(p[1]) / t.polygon.length }), { lat: 0, lng: 0 })
    const cellSize = 0.01
    return Array.from({ length: 9 }, (_, i) => {
      const row = Math.floor(i / 3)
      const col = i % 3
      return {
        id: `${tIdx}-${i}`,
        name: `${t.name} Grid #${i + 1}`,
        tpsName: t.name,
        zoneName: t.zoneName,
        lat: center.lat + (row - 1) * cellSize,
        lng: center.lng + (col - 1) * cellSize,
      }
    })
  }), [tpsPolygons])

  const scanDcpTrafficGrid = async () => {
    if (!GMAPS_KEY) return toast.error('Google Maps API key missing')
    if (!dcpTrafficGrid.length) return toast.error('No assigned area grid to scan')
    setTrafficScanning(true)
    setTrafficScanProgress({ done: 0, total: dcpTrafficGrid.length })
    try {
      const google = await getLoader(GMAPS_KEY)
      const dirSvc = new google.maps.DirectionsService()
      const newCong = {}
      const newStatus = {}
      let unavailable = 0
      let done = 0
      const processCell = async (cell) => {
        const key = `${cell.lat},${cell.lng}`
        const samples = await Promise.all(TRAFFIC_SAMPLE_ROUTES.map(route => getTrafficDensityRatio(google, dirSvc, cell.lat, cell.lng, route)))
        const ratios = samples.filter(v => typeof v === 'number')
        if (!ratios.length) {
          unavailable++
          done++
          setTrafficScanProgress({ done, total: dcpTrafficGrid.length })
          return
        }
        const average = ratios.reduce((a, b) => a + b, 0) / ratios.length
        newCong[key] = average
        if (average >= 1.12) newStatus[key] = 'heavy'
        else if (average >= 1.04) newStatus[key] = 'moderate'
        else newStatus[key] = 'clear'
        done++
        setTrafficScanProgress({ done, total: dcpTrafficGrid.length })
      }
      for (let i = 0; i < dcpTrafficGrid.length; i += 4) {
        await Promise.all(dcpTrafficGrid.slice(i, i + 4).map(processCell))
        await new Promise(r => setTimeout(r, 120))
      }
      setTrafficCongestionMap(newCong)
      setTrafficStatusMap(newStatus)
      setTrafficLastScanAt(new Date())
      toast.success(`DCP vehicle movement scan complete — ${Object.values(newStatus).filter(s => s === 'heavy').length} heavy, ${Object.values(newStatus).filter(s => s === 'moderate').length} moderate${unavailable ? `, ${unavailable} unavailable` : ''}`)
    } catch (e) {
      console.error('DCP traffic scan error', e)
      toast.error('DCP traffic scan failed')
    }
    setTrafficScanning(false)
  }

  const dcpTrafficHotspots = dcpTrafficGrid.map(c => {
    const key = `${c.lat},${c.lng}`
    const ratio = trafficCongestionMap[key]
    const trafficDensity = typeof ratio === 'number' ? Math.max(0, Math.round((ratio - 1) * 100)) : null
    const status = trafficStatusMap[key] || 'unknown'
    const priority = TRAFFIC_PRIORITY[status] || 3
    return {
      ...c,
      trafficDensity,
      incidentCount: 0,
      density: trafficDensity ?? 0,
      severity: status === 'heavy' ? 'critical' : status === 'moderate' ? 'high' : 'low',
      status,
      priority,
      priorityLabel: TRAFFIC_PRIORITY_LABEL[priority],
      statusLabel: TRAFFIC_STATUS_LABEL[status] || '—',
    }
  })
  const visibleDcpTrafficHotspots = dcpTrafficHotspots.filter(c => c.trafficDensity !== null).filter(c => trafficScanFilter === 'all' || c.status === trafficScanFilter).sort((a, b) => b.density - a.density)
  const dcpHeavyTrafficPlaces = dcpTrafficHotspots.filter(c => c.status === 'heavy').sort((a, b) => b.density - a.density)
  const dcpTrafficRatios = Object.values(trafficCongestionMap).filter(v => typeof v === 'number')
  const dcpHeavyCount = Object.values(trafficStatusMap).filter(s => s === 'heavy').length
  const dcpModerateCount = Object.values(trafficStatusMap).filter(s => s === 'moderate').length
  const dcpClearCount = Object.values(trafficStatusMap).filter(s => s === 'clear').length
  const dcpAvgDelayPct = dcpTrafficRatios.length ? Math.round(((dcpTrafficRatios.reduce((a, b) => a + b, 0) / dcpTrafficRatios.length) - 1) * 100) : 0
  const dcpMaxDelayPct = dcpTrafficRatios.length ? Math.round((Math.max(...dcpTrafficRatios) - 1) * 100) : 0
  const dcpLiveTrafficStatus = dcpHeavyCount > 0 ? 'Heavy congestion' : dcpModerateCount > 0 ? 'Moderate congestion' : dcpTrafficRatios.length ? 'Clear traffic' : 'Not scanned'
  const selectDcpTrafficGrid = (c) => {
    setFocus({ lat: c.lat, lng: c.lng, zoom: 16 })
    setSelected(null)
    toast.info(`${c.name} selected`)
  }

  // Center map on first TPS lat/lng of assigned zones if available
  const mapCenter = tpsList[0]?.lat ? { lat: tpsList[0].lat, lng: tpsList[0].lng } : { lat: 17.45, lng: 78.52 }

  return (
    <Tabs defaultValue="live" className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <TabsList className="w-max h-auto">
          <TabsTrigger value="live" className="text-xs sm:text-sm"><Radio className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Live </span>Monitoring</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 mr-1" />Analytics</TabsTrigger>
          <TabsTrigger value="seniors" className="text-xs sm:text-sm"><Heart className="h-3.5 w-3.5 mr-1" />Seniors</TabsTrigger>
          <TabsTrigger value="escalations" className="text-xs sm:text-sm"><Bell className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Escalations</span><span className="sm:hidden">Esc.</span></TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="live" className="space-y-4">
        {/* ── Premium jurisdiction banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-700 to-blue-800 text-white shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
          <div className="relative px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" /></span>
                <span className="text-[10px] uppercase tracking-widest text-indigo-200 font-semibold">Live — Your Jurisdiction</span>
              </div>
              <div className="font-bold text-xl sm:text-2xl leading-tight">{zones.map(z => z.name).join(' · ') || 'No zones assigned'}</div>
              <div className="text-indigo-200 text-xs mt-1">{zones.length} zone(s) · {tpsList.length} Traffic Police Station(s)</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {zones.map(z => (
                <span key={z.id} className="px-3 py-1 rounded-full text-xs font-semibold border border-white/20 backdrop-blur-sm" style={{ backgroundColor: zoneColorMap[z.id] + 'cc' }}>{z.name}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI stat strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Active Jams', value: stats?.active || 0, icon: <Siren className="h-4 w-4" />, accent: 'border-red-400 bg-red-50 text-red-700' },
            { label: 'Critical',    value: stats?.critical || 0, icon: <AlertTriangle className="h-4 w-4" />, accent: 'border-red-300 bg-red-50 text-red-600' },
            { label: 'High',        value: stats?.high || 0,     icon: <AlertTriangle className="h-4 w-4" />, accent: 'border-orange-300 bg-orange-50 text-orange-600' },
            { label: 'Medium',      value: stats?.medium || 0,   icon: <Activity className="h-4 w-4" />,      accent: 'border-amber-300 bg-amber-50 text-amber-600' },
            { label: 'Cleared',     value: stats?.cleared || 0,  icon: <CheckCircle2 className="h-4 w-4" />, accent: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
            { label: 'Total',       value: stats?.total || 0,    icon: <BarChart3 className="h-4 w-4" />,    accent: 'border-slate-300 bg-white text-slate-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border-2 p-3 flex flex-col gap-1 shadow-sm ${s.accent}`}>
              <div className="flex items-center justify-between">{s.icon}<span className="text-[10px] font-medium opacity-70">{s.label}</span></div>
              <div className="text-2xl font-extrabold leading-none">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 shrink-0">
                <Building2 className="h-4 w-4" /> Filter
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <Select value={tpsFilter} onValueChange={setTpsFilter}>
                  <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="All Traffic PS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Traffic PS</SelectItem>
                    {tpsList.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.zoneName})</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={range} onValueChange={setRange}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live / Real-Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Map + sidebar ── */}
        <div className="grid lg:grid-cols-[1fr,420px] gap-4">
          <div className="rounded-xl overflow-hidden border shadow-sm relative h-[50vw] min-h-[320px] max-h-[600px] lg:h-[calc(100vh-420px)] lg:min-h-[500px] lg:max-h-none">
            <GoogleMapView apiKey={GMAPS_KEY} incidents={incidents} polygons={tpsPolygons} hotspots={visibleDcpTrafficHotspots} focus={focus} onIncidentClick={onCardClick} onHotspotClick={selectDcpTrafficGrid} center={mapCenter} zoom={11} fitToPolygons />
            <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur rounded-lg px-3 py-2 shadow text-xs flex flex-wrap items-center gap-2 max-w-[calc(100%-24px)]">
              <span className="font-semibold text-slate-700">Traffic Layer</span>
              {zones.map(z => <span key={z.id} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border" style={{ backgroundColor: zoneColorMap[z.id] + '44', borderColor: zoneColorMap[z.id] }} /><span className="text-slate-600">{z.name}</span></span>)}
            </div>
          </div>

          <div className="space-y-3 overflow-auto lg:max-h-[calc(100vh-220px)]">
            {/* ── Premium scan summary ── */}
            <div className="rounded-xl border bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-indigo-300 uppercase tracking-wider font-semibold">Traffic Scan</div>
                  <div className="font-bold mt-0.5">{tpsFilter === 'all' ? `${tpsList.length} Police Stations` : tpsList.find(t => t.id === tpsFilter)?.name}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  dcpLiveTrafficStatus === 'Heavy congestion' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                  dcpLiveTrafficStatus === 'Moderate congestion' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  dcpLiveTrafficStatus === 'Clear traffic' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>{dcpLiveTrafficStatus}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: dcpTrafficRatios.length, l: 'Scanned' },
                  { v: `+${dcpAvgDelayPct}%`, l: 'Avg Delay' },
                  { v: `+${dcpMaxDelayPct}%`, l: 'Max Delay' },
                ].map(s => (
                  <div key={s.l} className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                    <div className="text-lg font-extrabold">{s.v}</div>
                    <div className="text-[10px] text-indigo-300">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-red-500/15 border border-red-500/20 p-2 text-center">
                  <div className="text-xl font-extrabold text-red-300">{dcpHeavyCount}</div>
                  <div className="text-[10px] text-red-400">Heavy</div>
                </div>
                <div className="rounded-lg bg-amber-500/15 border border-amber-500/20 p-2 text-center">
                  <div className="text-xl font-extrabold text-amber-300">{dcpModerateCount}</div>
                  <div className="text-[10px] text-amber-400">Moderate</div>
                </div>
                <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/20 p-2 text-center">
                  <div className="text-xl font-extrabold text-emerald-300">{dcpClearCount}</div>
                  <div className="text-[10px] text-emerald-400">Clear</div>
                </div>
              </div>
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border-0" onClick={scanDcpTrafficGrid} disabled={trafficScanning}>
                {trafficScanning ? `Scanning ${trafficScanProgress.done}/${trafficScanProgress.total}…` : '🔍 Scan DCP Traffic Areas'}
              </Button>
              <div className="text-[10px] text-indigo-400 text-center">Last scan: {trafficLastScanAt ? trafficLastScanAt.toLocaleString('en-IN') : 'Not scanned yet'}</div>
            </div>
            {/* ── Traffic Locations card ── */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold text-slate-700">Traffic Locations</CardTitle>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{visibleDcpTrafficHotspots.length} location(s)</span>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 mt-2">
                  <Button size="sm" className="w-full text-xs" variant={trafficScanFilter === 'all' ? undefined : 'ghost'} onClick={() => setTrafficScanFilter('all')}>All</Button>
                  <Button size="sm" className="w-full text-xs" variant={trafficScanFilter === 'heavy' ? undefined : 'ghost'} onClick={() => setTrafficScanFilter('heavy')}>🔴 Heavy</Button>
                  <Button size="sm" className="w-full text-xs" variant={trafficScanFilter === 'moderate' ? undefined : 'ghost'} onClick={() => setTrafficScanFilter('moderate')}>🟡 Mod</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {visibleDcpTrafficHotspots.map(c => (
                  <div key={c.id} className={`rounded-xl border p-2.5 text-xs space-y-1.5 transition-colors hover:bg-slate-50 ${c.status === 'heavy' ? 'border-red-200 bg-red-50/50' : c.status === 'moderate' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/30'}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-800 truncate flex-1">{c.name}</span>
                      <Badge className={`text-[10px] shrink-0 ${c.status === 'heavy' ? 'bg-red-600' : c.status === 'moderate' ? 'bg-amber-500' : c.status === 'clear' ? 'bg-emerald-600' : 'bg-slate-500'}`}>{c.statusLabel}</Badge>
                    </div>
                    <div className="text-slate-500 text-[11px]">{c.tpsName} · {c.zoneName}</div>
                    {c.trafficDensity !== null && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${c.status === 'heavy' ? 'bg-red-500' : c.status === 'moderate' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, c.trafficDensity * 1.5)}%` }} /></div>
                        <span className="font-bold text-slate-700 shrink-0">+{c.trafficDensity}%</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-1">
                      <Button size="sm" variant="outline" className="text-[10px] h-6 px-1" onClick={() => selectDcpTrafficGrid(c)}>Zoom</Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-6 px-1" onClick={() => window.open(getMapUrl(c.lat, c.lng), '_blank')}><MapPin className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-6 px-1" onClick={() => window.open(getNavUrl(c.lat, c.lng), '_blank')}><Navigation className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
                {!visibleDcpTrafficHotspots.length && (
                  <div className="flex flex-col items-center py-6 text-slate-400 gap-1">
                    <Radio className="h-6 w-6 opacity-30" />
                    <p className="text-xs">Run scan to see live locations</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Incidents header ── */}
            <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-1.5 z-10 rounded-lg px-1">
              <span className="text-xs font-semibold text-slate-600">{incidents.length} incident(s) in your jurisdiction</span>
              {selected && <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setSelected(null); setFocus(null) }}>Clear focus</Button>}
            </div>
            {incidents.length === 0 && (
              <div className="flex flex-col items-center py-8 text-slate-400 gap-2 border rounded-xl bg-white">
                <Siren className="h-8 w-8 opacity-20" />
                <p className="text-sm">No incidents match current filter</p>
              </div>
            )}
            {incidents.map(i => {
              const lat = i.location.coordinates[1], lng = i.location.coordinates[0]
              const isSelected = selected?.id === i.id
              const tps = tpsList.find(t => t.id === i.psId || t.id === i.tpsId)
              const sevLeft = { critical: 'border-l-red-600', high: 'border-l-orange-500', medium: 'border-l-amber-400', low: 'border-l-emerald-500' }[i.severity] || 'border-l-slate-300'
              return (
                <div key={i.id} className={`border border-l-4 ${sevLeft} rounded-xl p-3 bg-white shadow-sm cursor-pointer transition-shadow hover:shadow-md ${isSelected ? 'ring-2 ring-indigo-400' : ''}`} onClick={() => onCardClick(i)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{i.areaName || i.address}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{tps?.name || 'Unknown PS'}{tps?.zoneName ? ` · ${tps.zoneName}` : ''}</div>
                    </div>
                    <Badge className={`${sevBadge(i.severity)} text-white shrink-0 text-[10px]`}>{(i.severity || 'medium').toUpperCase()}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-2 text-slate-600">
                    <div>Delay: <strong>{i.estimatedDelayMin ?? '—'} min</strong></div>
                    <div>Queue: <strong>{i.queueLengthM ? (i.queueLengthM > 1000 ? (i.queueLengthM/1000).toFixed(1)+' km' : i.queueLengthM+' m') : '—'}</strong></div>
                    <div className="flex items-center gap-1">Status: <Badge variant={i.status === 'cleared' ? 'default' : i.status === 'dispatched' ? 'secondary' : 'destructive'} className="text-[10px]">{i.status}</Badge></div>
                    <div className="text-slate-400">{new Date(i.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); onCardClick(i) }}>
                      <Eye className="h-3 w-3 mr-1" /> Zoom
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); openInGoogleMaps(i) }}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Maps
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="analytics">
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-indigo-600" /> Hourly Incidents (Last 24h)</CardTitle>
              <CardDescription>Across your assigned zones only</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.hourly.length === 0
                ? <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2"><BarChart3 className="h-8 w-8 opacity-30" /><p className="text-sm">No data yet</p></div>
                : <div className="space-y-1.5">
                    {analytics.hourly.map(h => {
                      const max = Math.max(...analytics.hourly.map(x => Number(x.count)))
                      const pct = Math.max(4, (Number(h.count) / Math.max(max, 1)) * 100)
                      const color = Number(h.count) >= max * 0.7 ? '#ef4444' : Number(h.count) >= max * 0.4 ? '#f59e0b' : '#6366f1'
                      return (
                        <div key={h.hour} className="flex items-center gap-2 text-xs">
                          <div className="w-12 text-right font-mono text-slate-500">{String(h.hour).padStart(2, '0')}:00</div>
                          <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                            <div className="absolute inset-0 flex items-center px-2.5 font-semibold text-slate-700">{h.count}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-indigo-600" /> PS-wise Traffic Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.psWise.length === 0
                ? <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2"><Building2 className="h-8 w-8 opacity-30" /><p className="text-sm">No data yet</p></div>
                : <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[280px]">
                      <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="pb-2">Traffic PS</th><th className="pb-2">Incidents</th><th className="pb-2">Avg Delay</th></tr></thead>
                      <tbody>
                        {analytics.psWise.map(p => (
                          <tr key={p.ps_id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{p.ps_name || p.ps_id}</td>
                            <td><Badge variant="outline">{p.count}</Badge></td>
                            <td className="text-slate-600">{p.avg_delay ? Number(p.avg_delay).toFixed(1) + ' min' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="seniors">
        <FamilyManagement user={user} />
      </TabsContent>

      <TabsContent value="escalations">
        <EscalationsTab user={user} scopeDcpId={user.id} />
      </TabsContent>
    </Tabs>
  )
}

// ====================================================================
// FAMILY MANAGEMENT - shared by Super Admin / DCP / SHO
// ====================================================================
function FamilyManagement({ user }) {
  const [families, setFamilies] = useState([])
  const [marshals, setMarshals] = useState([])
  const [assignments, setAssignments] = useState([])
  const [visits, setVisits] = useState([])
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignFamily, setAssignFamily] = useState(null)
  const [assignForm, setAssignForm] = useState({ marshalId: '', visitFrequency: 'weekly', instructions: '' })
  const [filter, setFilter] = useState('all')
  const [zones, setZones] = useState([])
  const [tpsList, setTpsList] = useState([])
  const [assignedTps, setAssignedTps] = useState(null)

  const load = async () => {
    try {
      const url = user.role === 'sho' ? `/families?shoId=${user.id}` : user.role === 'dcp' ? `/families?dcpId=${user.id}` : '/families'
      const areaUrl = user.role === 'sho' ? `/sho/${user.id}/tps` : user.role === 'dcp' ? `/dcp/${user.id}/tps` : '/tps'
      const [f, m, a, v, area, allZones] = await Promise.all([
        api(url), api('/marshals'), api('/assignments'), api('/visits'), api(areaUrl), user.role === 'super_admin' ? api('/zones') : Promise.resolve(null),
      ])
      setFamilies(f?.families || [])
      setMarshals(m?.marshals || [])
      setAssignments(a?.assignments || [])
      setVisits(v?.visits || [])
      setZones(area?.zones || allZones?.zones || [])
      setTpsList(area?.tps ? (Array.isArray(area.tps) ? area.tps : [area.tps]) : [])
      setAssignedTps(area?.tps && !Array.isArray(area.tps) ? area.tps : null)
    } catch (e) { console.error('Families load', e) }
  }
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t) }, [])

  const empty = {
    seniorName: '', age: '', gender: 'male', mobile: '', altContact: '',
    address: '', landmark: '', zone: '', zoneId: '', psId: '', tpsId: '', riskCategory: 'low',
    emergencyContactName: '', emergencyContactPhone: '',
    medicalConditions: '', doctorName: '', hospitalName: '', medicationNotes: '',
    lat: '', lng: '',
  }
  const [form, setForm] = useState(empty)

  const openCreate = () => {
    setEditing(null)
    setForm(user.role === 'sho' && assignedTps ? { ...empty, zone: assignedTps.zoneName || '', zoneId: assignedTps.zoneId || '', psId: assignedTps.id, tpsId: assignedTps.id } : empty)
    setOpen(true)
  }
  const openEdit = (f) => {
    setEditing(f)
    setForm({
      ...empty, ...f,
      age: f.age || '', lat: f.lat || '', lng: f.lng || '', tpsId: f.tpsId || f.psId || '', psId: f.psId || f.tpsId || '',
    })
    setOpen(true)
  }
  const save = async () => {
    if (!form.seniorName) return toast.error('Senior name required')
    const selectedTps = user.role === 'sho' ? assignedTps : tpsList.find(t => t.id === (form.tpsId || form.psId))
    if (!selectedTps?.id) return toast.error('Select Traffic Police Station')
    const payload = { ...form, age: form.age ? parseInt(form.age) : null,
      lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null,
      createdBy: user.id, dcpId: user.role === 'dcp' ? user.id : (form.dcpId || null),
      psId: selectedTps.id, tpsId: selectedTps.id, zone: selectedTps.zoneName || form.zone,
    }
    if (editing) {
      const r = await api(`/families/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      if (r.error) return toast.error(r.error)
      toast.success('Family updated')
    } else {
      const r = await api('/families', { method: 'POST', body: JSON.stringify(payload) })
      if (r.error) return toast.error(r.error)
      toast.success(`Created ${r.family.familyCode}`)
    }
    setOpen(false); load()
  }
  const del = async (f) => {
    if (!confirm(`Delete ${f.seniorName}?`)) return
    await api(`/families/${f.id}`, { method: 'DELETE' })
    toast.success('Deleted'); load()
  }
  const openAssign = (f) => { setAssignFamily(f); setAssignForm({ marshalId: '', visitFrequency: 'weekly', instructions: '' }); setAssignOpen(true) }
  const assign = async () => {
    if (!assignForm.marshalId) return toast.error('Select marshal/volunteer')
    const r = await api('/assignments', {
      method: 'POST',
      body: JSON.stringify({
        familyId: assignFamily.id, marshalId: assignForm.marshalId,
        visitFrequency: assignForm.visitFrequency, instructions: assignForm.instructions, assignedBy: user.id,
      })
    })
    if (r.error) return toast.error(r.error)
    toast.success('Assigned successfully'); setAssignOpen(false); load()
  }

  const familyAssignments = (familyId) => assignments.filter(a => a.familyId === familyId)
  const familyLastVisit = (familyId) => visits.find(v => v.familyId === familyId)
  const riskColor = { low: 'bg-emerald-600', medium: 'bg-amber-500', high: 'bg-orange-600', emergency: 'bg-red-600' }

  const filtered = filter === 'all' ? families : families.filter(f => f.riskCategory === filter)
  const availableTps = user.role === 'sho' ? (assignedTps ? [assignedTps] : []) : tpsList.filter(t => !form.zoneId || t.zoneId === form.zoneId || t.zone_id === form.zoneId)
  const assignableMarshals = assignFamily ? marshals.filter(m => m.role === 'marshal' && (!assignFamily.tpsId || m.tpsId === assignFamily.tpsId || m.tpsId === assignFamily.psId)) : marshals.filter(m => m.role === 'marshal')

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-pink-600" /> Senior Citizen Protection Program</CardTitle>
            <CardDescription>{families.length} families · {assignments.length} active assignments{user.role === 'sho' && assignedTps ? ` · ${assignedTps.name}` : ''}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="emergency">Emergency Monitoring</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full sm:w-auto" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Family</Button>
          </div>
          </div>
        </CardHeader>
        <CardContent>
          {user.role === 'sho' && assignedTps && (
            <div className="mb-3 rounded-lg border bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Senior citizens created here are automatically mapped to your Traffic Police Station: <strong>{assignedTps.name}</strong>.
            </div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(f => {
              const asg = familyAssignments(f.id)
              const lv = familyLastVisit(f.id)
              return (
                <div key={f.id} className="border rounded-lg p-3 bg-white space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{f.seniorName} <span className="text-xs text-slate-400">({f.age || '?'} {f.gender || ''})</span></div>
                      <div className="text-[11px] font-mono text-slate-500">{f.familyCode}</div>
                    </div>
                    <Badge className={`${riskColor[f.riskCategory]} text-white text-[10px]`}>{(f.riskCategory || 'low').toUpperCase()}</Badge>
                  </div>
                  <div className="text-xs text-slate-600">{f.address}</div>
                  <div className="text-xs flex items-center gap-3 text-slate-500">
                    <span>📞 {f.mobile || '-'}</span>
                    <span>{f.zone}</span>
                  </div>
                  {f.medicalConditions && <div className="text-xs flex items-start gap-1"><Stethoscope className="h-3 w-3 text-red-600 mt-0.5 shrink-0" /><span className="text-slate-600">{f.medicalConditions}</span></div>}
                  <div className="border-t pt-2 text-xs">
                    {asg.length > 0 ? (
                      <div>
                        <div className="text-slate-500 mb-0.5">Assigned to {asg.length} marshal(s):</div>
                        {asg.slice(0, 2).map(a => {
                          const m = marshals.find(x => x.id === a.marshalId)
                          return <div key={a.id} className="flex items-center justify-between"><span>{m?.name || 'Unknown'} <span className="text-slate-400">· {a.visitFrequency}</span></span><Badge variant="outline" className="text-[9px]">{a.status}</Badge></div>
                        })}
                      </div>
                    ) : (
                      <div className="text-amber-700">Not assigned yet</div>
                    )}
                    {lv && <div className="text-[10px] text-slate-400 mt-1">Last visit: {new Date(lv.createdAt).toLocaleDateString()}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openAssign(f)}><UserPlus className="h-3 w-3 mr-1" /> Assign</Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del(f)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  </div>
                </div>
              )
            })}
            {!filtered.length && <div className="col-span-full text-center text-sm text-slate-500 py-8">No families match filter.</div>}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Family Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Edit ${editing.familyCode}` : 'Register Senior Citizen Family'}</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Senior Name *</Label><Input value={form.seniorName} onChange={e => setForm({ ...form, seniorName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Age</Label><Input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /></div>
              <div><Label>Gender</Label>
                <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Mobile</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><Label>Alternate Contact</Label><Input value={form.altContact} onChange={e => setForm({ ...form, altContact: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Landmark</Label><Input value={form.landmark} onChange={e => setForm({ ...form, landmark: e.target.value })} /></div>
            <div><Label>Zone</Label>
              <Select value={form.zoneId || ''} onValueChange={v => setForm({ ...form, zoneId: v, tpsId: '', psId: '', zone: zones.find(z => z.id === v)?.name || '' })} disabled={user.role === 'sho'}>
                <SelectTrigger><SelectValue placeholder={assignedTps?.zoneName || 'Select zone'} /></SelectTrigger>
                <SelectContent>
                  {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Traffic Police Station *</Label>
              <Select value={(user.role === 'sho' ? assignedTps?.id : form.tpsId) || ''} onValueChange={v => setForm({ ...form, tpsId: v, psId: v })} disabled={user.role === 'sho'}>
                <SelectTrigger><SelectValue placeholder={assignedTps?.name || 'Select Traffic PS'} /></SelectTrigger>
                <SelectContent>
                  {availableTps.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.zoneName ? ` (${t.zoneName})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Risk Category</Label>
              <Select value={form.riskCategory} onValueChange={v => setForm({ ...form, riskCategory: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Risk</SelectItem><SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem><SelectItem value="emergency">Emergency Monitoring</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Emergency Contact Name</Label><Input value={form.emergencyContactName} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} /></div>
            <div><Label>Emergency Contact Phone</Label><Input value={form.emergencyContactPhone} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Medical Conditions</Label><Textarea rows={2} value={form.medicalConditions} onChange={e => setForm({ ...form, medicalConditions: e.target.value })} /></div>
            <div><Label>Doctor Name</Label><Input value={form.doctorName} onChange={e => setForm({ ...form, doctorName: e.target.value })} /></div>
            <div><Label>Hospital Name</Label><Input value={form.hospitalName} onChange={e => setForm({ ...form, hospitalName: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Medication Notes</Label><Textarea rows={2} value={form.medicationNotes} onChange={e => setForm({ ...form, medicationNotes: e.target.value })} /></div>
            <div><Label>Latitude</Label><Input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="17.4399" /></div>
            <div><Label>Longitude</Label><Input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="78.4738" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Register Family'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Marshal Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Family Visit</DialogTitle></DialogHeader>
          {assignFamily && (
            <div className="space-y-3">
              <div className="bg-slate-100 p-3 rounded text-sm">
                <div className="font-semibold">{assignFamily.seniorName}</div>
                <div className="text-xs text-slate-600">{assignFamily.address}</div>
              </div>
              <div><Label>Marshal / Volunteer</Label>
                <Select value={assignForm.marshalId} onValueChange={v => setAssignForm({ ...assignForm, marshalId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {assignableMarshals.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.zone || 'Traffic Marshal'})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Visit Frequency</Label>
                <Select value={assignForm.visitFrequency} onValueChange={v => setAssignForm({ ...assignForm, visitFrequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="emergency">Emergency Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Instructions</Label><Textarea rows={2} value={assignForm.instructions} onChange={e => setAssignForm({ ...assignForm, instructions: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={assign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ====================================================================
// ASSIGNED VISITS + VISIT START DIALOG (Marshal/Volunteer)
// ====================================================================
function AssignedVisitsCard({ user, marshalInfo }) {
  const [assignments, setAssignments] = useState([])
  const [visitOpen, setVisitOpen] = useState(false)
  const [activeAssignment, setActiveAssignment] = useState(null)
  const [form, setForm] = useState({ photo: null, condition: 'safe', notes: '', gps: null, address: '' })
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const r = await api(`/assignments?marshalId=${user.id}`)
    setAssignments((r?.assignments || []).filter(a => a.status !== 'completed'))
  }
  useEffect(() => { load(); const t = setInterval(load, 7000); return () => clearInterval(t) }, [])

  const startVisit = async (a) => {
    setActiveAssignment(a)
    setForm({ photo: null, condition: 'safe', notes: '', gps: null, address: a.family?.address || '' })
    setVisitOpen(true)
    // capture GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setForm(f => ({ ...f, gps: { lat: pos.coords.latitude, lng: pos.coords.longitude } })),
        () => {
          if (a.family?.lat && a.family?.lng) {
            setForm(f => ({ ...f, gps: { lat: a.family.lat, lng: a.family.lng } }))
          }
        },
        { timeout: 5000, enableHighAccuracy: true }
      )
    }
  }

  const setPhoto = async (b64) => {
    if (!b64) { setForm(f => ({ ...f, photo: null })); return }
    setBusy(true)
    try {
      const gps = form.gps || (activeAssignment?.family?.lat ? { lat: activeAssignment.family.lat, lng: activeAssignment.family.lng } : { lat: 0, lng: 0 })
      const now = new Date()
      const lines = [
        `Visited: ${now.toLocaleDateString()} | ${now.toLocaleTimeString()}`,
        `Location: ${activeAssignment?.family?.address || form.address}`,
        `Lat: ${gps.lat?.toFixed?.(5)} Lng: ${gps.lng?.toFixed?.(5)}`,
        `Volunteer: ${marshalInfo?.name || user.name}`,
        `Family: ${activeAssignment?.family?.name || ''}`,
      ]
      const watermarked = await watermarkPhoto(b64, lines)
      setForm(f => ({ ...f, photo: watermarked }))
      toast.success('Watermark applied')
    } catch (e) { console.error(e); toast.error('Watermark failed') }
    setBusy(false)
  }

  const submit = async () => {
    if (!form.photo) return toast.error('Selfie photo is mandatory')
    if (!form.gps) return toast.error('GPS location not captured')
    setBusy(true)
    const r = await api('/visits', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: activeAssignment.id, familyId: activeAssignment.familyId,
        marshalId: user.id, marshalName: marshalInfo?.name || user.name,
        familyName: activeAssignment.family?.name,
        lat: form.gps.lat, lng: form.gps.lng, address: form.address,
        selfiePhoto: form.photo, visitStart: new Date().toISOString(),
        visitEnd: new Date().toISOString(),
        familyCondition: form.condition, notes: form.notes,
      })
    })
    setBusy(false)
    if (r.error) return toast.error(r.error)
    toast.success(`Visit logged! +${r.pointsAwarded} points${r.escalationId ? ' · ESCALATION RAISED' : ''}`)
    setVisitOpen(false); load()
  }

  const freqColor = { daily: 'bg-blue-600', weekly: 'bg-green-600', monthly: 'bg-amber-600', emergency: 'bg-red-600' }
  const riskColor = { emergency: 'text-red-700', high: 'text-orange-700', medium: 'text-amber-700', low: 'text-emerald-700' }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-600" /> Senior Citizen Visits ({assignments.length})
          </CardTitle>
          <CardDescription>Periodic welfare checks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-auto">
          {assignments.length === 0 && <p className="text-sm text-slate-500">No assigned families.</p>}
          {assignments.map(a => (
            <div key={a.id} className="border rounded-lg p-3 bg-slate-50 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{a.family?.name}</div>
                  <div className={`text-xs font-medium ${riskColor[a.family?.riskCategory] || ''}`}>{(a.family?.riskCategory || 'low').toUpperCase()} risk</div>
                </div>
                <Badge className={`${freqColor[a.visitFrequency]} text-white text-[10px]`}>{a.visitFrequency.toUpperCase()}</Badge>
              </div>
              <div className="text-xs text-slate-600">{a.family?.address}</div>
              {a.family?.medical && <div className="text-xs text-red-600 flex items-start gap-1"><Stethoscope className="h-3 w-3 mt-0.5 shrink-0" /><span>{a.family.medical}</span></div>}
              {a.instructions && <div className="text-xs italic text-slate-500">"{a.instructions}"</div>}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-pink-600 hover:bg-pink-700" onClick={() => startVisit(a)}>
                  <Camera className="h-3 w-3 mr-1" /> Start Visit
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${a.family?.lat},${a.family?.lng}`, '_blank')}>
                  <Navigation className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Senior Citizen Visit · {activeAssignment?.family?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="bg-slate-100 p-3 rounded text-xs space-y-1">
              <div><strong>Address:</strong> {activeAssignment?.family?.address}</div>
              <div><strong>Mobile:</strong> {activeAssignment?.family?.mobile}</div>
              <div><strong>GPS:</strong> {form.gps ? `${form.gps.lat.toFixed(5)}, ${form.gps.lng.toFixed(5)}` : <span className="text-amber-600">Capturing…</span>}</div>
            </div>
            <div>
              <Label>Mandatory Selfie (with auto-watermark)</Label>
              <PhotoUploader value={form.photo} onChange={setPhoto} label="Capture selfie at family location" />
            </div>
            <div>
              <Label>Family Condition *</Label>
              <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">✓ Safe</SelectItem>
                  <SelectItem value="medical">🩺 Medical Support Needed</SelectItem>
                  <SelectItem value="emergency">🚨 Emergency Assistance Required</SelectItem>
                  <SelectItem value="police_followup">👮 Police Follow-up Needed</SelectItem>
                </SelectContent>
              </Select>
              {form.condition !== 'safe' && <p className="text-xs text-red-600 mt-1">⚠️ Escalation will auto-trigger to SHO & DCP</p>}
            </div>
            <div>
              <Label>Visit Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Health status, safety concerns, remarks…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !form.photo}>{busy ? 'Submitting…' : 'Submit Visit Log'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ====================================================================
// ESCALATIONS TAB
// ====================================================================
function EscalationsTab({ user, scopeDcpId }) {
  const [list, setList] = useState([])
  const load = async () => {
    const url = scopeDcpId ? `/escalations?dcpId=${scopeDcpId}` : '/escalations'
    const r = await api(url); setList(r?.escalations || [])
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [scopeDcpId])

  const ack = async (id) => { await api(`/escalations/${id}/ack`, { method: 'POST', body: JSON.stringify({ ackBy: user.id }) }); load() }
  const resolve = async (id) => { await api(`/escalations/${id}/resolve`, { method: 'POST' }); toast.success('Resolved'); load() }

  const prioColor = { critical: 'bg-red-600', high: 'bg-orange-600', medium: 'bg-amber-500', low: 'bg-slate-500' }
  const statusColor = { open: 'bg-red-100 text-red-700', acknowledged: 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700' }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-red-600" /> Emergency Escalations</CardTitle>
        <CardDescription>Auto-raised when marshals flag medical / emergency / police-followup conditions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[65vh] overflow-auto">
        {list.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No escalations.</p>}
        {list.map(e => (
          <div key={e.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className={`${prioColor[e.priority]} text-white`}>{e.priority.toUpperCase()}</Badge>
                <span className={`text-xs px-2 py-0.5 rounded ${statusColor[e.status]}`}>{e.status}</span>
                <span className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <div className="font-semibold mt-1">{e.familyName} <span className="text-xs text-slate-400">({e.familyCode})</span></div>
              <div className="text-xs text-slate-600">Raised by: {e.marshalName}</div>
              <div className="text-sm mt-1">{e.reason}</div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {e.status === 'open' && <Button size="sm" variant="outline" onClick={() => ack(e.id)}>Acknowledge</Button>}
              {e.status !== 'resolved' && <Button size="sm" onClick={() => resolve(e.id)}>Resolve</Button>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ====================================================================
// ADMIN DASHBOARD (existing) - already defined below
// ====================================================================
function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [marshals, setMarshals] = useState([])
  const [zones, setZones] = useState([])
  const [incidents, setIncidents] = useState([])

  const loadAll = async () => {
    try {
      const [s, a, l, m, z, i] = await Promise.all([
        api('/admin/stats'), api('/admin/attendance'), api('/admin/leaderboard'),
        api('/marshals'), api('/zones'), api('/incidents'),
      ])
      setStats(s?.stats || null)
      setAttendance(a?.attendance || [])
      setLeaderboard(l?.leaderboard || [])
      setMarshals(m?.marshals || [])
      setZones(z?.zones || [])
      setIncidents(i?.incidents || [])
    } catch (e) { console.error('Admin load error', e) }
  }
  useEffect(() => { loadAll(); const t = setInterval(loadAll, 5000); return () => clearInterval(t) }, [])

  const coverageGaps = useMemo(() => {
    const byZone = {}
    attendance.forEach(a => {
      if (!byZone[a.zone]) byZone[a.zone] = { total: 0, online: 0, active: 0 }
      byZone[a.zone].total++
      if (a.status === 'online') byZone[a.zone].online++
      if (a.status === 'active') byZone[a.zone].active++
    })
    return Object.entries(byZone).map(([zone, v]) => ({ zone, ...v, coverage: ((v.online + v.active) / Math.max(v.total, 1) * 100).toFixed(0) }))
  }, [attendance])

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_60%)]" />
        <div className="relative px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-indigo-200 font-semibold">Super Admin Command Center</div>
            <div className="text-lg sm:text-2xl font-extrabold mt-1">Citywide Traffic Operations</div>
            <div className="text-xs text-indigo-200 mt-1">Unified view of zones, incidents, force attendance and performance</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs w-full sm:w-auto">
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-indigo-200">Active Units</div>
              <div className="font-bold text-base">{stats?.active || 0}</div>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-indigo-200">Open Alerts</div>
              <div className="font-bold text-base">{stats?.open || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <TabsList className="w-max h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 mr-1" /><span>Overview</span></TabsTrigger>
          <TabsTrigger value="zones" className="text-xs sm:text-sm"><MapPin className="h-3.5 w-3.5 mr-1" /><span>Zones</span></TabsTrigger>
          <TabsTrigger value="tps" className="text-xs sm:text-sm"><Building2 className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Traffic </span>PS</TabsTrigger>
          <TabsTrigger value="map" className="text-xs sm:text-sm"><MapPin className="h-3.5 w-3.5 mr-1" /><span>Map</span></TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs sm:text-sm"><Clock className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Attendance</span><span className="sm:hidden">Attend.</span></TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs sm:text-sm"><Trophy className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Leaderboard</span><span className="sm:hidden">Board</span></TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs sm:text-sm"><Siren className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Incidents</span><span className="sm:hidden">Inc.</span></TabsTrigger>
          <TabsTrigger value="activities" className="text-xs sm:text-sm"><ImageIcon className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Activities</span><span className="sm:hidden">Acts.</span></TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm"><Users className="h-3.5 w-3.5 mr-1" /><span>Users</span></TabsTrigger>
          <TabsTrigger value="seniors" className="text-xs sm:text-sm"><Heart className="h-3.5 w-3.5 mr-1" /><span>Seniors</span></TabsTrigger>
          <TabsTrigger value="escalations" className="text-xs sm:text-sm"><Bell className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Escalations</span><span className="sm:hidden">Esc.</span></TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm"><FileText className="h-3.5 w-3.5 mr-1" /><span>Audit</span></TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Marshals', value: stats?.total || 0, icon: <Users className="h-4 w-4" />, tone: 'border-slate-300 bg-slate-50 text-slate-700' },
            { label: 'Active Now', value: stats?.active || 0, icon: <Activity className="h-4 w-4" />, tone: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
            { label: 'Online Ready', value: stats?.online || 0, icon: <Radio className="h-4 w-4" />, tone: 'border-blue-300 bg-blue-50 text-blue-700' },
            { label: 'Offline', value: stats?.offline || 0, icon: <LogOut className="h-4 w-4" />, tone: 'border-slate-300 bg-white text-slate-600' },
            { label: 'Incidents', value: stats?.incidents || 0, icon: <Siren className="h-4 w-4" />, tone: 'border-amber-300 bg-amber-50 text-amber-700' },
            { label: 'Open Alerts', value: stats?.open || 0, icon: <AlertTriangle className="h-4 w-4" />, tone: 'border-red-300 bg-red-50 text-red-700' },
            { label: 'Cleared', value: stats?.cleared || 0, icon: <CheckCircle2 className="h-4 w-4" />, tone: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
            { label: 'Zones', value: 4, icon: <MapPin className="h-4 w-4" />, tone: 'border-indigo-300 bg-indigo-50 text-indigo-700' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl border-2 p-3 shadow-sm ${item.tone}`}>
              <div className="flex items-center justify-between">
                {item.icon}
                <span className="text-[10px] uppercase tracking-wide opacity-80">{item.label}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold mt-2 leading-none">{item.value}</div>
            </div>
          ))}
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-600" /> Zone Coverage</CardTitle>
            <CardDescription>Live coverage by zone</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {coverageGaps.map(z => (
              <div key={z.zone} className="rounded-xl border p-3 bg-white">
                <div className="font-semibold text-slate-700">{z.zone}</div>
                <div className="text-3xl font-extrabold" style={{ color: z.coverage >= 60 ? '#16a34a' : z.coverage >= 30 ? '#f59e0b' : '#dc2626' }}>{z.coverage}%</div>
                <div className="text-xs text-slate-500">{z.online + z.active} / {z.total} on duty</div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, Number(z.coverage))}%`, backgroundColor: Number(z.coverage) >= 60 ? '#16a34a' : Number(z.coverage) >= 30 ? '#f59e0b' : '#dc2626' }} />
                </div>
              </div>
            ))}
            {coverageGaps.length === 0 && (
              <div className="col-span-full text-sm text-slate-500 text-center py-6">No attendance data available yet.</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="map">
        <div className="rounded-xl overflow-hidden border shadow-sm h-[52vw] min-h-[320px] max-h-[620px] lg:h-[calc(100vh-240px)] lg:min-h-[520px] lg:max-h-none">
          <GoogleMapView
            apiKey={GMAPS_KEY}
            incidents={incidents}
            polygons={zones}
            families={marshals.map(m => ({ lat: m.currentLocation.coordinates[1], lng: m.currentLocation.coordinates[0], seniorName: m.name, riskCategory: m.status, familyCode: m.id }))}
          />
        </div>
      </TabsContent>

      <TabsContent value="attendance">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">7-Day Attendance Log</CardTitle>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => exportCSV('attendance.csv',
              ['Name','Role','Zone','Status','Toggles (7d)','Last Seen'],
              attendance.map(a => [a.name, a.role, a.zone, a.status, a.toggleCount, a.lastSeen ? new Date(a.lastSeen).toLocaleString() : '']))
            }><FileText className="h-3 w-3 mr-1" /> Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[65vh] rounded-lg border">
              <table className="w-full text-sm min-w-[540px]">
                <thead className="text-left bg-slate-100 sticky top-0">
                  <tr><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Zone</th><th className="p-2">Status</th><th className="p-2">Toggles (7d)</th><th className="p-2">Last Seen</th></tr>
                </thead>
                <tbody>
                  {attendance.map(a => (
                    <tr key={a.id} className="border-b">
                      <td className="p-2 font-medium">{a.name}</td>
                      <td className="p-2">{a.role}</td>
                      <td className="p-2">{a.zone}</td>
                      <td className="p-2"><Badge className={a.status === 'active' ? 'bg-green-600' : a.status === 'online' ? 'bg-blue-600' : 'bg-slate-500'}>{a.status}</Badge></td>
                      <td className="p-2">{a.toggleCount}</td>
                      <td className="p-2 text-xs">{a.lastSeen ? new Date(a.lastSeen).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leaderboard">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Performance Rewards</CardTitle>
              <CardDescription>Points based on response time & incidents cleared</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => exportCSV('leaderboard.csv',
              ['Rank','Name','Zone','Role','Points'],
              leaderboard.map((m, idx) => [idx + 1, m.name, m.zone, m.role, m.points]))
            }><FileText className="h-3 w-3 mr-1" /> Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leaderboard.length === 0 && <div className="text-sm text-slate-500 p-6 text-center rounded-lg border bg-white">No leaderboard data yet.</div>}
              {leaderboard.map((m, idx) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border rounded-xl p-3 bg-white">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300 text-slate-700'}`}>{idx + 1}</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-xs text-slate-500 truncate">{m.zone} · {m.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-600 font-bold shrink-0"><Trophy className="h-4 w-4" /> {m.points}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="incidents">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">Incident Report</CardTitle>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => exportCSV('incidents.csv',
              ['Time','Address','Severity','Level','Status','Delay (min)','Queue (m)'],
              incidents.map(i => [new Date(i.createdAt).toLocaleString(), i.address, i.severity, i.level, i.status, i.estimatedDelayMin || '', i.queueLengthM || '']))
            }><FileText className="h-3 w-3 mr-1" /> Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {incidents.length === 0 && <div className="text-sm text-slate-500 p-6 text-center rounded-lg border bg-white">No incidents found.</div>}
              {incidents.map(i => (
                <div key={i.id} className="border rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 text-sm bg-white">
                  {i.photoUrl && <img src={i.photoUrl} alt="" className="w-full sm:w-20 h-36 sm:h-20 object-cover rounded flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{i.address}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(i.createdAt).toLocaleString()} · Severity: {i.severity} · Level {i.level}</div>
                  </div>
                  <Badge className={`${i.status === 'cleared' ? 'bg-green-600' : i.status === 'dispatched' ? 'bg-blue-600' : 'bg-red-600'} w-fit`}>{i.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activities">
        <ActivitiesTab />
      </TabsContent>

      <TabsContent value="users">
        <UserManagementTab />
      </TabsContent>

      <TabsContent value="zones">
        <ZonesTab />
      </TabsContent>

      <TabsContent value="tps">
        <TrafficPSTab />
      </TabsContent>

      <TabsContent value="seniors">
        <FamilyManagement user={user} />
      </TabsContent>

      <TabsContent value="escalations">
        <EscalationsTab user={user} />
      </TabsContent>

      <TabsContent value="audit">
        <AuditLogsTab />
      </TabsContent>
    </Tabs>
  )
}

const StatCard = ({ label, value, icon, color }) => {
  const bgMap = { slate: 'bg-slate-100', green: 'bg-green-100', blue: 'bg-blue-100', gray: 'bg-gray-100', amber: 'bg-amber-100', red: 'bg-red-100', emerald: 'bg-emerald-100', purple: 'bg-purple-100' }
  const tMap = { slate: 'text-slate-700', green: 'text-green-700', blue: 'text-blue-700', gray: 'text-gray-700', amber: 'text-amber-700', red: 'text-red-700', emerald: 'text-emerald-700', purple: 'text-purple-700' }
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        <div className={`p-2 rounded-lg ${bgMap[color]} ${tMap[color]}`}>{icon}</div>
      </CardContent>
    </Card>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('mksc_user')
    if (u) setUser(JSON.parse(u))
    setHydrated(true)
  }, [])

  const logout = () => { localStorage.removeItem('mksc_user'); setUser(null) }

  if (!hydrated) return null
  if (!user) return <LoginScreen onLogin={setUser} />

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} onLogout={logout} />
      <main className="max-w-7xl mx-auto p-4">
        {user.role === 'sho' && (
          <Tabs defaultValue="traffic" className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="w-max h-auto">
                <TabsTrigger value="traffic" className="text-xs sm:text-sm"><Siren className="h-3.5 w-3.5 mr-1" /> Traffic</TabsTrigger>
                <TabsTrigger value="seniors" className="text-xs sm:text-sm"><Heart className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Senior Citizens</span><span className="sm:hidden">Seniors</span></TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="traffic"><SHODashboard user={user} /></TabsContent>
            <TabsContent value="seniors"><FamilyManagement user={user} /></TabsContent>
          </Tabs>
        )}
        {user.role === 'super_admin' && <AdminDashboard user={user} />}
        {user.role === 'dcp' && <DCPDashboard user={user} />}
        {user.role === 'marshal' && <MarshalDashboard user={user} onStaleUser={logout} />}
        {user.role === 'volunteer' && <VolunteerDashboard user={user} onStaleUser={logout} />}
      </main>
    </div>
  )
}

export default App
