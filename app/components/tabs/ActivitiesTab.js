'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { api } from '@/app/utils/api'

/**
 * Activities tab component - displays marshal activity reports
 */
export default function ActivitiesTab() {
  const [activities, setActivities] = useState([])
  
  useEffect(() => {
    const load = async () => { 
      const r = await api('/activities')
      setActivities(r.activities || []) 
    }
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marshal Activity Reports</CardTitle>
        <CardDescription>Photos, locations, severity submitted from the field</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-auto">
          {activities.map(a => (
            <div key={a.id} className="border rounded-lg overflow-hidden bg-white">
              {a.photoUrl && <img src={a.photoUrl} alt="" className="w-full h-40 object-cover" />}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{a.marshalName}</div>
                  <Badge className={
                    a.severity === 'critical' ? 'bg-red-600' : 
                    a.severity === 'high' ? 'bg-orange-600' : 
                    a.severity === 'medium' ? 'bg-amber-500' : 
                    'bg-slate-500'
                  }>
                    {a.severity}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">{a.address}</div>
                <div className="text-sm">{a.description}</div>
                <div className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {!activities.length && (
            <div className="col-span-full text-sm text-slate-500 text-center py-6">
              No activity reports yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
