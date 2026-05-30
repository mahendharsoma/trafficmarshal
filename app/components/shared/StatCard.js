import { Card, CardContent } from '@/components/ui/card'

/**
 * Stat card component for displaying key metrics
 * @param {string} label - Stat label
 * @param {number|string} value - Stat value
 * @param {ReactNode} icon - Icon element
 * @param {string} color - Color theme (slate, green, blue, etc.)
 */
export default function StatCard({ label, value, icon, color }) {
  const bgMap = { 
    slate: 'bg-slate-100', 
    green: 'bg-green-100', 
    blue: 'bg-blue-100', 
    gray: 'bg-gray-100', 
    amber: 'bg-amber-100', 
    red: 'bg-red-100', 
    emerald: 'bg-emerald-100', 
    purple: 'bg-purple-100' 
  }
  
  const tMap = { 
    slate: 'text-slate-700', 
    green: 'text-green-700', 
    blue: 'text-blue-700', 
    gray: 'text-gray-700', 
    amber: 'text-amber-700', 
    red: 'text-red-700', 
    emerald: 'text-emerald-700', 
    purple: 'text-purple-700' 
  }
  
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        <div className={`p-2 rounded-lg ${bgMap[color]} ${tMap[color]}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}
