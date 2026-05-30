'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText } from 'lucide-react'
import { api } from '@/app/utils/api'
import { exportCSV } from '@/app/utils/exportUtils'

/**
 * Audit logs tab - displays system activity trail
 */
export default function AuditLogsTab() {
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
  
  useEffect(() => { 
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [filterRole, filterAction])
  
  const download = () => {
    exportCSV('audit_logs.csv',
      ['Time', 'Actor', 'Role', 'Action', 'Target Type', 'Target ID', 'Details'],
      logs.map(l => [
        new Date(l.createdAt).toLocaleString(), 
        l.actorName, 
        l.actorRole, 
        l.action, 
        l.targetType, 
        l.targetId, 
        JSON.stringify(l.details)
      ])
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Audit Logs
            </CardTitle>
            <CardDescription>Complete activity trail across the system</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterRole || 'all'} onValueChange={v => setFilterRole(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="dcp">DCP</SelectItem>
                <SelectItem value="sho">SHO</SelectItem>
                <SelectItem value="marshal">Marshal</SelectItem>
                <SelectItem value="volunteer">Volunteer</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="w-full sm:w-auto" onClick={download}>
              <FileText className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="text-left">
                <th className="p-2">Time</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Role</th>
                <th className="p-2">Action</th>
                <th className="p-2">Target</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b">
                  <td className="p-2 text-xs font-mono">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="p-2">{l.actorName || '-'}</td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px]">{l.actorRole}</Badge>
                  </td>
                  <td className="p-2">
                    <Badge className="bg-slate-700 text-[10px]">{l.action}</Badge>
                  </td>
                  <td className="p-2 text-xs">{l.targetType}</td>
                  <td className="p-2 text-xs font-mono text-slate-500 max-w-xs truncate">
                    {l.details ? JSON.stringify(l.details) : '-'}
                  </td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan="6" className="text-center py-6 text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
