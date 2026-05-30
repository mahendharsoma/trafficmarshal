'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, MapPin, Building2, Clock, Trophy, Siren, ImageIcon, Users, Heart, Bell, FileText, Activity, Radio, LogOut, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/app/utils/api'
import { exportCSV } from '@/app/utils/exportUtils'
import { GMAPS_KEY } from '@/app/constants/traffic'
import ActivitiesTab from '@/app/components/tabs/ActivitiesTab'
import UserManagementTab from '@/app/components/tabs/UserManagementTab'
import ZonesTab from '@/app/components/tabs/ZonesTab'
import TrafficPSTab from '@/app/components/tabs/TrafficPSTab'
import FamilyManagement from '@/app/components/tabs/FamilyManagement'
import EscalationsTab from '@/app/components/tabs/EscalationsTab'
import AuditLogsTab from '@/app/components/tabs/AuditLogsTab'
import dynamic from 'next/dynamic'

const GoogleMapView = dynamic(() => import('@/components/GoogleMapView'), { ssr: false })

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [marshals, setMarshals] = useState([])
  const [zones, setZones] = useState([])
  const [incidents, setIncidents] = useState([])

  const loadAll = async () => {
    try {
      const [s, a, l, m, z, i] = await Promise.all([
        api('/admin/stats'), api('/admin/attendance'), api('/admin/leaderboard'),
        api('/marshals'), api('/zones'), api('/incidents'),
      ])
      setStats(s?.stats || null)
      setAttendance(a?.attendance || [])
      setLeaderboard(l?.leaderboard || [])
      setMarshals(m?.marshals || [])
      setZones(z?.zones || [])
      setIncidents(i?.incidents || [])
    } catch (e) { console.error('Admin load error', e) }
  }
  useEffect(() => { loadAll(); const t = setInterval(loadAll, 5000); return () => clearInterval(t) }, [])

  const coverageGaps = useMemo(() => {
    const byZone = {}
    attendance.forEach(a => {
      if (!byZone[a.zone]) byZone[a.zone] = { total: 0, online: 0, active: 0 }
      byZone[a.zone].total++
      if (a.status === 'online') byZone[a.zone].online++
      if (a.status === 'active') byZone[a.zone].active++
    })
    return Object.entries(byZone).map(([zone, v]) => ({ zone, ...v, coverage: ((v.online + v.active) / Math.max(v.total, 1) * 100).toFixed(0) }))
  }, [attendance])

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_60%)]" />
        <div className="relative px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-indigo-200 font-semibold">Super Admin Command Center</div>
            <div className="text-lg sm:text-2xl font-extrabold mt-1">Citywide Traffic Operations</div>
            <div className="text-xs text-indigo-200 mt-1">Unified view of zones, incidents, force attendance and performance</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs w-full sm:w-auto">
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-indigo-200">Active Units</div>
              <div className="font-bold text-base">{(stats?.active || 0) + (stats?.volunteers?.active || 0)}</div>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-center">
              <div className="text-[10px] text-indigo-200">Open Alerts</div>
              <div className="font-bold text-base">{stats?.open || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <TabsList className="w-max h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 mr-1" /><span>Overview</span></TabsTrigger>
          <TabsTrigger value="zones" className="text-xs sm:text-sm"><MapPin className="h-3.5 w-3.5 mr-1" /><span>Zones</span></TabsTrigger>
          <TabsTrigger value="tps" className="text-xs sm:text-sm"><Building2 className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Traffic </span>PS</TabsTrigger>
          <TabsTrigger value="map" className="text-xs sm:text-sm"><MapPin className="h-3.5 w-3.5 mr-1" /><span>Map</span></TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs sm:text-sm"><Clock className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Attendance</span><span className="sm:hidden">Attend.</span></TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs sm:text-sm"><Trophy className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Leaderboard</span><span className="sm:hidden">Board</span></TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs sm:text-sm"><Siren className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Incidents</span><span className="sm:hidden">Inc.</span></TabsTrigger>
          <TabsTrigger value="activities" className="text-xs sm:text-sm"><ImageIcon className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Activities</span><span className="sm:hidden">Acts.</span></TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm"><Users className="h-3.5 w-3.5 mr-1" /><span>Users</span></TabsTrigger>
          <TabsTrigger value="seniors" className="text-xs sm:text-sm"><Heart className="h-3.5 w-3.5 mr-1" /><span>Seniors</span></TabsTrigger>
          <TabsTrigger value="escalations" className="text-xs sm:text-sm"><Bell className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Escalations</span><span className="sm:hidden">Esc.</span></TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm"><FileText className="h-3.5 w-3.5 mr-1" /><span>Audit</span></TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-4">
        {/* Marshal Statistics */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" /> Traffic Marshals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Marshals', value: stats?.total || 0, icon: <Users className="h-4 w-4" />, tone: 'border-slate-300 bg-slate-50 text-slate-700' },
                { label: 'Active Now', value: stats?.active || 0, icon: <Activity className="h-4 w-4" />, tone: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                { label: 'Online Ready', value: stats?.online || 0, icon: <Radio className="h-4 w-4" />, tone: 'border-blue-300 bg-blue-50 text-blue-700' },
                { label: 'Offline', value: stats?.offline || 0, icon: <LogOut className="h-4 w-4" />, tone: 'border-slate-300 bg-white text-slate-600' },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border-2 p-3 shadow-sm ${item.tone}`}>
                  <div className="flex items-center justify-between">
                    {item.icon}
                    <span className="text-[10px] uppercase tracking-wide opacity-80">{item.label}</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-2 leading-none">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Volunteer Statistics */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-600" /> Volunteers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Volunteers', value: stats?.volunteers?.total || 0, icon: <Heart className="h-4 w-4" />, tone: 'border-pink-300 bg-pink-50 text-pink-700' },
                { label: 'Active Now', value: stats?.volunteers?.active || 0, icon: <Activity className="h-4 w-4" />, tone: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                { label: 'Online Ready', value: stats?.volunteers?.online || 0, icon: <Radio className="h-4 w-4" />, tone: 'border-blue-300 bg-blue-50 text-blue-700' },
                { label: 'Offline', value: stats?.volunteers?.offline || 0, icon: <LogOut className="h-4 w-4" />, tone: 'border-slate-300 bg-white text-slate-600' },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border-2 p-3 shadow-sm ${item.tone}`}>
                  <div className="flex items-center justify-between">
                    {item.icon}
                    <span className="text-[10px] uppercase tracking-wide opacity-80">{item.label}</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-2 leading-none">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Incidents & System Statistics */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Siren className="h-4 w-4 text-amber-600" /> Incidents & System Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Incidents', value: stats?.incidents || 0, icon: <Siren className="h-4 w-4" />, tone: 'border-amber-300 bg-amber-50 text-amber-700' },
                { label: 'Open Alerts', value: stats?.open || 0, icon: <AlertTriangle className="h-4 w-4" />, tone: 'border-red-300 bg-red-50 text-red-700' },
                { label: 'Cleared', value: stats?.cleared || 0, icon: <CheckCircle2 className="h-4 w-4" />, tone: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                { label: 'Zones', value: zones?.length || 0, icon: <MapPin className="h-4 w-4" />, tone: 'border-indigo-300 bg-indigo-50 text-indigo-700' },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border-2 p-3 shadow-sm ${item.tone}`}>
                  <div className="flex items-center justify-between">
                    {item.icon}
                    <span className="text-[10px] uppercase tracking-wide opacity-80">{item.label}</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-2 leading-none">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-600" /> Zone Coverage</CardTitle>
            <CardDescription>Live coverage by zone</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {coverageGaps.map(z => (
              <div key={z.zone} className="rounded-xl border p-3 bg-white">
                <div className="font-semibold text-slate-700">{z.zone}</div>
                <div className="text-3xl font-extrabold" style={{ color: z.coverage >= 60 ? '#16a34a' : z.coverage >= 30 ? '#f59e0b' : '#dc2626' }}>{z.coverage}%</div>
                <div className="text-xs text-slate-500">{z.online + z.active} / {z.total} on duty</div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, Number(z.coverage))}%`, backgroundColor: Number(z.coverage) >= 60 ? '#16a34a' : Number(z.coverage) >= 30 ? '#f59e0b' : '#dc2626' }} />
                </div>
              </div>
            ))}
            {coverageGaps.length === 0 && (
              <div className="col-span-full text-sm text-slate-500 text-center py-6">No attendance data available yet.</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="map">
        <div className="rounded-xl overflow-hidden border shadow-sm h-[52vw] min-h-[320px] max-h-[620px] lg:h-[calc(100vh-240px)] lg:min-h-[520px] lg:max-h-none">
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
          />
        </div>
      </TabsContent>

      <TabsContent value="attendance">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">7-Day Attendance Log</CardTitle>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => exportCSV('attendance.csv',
              ['Name','Role','Zone','Status','Toggles (7d)','Last Seen'],
              attendance.map(a => [a.name, a.role, a.zone, a.status, a.toggleCount, a.lastSeen ? new Date(a.lastSeen).toLocaleString() : '']))
            }><FileText className="h-3 w-3 mr-1" /> Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[65vh] rounded-lg border">
              <table className="w-full text-sm min-w-[540px]">
                <thead className="text-left bg-slate-100 sticky top-0">
                  <tr><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Zone</th><th className="p-2">Status</th><th className="p-2">Toggles (7d)</th><th className="p-2">Last Seen</th></tr>
                </thead>
                <tbody>
                  {attendance.map(a => (
                    <tr key={a.id} className="border-b">
                      <td className="p-2 font-medium">{a.name}</td>
                      <td className="p-2">{a.role}</td>
                      <td className="p-2">{a.zone}</td>
                      <td className="p-2"><Badge className={a.status === 'active' ? 'bg-green-600' : a.status === 'online' ? 'bg-blue-600' : 'bg-slate-500'}>{a.status}</Badge></td>
                      <td className="p-2">{a.toggleCount}</td>
                      <td className="p-2 text-xs">{a.lastSeen ? new Date(a.lastSeen).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leaderboard">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Performance Rewards</CardTitle>
              <CardDescription>Points based on response time & incidents cleared</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => exportCSV('leaderboard.csv',
              ['Rank','Name','Zone','Role','Points'],
              leaderboard.map((m, idx) => [idx + 1, m.name, m.zone, m.role, m.points]))
            }><FileText className="h-3 w-3 mr-1" /> Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leaderboard.length === 0 && <div className="text-sm text-slate-500 p-6 text-center rounded-lg border bg-white">No leaderboard data yet.</div>}
              {leaderboard.map((m, idx) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border rounded-xl p-3 bg-white">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300 text-slate-700'}`}>{idx + 1}</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-xs text-slate-500 truncate">{m.zone} · {m.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-600 font-bold shrink-0"><Trophy className="h-4 w-4" /> {m.points}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="incidents">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">Incident Report</CardTitle>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => exportCSV('incidents.csv',
              ['Time','Address','Severity','Level','Status','Delay (min)','Queue (m)'],
              incidents.map(i => [new Date(i.createdAt).toLocaleString(), i.address, i.severity, i.level, i.status, i.estimatedDelayMin || '', i.queueLengthM || '']))
            }><FileText className="h-3 w-3 mr-1" /> Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {incidents.length === 0 && <div className="text-sm text-slate-500 p-6 text-center rounded-lg border bg-white">No incidents found.</div>}
              {incidents.map(i => (
                <div key={i.id} className="border rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 text-sm bg-white">
                  {i.photoUrl && <img src={i.photoUrl} alt="" className="w-full sm:w-20 h-36 sm:h-20 object-cover rounded flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{i.address}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(i.createdAt).toLocaleString()} · Severity: {i.severity} · Level {i.level}</div>
                  </div>
                  <Badge className={`${i.status === 'cleared' ? 'bg-green-600' : i.status === 'dispatched' ? 'bg-blue-600' : 'bg-red-600'} w-fit`}>{i.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activities">
        <ActivitiesTab />
      </TabsContent>

      <TabsContent value="users">
        <UserManagementTab />
      </TabsContent>

      <TabsContent value="zones">
        <ZonesTab />
      </TabsContent>

      <TabsContent value="tps">
        <TrafficPSTab />
      </TabsContent>

      <TabsContent value="seniors">
        <FamilyManagement user={user} />
      </TabsContent>

      <TabsContent value="escalations">
        <EscalationsTab user={user} />
      </TabsContent>

      <TabsContent value="audit">
        <AuditLogsTab />
      </TabsContent>
    </Tabs>
  )
}
