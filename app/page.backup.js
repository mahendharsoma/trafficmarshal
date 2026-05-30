'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ShieldAlert, MapPin, Users, Activity, Trophy, LogOut, Siren, Navigation, CheckCircle2, AlertTriangle, Radio, BarChart3, Clock, Camera, Image as ImageIcon, Plus, Pencil, Trash2, UserPlus, FileText, Heart, Building2, ShieldCheck, Stethoscope, Calendar, Bell, ExternalLink, Eye } from 'lucide-react'

// Import extracted components
import LoginScreen from '@/app/components/auth/LoginScreen'
import AppHeader from '@/app/components/layout/AppHeader'
import SHODashboard from '@/app/components/dashboards/SHODashboard'
import MarshalDashboard from '@/app/components/dashboards/MarshalDashboard'
import VolunteerDashboard from '@/app/components/dashboards/VolunteerDashboard'
import AdminDashboard from '@/app/components/dashboards/AdminDashboard'
import DCPDashboard from '@/app/components/dashboards/DCPDashboard'
import FamilyManagement from '@/app/components/tabs/FamilyManagement'

// Main App Component
function App() {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('mksc_user')
    if (u) setUser(JSON.parse(u))
    setHydrated(true)
  }, [])

  const logout = () => { localStorage.removeItem('mksc_user'); setUser(null) }

  if (!hydrated) return null
  if (!user) return <LoginScreen onLogin={setUser} />

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} onLogout={logout} />
      <main className="max-w-7xl mx-auto p-4">
        {user.role === 'sho' && (
          <Tabs defaultValue="traffic" className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="w-max h-auto">
                <TabsTrigger value="traffic" className="text-xs sm:text-sm"><Siren className="h-3.5 w-3.5 mr-1" /> Traffic</TabsTrigger>
                <TabsTrigger value="seniors" className="text-xs sm:text-sm"><Heart className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Senior Citizens</span><span className="sm:hidden">Seniors</span></TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="traffic"><SHODashboard user={user} /></TabsContent>
            <TabsContent value="seniors"><FamilyManagement user={user} /></TabsContent>
          </Tabs>
        )}
        {user.role === 'super_admin' && <AdminDashboard user={user} />}
        {user.role === 'dcp' && <DCPDashboard user={user} />}
        {user.role === 'marshal' && <MarshalDashboard user={user} onStaleUser={logout} />}
        {user.role === 'volunteer' && <VolunteerDashboard user={user} onStaleUser={logout} />}
      </main>
    </div>
  )
}

export default App
