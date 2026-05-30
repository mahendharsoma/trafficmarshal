'use client'

import { useState, useEffect, useMemo } from 'react'
import { Radio, BarChart3, Heart, Bell, Siren, AlertTriangle, CheckCircle2, Activity, Building2, MapPin, Navigation, Eye, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { api } from '@/app/utils/api'
import { getMapUrl, getNavUrl, getTrafficDensityRatio } from '@/app/utils/mapUtils'
import { GMAPS_KEY, TRAFFIC_PRIORITY, TRAFFIC_PRIORITY_LABEL, TRAFFIC_STATUS_LABEL, TRAFFIC_SAMPLE_ROUTES } from '@/app/constants/traffic'
import FamilyManagement from '@/app/components/tabs/FamilyManagement'
import EscalationsTab from '@/app/components/tabs/EscalationsTab'
import getLoader from '@/lib/googleMapsLoader'

const GoogleMapView = dynamic(() => import('@/components/GoogleMapView'), { ssr: false })

export default function DCPDashboard({ user }) {
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
  const [allUnits, setAllUnits] = useState([])

  const load = async () => {
    try {
      const [zt, st, an, inc, mu] = await Promise.all([
        api(`/dcp/${user.id}/tps`),
        api(`/dcp/${user.id}/stats`),
        api(`/dcp/${user.id}/analytics`),
        api(`/dcp/${user.id}/incidents?shoId=${tpsFilter}&range=${range}`),
        api('/marshals'),
      ])
      setZones(zt?.zones || [])
      setTpsList(zt?.tps || [])
      setStats(st?.stats || null)
      setAnalytics(an || { hourly: [], psWise: [] })
      setIncidents(inc?.incidents || [])
      setAllUnits(mu?.marshals || [])
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

  // Map markers: marshals filtered to DCP jurisdiction TPS, all volunteers
  const dcpTpsIds = useMemo(() => new Set(tpsList.map(t => t.id)), [tpsList])
  const mapUnits = useMemo(() => [
    ...allUnits.filter(m => m.role === 'marshal' && dcpTpsIds.has(m.tpsId)),
    ...allUnits.filter(m => m.role === 'volunteer'),
  ], [allUnits, dcpTpsIds])
  const mapFamilies = useMemo(() => mapUnits
    .filter(m => m.currentLocation?.coordinates)
    .map(m => ({
      lat: m.currentLocation.coordinates[1],
      lng: m.currentLocation.coordinates[0],
      seniorName: m.name,
      riskCategory: `${m.role}_${m.status === 'offline' ? 'offline' : 'online'}`,
      familyCode: m.id,
      role: m.role,
      status: m.status,
    })), [mapUnits])

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
            <GoogleMapView apiKey={GMAPS_KEY} incidents={incidents} polygons={tpsPolygons} hotspots={visibleDcpTrafficHotspots} families={mapFamilies} focus={focus} onIncidentClick={onCardClick} onHotspotClick={selectDcpTrafficGrid} center={mapCenter} zoom={11} fitToPolygons />
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
