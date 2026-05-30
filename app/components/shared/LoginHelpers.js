/**
 * Feature component for displaying feature items
 */
export const Feature = ({ icon, text }) => (
  <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur">
    {icon}
    <span className="text-sm">{text}</span>
  </div>
)

/**
 * Demo button component for quick-fill login credentials
 */
export const DemoBtn = ({ onClick, label }) => (
  <button 
    type="button" 
    onClick={onClick} 
    className="text-left px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 truncate"
  >
    {label}
  </button>
)
