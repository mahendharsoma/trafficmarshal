'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText } from 'lucide-react'
import PhotoUploader from './PhotoUploader'

/**
 * Activity report card for marshals to submit field reports
 */
export default function ActivityReportCard({ onSubmit }) {
  const [open, setOpen] = useState(false)
  const [severity, setSeverity] = useState('medium')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!photo && !description) { 
      toast.error('Add a description or photo')
      return 
    }
    setBusy(true)
    await onSubmit({ severity, description, photo })
    setBusy(false)
    setOpen(false)
    setSeverity('medium')
    setDescription('')
    setPhoto(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:bg-slate-50 transition">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" /> Submit Activity Report
            </CardTitle>
            <CardDescription>Photo + location + severity (+25 pts)</CardDescription>
          </CardHeader>
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Activity / Incident Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Describe the situation..." 
              rows={3} 
            />
          </div>
          <div>
            <Label>Photo</Label>
            <PhotoUploader value={photo} onChange={setPhoto} label="Capture / upload photo" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
