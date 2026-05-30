'use client'

import { useState, useEffect } from 'react'
import { Siren, AlertTriangle, Navigation } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/app/utils/api'
import { GMAPS_KEY } from '@/app/constants/traffic'
import dynamic from 'next/dynamic'

const GoogleMapView = dynamic(() => import('@/components/GoogleMapView'), { ssr: false })

export default function VolunteerDashboard({ user, onStaleUser }) {
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
