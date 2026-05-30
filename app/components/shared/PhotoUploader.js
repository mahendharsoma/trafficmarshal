'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Camera } from 'lucide-react'
import { compressImage } from '@/app/utils/imageUtils'

/**
 * Photo uploader component with image/video compression
 * @param {string} value - Current photo value (base64)
 * @param {Function} onChange - Callback when photo changes
 * @param {string} label - Label for the upload button
 */
export default function PhotoUploader({ value, onChange, label = 'Add Photo' }) {
  const [busy, setBusy] = useState(false)
  
  const handle = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const b64 = f.type.startsWith('video/')
        ? await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(f)
          })
        : await compressImage(f)
      onChange(b64)
    } catch (err) { 
      toast.error('Upload failed') 
    }
    setBusy(false)
  }
  
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative">
          {String(value).startsWith('data:video/')
            ? <video src={value} controls className="w-full h-32 object-cover rounded border" />
            : <img src={value} alt="upload" className="w-full h-32 object-cover rounded border" />}
          <Button 
            type="button" 
            size="sm" 
            variant="destructive" 
            className="absolute top-1 right-1 h-6 px-2 text-xs" 
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
          <Camera className="h-4 w-4" />
          {busy ? 'Compressing...' : label}
          <input 
            type="file" 
            accept="image/*,video/*" 
            capture="environment" 
            className="hidden" 
            onChange={handle} 
            disabled={busy} 
          />
        </label>
      )}
    </div>
  )
}
