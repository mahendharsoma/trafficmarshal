'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/app/utils/api'
import { GMAPS_KEY } from '@/app/constants/traffic'
import dynamic from 'next/dynamic'

const GoogleMapPolygonEditor = dynamic(() => import('@/components/GoogleMapPolygonEditor'), { ssr: false })

export default function TrafficPSTab() {
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
      <CardHeader className="space-y-0">
        <div className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Traffic Police Stations</CardTitle>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Traffic PS</Button>
        </div>
        <CardDescription>Draw polygon coverage area on Google Maps. SHOs/Marshals are mapped to TPS.</CardDescription>
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
