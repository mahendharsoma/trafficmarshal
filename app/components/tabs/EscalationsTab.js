'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/app/utils/api'

export default function EscalationsTab({ user, scopeDcpId }) {
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
