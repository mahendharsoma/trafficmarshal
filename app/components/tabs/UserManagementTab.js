'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/app/utils/api'

export default function UserManagementTab() {
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
