'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/app/utils/api'

/**
 * Zones management tab for Super Admin
 */
export default function ZonesTab() {
  const [zones, setZones] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })

  const load = async () => {
    const r = await api('/admin/zones')
    setZones(r?.zones || [])
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '' })
    setOpen(true)
  }

  const openEdit = (z) => {
    setEditing(z)
    setForm({ name: z.name, description: z.description || '' })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name) return toast.error('Name required')
    const r = editing
      ? await api(`/admin/zones/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      : await api('/admin/zones', { method: 'POST', body: JSON.stringify(form) })
    if (r.error) return toast.error(r.error)
    toast.success(editing ? 'Zone updated' : 'Zone created')
    setOpen(false)
    load()
  }

  const del = async (z) => {
    if (!confirm(`Delete zone "${z.name}"? This will also remove its Traffic PS.`)) return
    await api(`/admin/zones/${z.id}`, { method: 'DELETE' })
    toast.success('Deleted')
    load()
  }

  return (
    <Card>
      <CardHeader className=" space-y-0">
        <div className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Zone Management
          </CardTitle>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add Zone
          </Button>
        </div>
        <CardDescription>Create and manage zones. DCPs are assigned to zones.</CardDescription>
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
                  <Button size="sm" variant="ghost" onClick={() => openEdit(z)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => del(z)}>
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-2 truncate">ID: {z.id}</div>
            </div>
          ))}
          {!zones.length && (
            <div className="col-span-full text-center text-sm text-slate-500 py-8">No zones yet.</div>
          )}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Zone' : 'Create Zone'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Zone Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Secunderabad"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
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
