'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldAlert, MapPin, Siren, Activity, Trophy } from 'lucide-react'
import { Feature, DemoBtn } from '@/app/components/shared/LoginHelpers'
import { api } from '@/app/utils/api'

/**
 * Login screen component
 */
export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await api('/auth/login', { 
        method: 'POST', 
        body: JSON.stringify({ username, password }) 
      })
      if (!r) return toast.error('No response from server. Check database/API configuration.')
      if (r.error) return toast.error(r.error)
      if (!r.user) return toast.error('Login response missing user details')
      localStorage.setItem('mksc_user', JSON.stringify(r.user))
      onLogin(r.user)
      toast.success(`Welcome ${r.user.name}`)
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const seed = async () => {
    const r = await api('/seed', { method: 'POST' })
    toast.success(r.seeded ? `Seeded ${r.users} users & ${r.marshals} marshals` : r.msg)
  }

  const quickFill = (u, p) => { 
    setUsername(u)
    setPassword(p) 
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-6 items-center">
        <div className="text-white space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-3 rounded-xl">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">MKSC Control Center</h1>
              <p className="text-blue-200">Malkajgiri Police Commissionerate</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold">Traffic Marshal Coordination System</h2>
          <p className="text-blue-100">
            Real-time deployment, proximity dispatch, and live attendance for Begumpet, Alwal, Thirumalgiri & Uppal zones.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Feature icon={<MapPin className="h-5 w-5" />} text="Live Heatmap & Markers" />
            <Feature icon={<Siren className="h-5 w-5" />} text="Tiered Proximity Dispatch" />
            <Feature icon={<Activity className="h-5 w-5" />} text="Attendance Logs" />
            <Feature icon={<Trophy className="h-5 w-5" />} text="Performance Rewards" />
          </div>
        </div>
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Login with your MKSC credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="e.g. mksc / sho1 / marshal1" 
                  required 
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <div className="mt-5 text-xs space-y-2">
              <p className="font-semibold text-slate-700">Demo accounts (click to fill):</p>
              <div className="grid grid-cols-2 gap-1.5">
                <DemoBtn onClick={() => quickFill('mksc', 'mksc123')} label="Super Admin (mksc)" />
                <DemoBtn onClick={() => quickFill('dcp1', 'dcp123')} label="DCP Malkajgiri" />
                <DemoBtn onClick={() => quickFill('sho1', 'sho123')} label="SHO Begumpet" />
                <DemoBtn onClick={() => quickFill('marshal1', 'marshal123')} label="Marshal #1" />
                <DemoBtn onClick={() => quickFill('volunteer1', 'volunteer123')} label="Volunteer #1" />
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={seed}>
                Seed Demo Data (run once)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
