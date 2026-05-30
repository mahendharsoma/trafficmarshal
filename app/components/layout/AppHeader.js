import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, LogOut } from 'lucide-react'

/**
 * Application header component with user info and logout
 */
export default function AppHeader({ user, onLogout }) {
  const roleColor = { 
    super_admin: 'bg-purple-600', 
    dcp: 'bg-indigo-600', 
    sho: 'bg-blue-600', 
    marshal: 'bg-green-600', 
    volunteer: 'bg-amber-600' 
  }
  
  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="bg-red-600 p-2 rounded-lg w-fit">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg leading-tight">MKSC Control Center</h1>
            <p className="hidden sm:block text-xs text-slate-500">Traffic Marshal Coordination</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center items-end gap-2 sm:gap-3">
          <Badge className={`${roleColor[user.role]} text-white`}>
            {user.role.replace('_', ' ').toUpperCase()}
          </Badge>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-slate-500">{user.zone}</div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
