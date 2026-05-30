'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Heart, Camera, Navigation, Stethoscope } from 'lucide-react'
import PhotoUploader from './PhotoUploader'
import { api } from '@/app/utils/api'
import { watermarkPhoto } from '@/app/utils/imageUtils'

/**
 * Assigned visits card for marshals to track senior citizen visits
 */
export default function AssignedVisitsCard({ user, marshalInfo }) {
  const [assignments, setAssignments] = useState([])
  const [visitOpen, setVisitOpen] = useState(false)
  const [activeAssignment, setActiveAssignment] = useState(null)
  const [form, setForm] = useState({ photo: null, condition: 'safe', notes: '', gps: null, address: '' })
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const r = await api(`/assignments?marshalId=${user.id}`)
    setAssignments((r?.assignments || []).filter(a => a.status !== 'completed'))
  }
  
  useEffect(() => { 
    load()
    const t = setInterval(load, 7000)
    return () => clearInterval(t)
  }, [])

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
    if (!b64) { 
      setForm(f => ({ ...f, photo: null }))
      return 
    }
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
    } catch (e) { 
      console.error(e)
      toast.error('Watermark failed') 
    }
    setBusy(false)
  }

  const submit = async () => {
    if (!form.photo) return toast.error('Selfie photo is mandatory')
    if (!form.gps) return toast.error('GPS location not captured')
    setBusy(true)
    const r = await api('/visits', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: activeAssignment.id, 
        familyId: activeAssignment.familyId,
        marshalId: user.id, 
        marshalName: marshalInfo?.name || user.name,
        familyName: activeAssignment.family?.name,
        lat: form.gps.lat, 
        lng: form.gps.lng, 
        address: form.address,
        selfiePhoto: form.photo, 
        visitStart: new Date().toISOString(),
        visitEnd: new Date().toISOString(),
        familyCondition: form.condition, 
        notes: form.notes,
      })
    })
    setBusy(false)
    if (r.error) return toast.error(r.error)
    toast.success(`Visit logged! +${r.pointsAwarded} points${r.escalationId ? ' · ESCALATION RAISED' : ''}`)
    setVisitOpen(false)
    load()
  }

  const freqColor = { 
    daily: 'bg-blue-600', 
    weekly: 'bg-green-600', 
    monthly: 'bg-amber-600', 
    emergency: 'bg-red-600' 
  }
  
  const riskColor = { 
    emergency: 'text-red-700', 
    high: 'text-orange-700', 
    medium: 'text-amber-700', 
    low: 'text-emerald-700' 
  }

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
                  <div className={`text-xs font-medium ${riskColor[a.family?.riskCategory] || ''}`}>
                    {(a.family?.riskCategory || 'low').toUpperCase()} risk
                  </div>
                </div>
                <Badge className={`${freqColor[a.visitFrequency]} text-white text-[10px]`}>
                  {a.visitFrequency.toUpperCase()}
                </Badge>
              </div>
              <div className="text-xs text-slate-600">{a.family?.address}</div>
              {a.family?.medical && (
                <div className="text-xs text-red-600 flex items-start gap-1">
                  <Stethoscope className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{a.family.medical}</span>
                </div>
              )}
              {a.instructions && (
                <div className="text-xs italic text-slate-500">"{a.instructions}"</div>
              )}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-pink-600 hover:bg-pink-700" 
                  onClick={() => startVisit(a)}
                >
                  <Camera className="h-3 w-3 mr-1" /> Start Visit
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${a.family?.lat},${a.family?.lng}`, '_blank')}
                >
                  <Navigation className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Senior Citizen Visit · {activeAssignment?.family?.name}</DialogTitle>
          </DialogHeader>
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
              {form.condition !== 'safe' && (
                <p className="text-xs text-red-600 mt-1">⚠️ Escalation will auto-trigger to SHO & DCP</p>
              )}
            </div>
            <div>
              <Label>Visit Notes</Label>
              <Textarea 
                rows={3} 
                value={form.notes} 
                onChange={e => setForm({ ...form, notes: e.target.value })} 
                placeholder="Health status, safety concerns, remarks…" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || !form.photo}>
              {busy ? 'Submitting…' : 'Submit Visit Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
