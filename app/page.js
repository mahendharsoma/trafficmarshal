'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Siren, Heart } from 'lucide-react'

// Import all extracted components
import LoginScreen from '@/app/components/auth/LoginScreen'
import AppHeader from '@/app/components/layout/AppHeader'
import SHODashboard from '@/app/components/dashboards/SHODashboard'
import MarshalDashboard from '@/app/components/dashboards/MarshalDashboard'
import VolunteerDashboard from '@/app/components/dashboards/VolunteerDashboard'
import AdminDashboard from '@/app/components/dashboards/AdminDashboard'
import DCPDashboard from '@/app/components/dashboards/DCPDashboard'
import FamilyManagement from '@/app/components/tabs/FamilyManagement'

// Main Application Component
function App() {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem('mksc_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error('Failed to parse saved user', e)
        localStorage.removeItem('mksc_user')
      }
    }
    setHydrated(true)
  }, [])

  const handleLogin = (newUser) => {
    setUser(newUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('mksc_user')
    setUser(null)
  }

  // Don't render until hydrated (prevents SSR mismatch)
  if (!hydrated) {
    return null
  }

  // Show login screen if no user
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  // Render dashboard based on user role
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} onLogout={handleLogout} />
      
      <main className="max-w-7xl mx-auto p-4">
        {/* SHO Dashboard with Tabs */}
        {user.role === 'sho' && (
          <Tabs defaultValue="traffic" className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="w-max h-auto">
                <TabsTrigger value="traffic" className="text-xs sm:text-sm">
                  <Siren className="h-3.5 w-3.5 mr-1" /> Traffic
                </TabsTrigger>
                <TabsTrigger value="seniors" className="text-xs sm:text-sm">
                  <Heart className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Senior Citizens</span>
                  <span className="sm:hidden">Seniors</span>
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="traffic">
              <SHODashboard user={user} />
            </TabsContent>
            <TabsContent value="seniors">
              <FamilyManagement user={user} />
            </TabsContent>
          </Tabs>
        )}

        {/* Super Admin Dashboard */}
        {user.role === 'super_admin' && (
          <AdminDashboard user={user} />
        )}

        {/* DCP Dashboard */}
        {user.role === 'dcp' && (
          <DCPDashboard user={user} />
        )}

        {/* Marshal Dashboard */}
        {user.role === 'marshal' && (
          <MarshalDashboard user={user} onStaleUser={handleLogout} />
        )}

        {/* Volunteer Dashboard */}
        {user.role === 'volunteer' && (
          <VolunteerDashboard user={user} onStaleUser={handleLogout} />
        )}
      </main>
    </div>
  )
}

export default App
