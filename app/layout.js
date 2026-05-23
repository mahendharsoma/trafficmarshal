import './globals.css'
import 'leaflet/dist/leaflet.css'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'MKSC Traffic Marshal Coordination',
  description: 'Malkajgiri Police Commissionerate – Traffic Marshal Control Center',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="bg-slate-50 text-slate-900">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
