'use client'

import { useState, useEffect } from 'react'
import { Siren, AlertTriangle, Navigation, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { api } from '@/app/utils/api'
import { GMAPS_KEY } from '@/app/constants/traffic'
import ActivityReportCard from '@/app/components/shared/ActivityReportCard'
import AssignedVisitsCard from '@/app/components/shared/AssignedVisitsCard'
import dynamic from 'next/dynamic'

const GoogleMapView = dynamic(() => import('@/components/GoogleMapView'), { ssr: false })

export default function MarshalDashboard({ user, onStaleUser }) {
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
          families={marshals.map(m => ({
            lat: m.currentLocation.coordinates[1],
            lng: m.currentLocation.coordinates[0],
            seniorName: m.name,
            riskCategory: `${m.role}_${m.status === 'offline' ? 'offline' : 'online'}`,
            familyCode: m.id,
            role: m.role,
            status: m.status,
          }))}
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
