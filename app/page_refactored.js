'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Siren, Heart } from 'lucide-react'

// ==================== EXTRACTED COMPONENTS ====================
// Auth
import LoginScreen from '@/app/components/auth/LoginScreen'
// Layout
import AppHeader from '@/app/components/layout/AppHeader'
// Tabs
import ActivitiesTab from '@/app/components/tabs/ActivitiesTab'

// ==================== TO BE EXTRACTED ====================
// These dashboard components should be moved to app/components/dashboards/
// For now, they remain in the original page.js
// Import them once extracted:
// import SHODashboard from '@/app/components/dashboards/SHODashboard'
// import MarshalDashboard from '@/app/components/dashboards/MarshalDashboard'
// import VolunteerDashboard from '@/app/components/dashboards/VolunteerDashboard'
// import DCPDashboard from '@/app/components/dashboards/DCPDashboard'
// import AdminDashboard from '@/app/components/dashboards/AdminDashboard'

// These tab components should be moved to app/components/tabs/
// import UserManagementTab from '@/app/components/tabs/UserManagementTab'
// import AuditLogsTab from '@/app/components/tabs/AuditLogsTab'
// import ZonesTab from '@/app/components/tabs/ZonesTab'
// import TrafficPSTab from '@/app/components/tabs/TrafficPSTab'
// import FamilyManagement from '@/app/components/tabs/FamilyManagement'
// import EscalationsTab from '@/app/components/tabs/EscalationsTab'

/**
 * TEMPORARY: Import remaining components from original page.js
 * These should be extracted to their own files as shown above
 */
import {
  SHODashboard,
  MarshalDashboard,
  VolunteerDashboard,
  DCPDashboard,
  AdminDashboard,
  FamilyManagement,
} from './page_legacy_components'

/**
 * Main Application Component
 * Handles authentication and routes users to their role-specific dashboard
 */
export default function App() {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('mksc_user')
    if (u) setUser(JSON.parse(u))
    setHydrated(true)
  }, [])

  const logout = () => { 
    localStorage.removeItem('mksc_user')
    setUser(null) 
  }

  // Wait for client-side hydration
  if (!hydrated) return null
  
  // Show login screen if not authenticated
  if (!user) return <LoginScreen onLogin={setUser} />

  // Main application layout
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} onLogout={logout} />
      <main className="max-w-7xl mx-auto p-4">
        {/* SHO Dashboard with Traffic and Seniors tabs */}
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
        {user.role === 'super_admin' && <AdminDashboard user={user} />}
        
        {/* DCP Dashboard */}
        {user.role === 'dcp' && <DCPDashboard user={user} />}
        
        {/* Marshal Dashboard */}
        {user.role === 'marshal' && <MarshalDashboard user={user} onStaleUser={logout} />}
        
        {/* Volunteer Dashboard */}
        {user.role === 'volunteer' && <VolunteerDashboard user={user} onStaleUser={logout} />}
      </main>
    </div>
  )
}

/**
 * REFACTORING STATUS:
 * 
 * ✅ Extracted & Working:
 *  - Constants (app/constants/traffic.js)
 *  - Utilities (app/utils/*)
 *  - Shared Components (app/components/shared/*)
 *  - LoginScreen (app/components/auth/LoginScreen.js)
 *  - AppHeader (app/components/layout/AppHeader.js)
 *  - ActivitiesTab (app/components/tabs/ActivitiesTab.js)
 * 
 * 🔄 To Be Extracted:
 *  - SHODashboard → app/components/dashboards/SHODashboard.js
 *  - MarshalDashboard → app/components/dashboards/MarshalDashboard.js
 *  - VolunteerDashboard → app/components/dashboards/VolunteerDashboard.js
 *  - DCPDashboard → app/components/dashboards/DCPDashboard.js
 *  - AdminDashboard → app/components/dashboards/AdminDashboard.js
 *  - UserManagementTab → app/components/tabs/UserManagementTab.js
 *  - AuditLogsTab → app/components/tabs/AuditLogsTab.js
 *  - ZonesTab → app/components/tabs/ZonesTab.js
 *  - TrafficPSTab → app/components/tabs/TrafficPSTab.js
 *  - FamilyManagement → app/components/tabs/FamilyManagement.js
 *  - EscalationsTab → app/components/tabs/EscalationsTab.js
 * 
 * See REFACTORING_GUIDE.md for detailed instructions
 */
