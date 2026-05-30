'use client'

import { useState, useEffect } from 'react'
import { Heart, Plus, UserPlus, Pencil, Trash2, Stethoscope } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/app/utils/api'

function extractLatLngFromGoogleMapsUrl(url) {
  const value = String(url || '').trim()
  if (!value) return { lat: null, lng: null }

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ]

  for (const re of patterns) {
    const m = value.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
  }

  return { lat: null, lng: null }
}

export default function FamilyManagement({ user }) {
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
    mapsUrl: '',
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
      age: f.age || '', mapsUrl: f.mapsUrl || '', tpsId: f.tpsId || f.psId || '', psId: f.psId || f.tpsId || '',
    })
    setOpen(true)
  }
  const save = async () => {
    if (!form.seniorName) return toast.error('Senior name required')
    const selectedTps = user.role === 'sho' ? assignedTps : tpsList.find(t => t.id === (form.tpsId || form.psId))
    if (!selectedTps?.id) return toast.error('Select Traffic Police Station')
    const mapsUrl = String(form.mapsUrl || '').trim()
    const extracted = extractLatLngFromGoogleMapsUrl(mapsUrl)
    if (mapsUrl && (extracted.lat == null || extracted.lng == null)) {
      return toast.error('Invalid Google Maps URL. Please paste a valid location URL.')
    }
    const payload = { ...form, age: form.age ? parseInt(form.age) : null,
      mapsUrl: mapsUrl || null,
      lat: extracted.lat, lng: extracted.lng,
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
            <div className="md:col-span-2">
              <Label>Google Maps URL</Label>
              <Input
                value={form.mapsUrl}
                onChange={e => setForm({ ...form, mapsUrl: e.target.value })}
                placeholder="https://maps.google.com/?q=17.4399,78.4738"
              />
            </div>
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
