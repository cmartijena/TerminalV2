import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useNotifs } from '../../store/notifs'
import NotifPanel from '../notificaciones/NotifPanel'

const ROL_COLORS: Record<string, string> = {
  ADMINISTRADOR: 'text-ac border-ac/30 bg-ac/10',
  DIRECTIVO:     'text-ac2 border-ac2/30 bg-ac2/10',
  FRANQUICIADO:  'text-pur border-pur/30 bg-pur/10',
  TECNICO:       'text-warn border-warn/30 bg-warn/10',
}

export default function Topbar({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void
}) {
  const user = useAuth(s => s.user)
  const logout = useAuth(s => s.logout)
  const { panelOpen, togglePanel, unreadCount } = useNotifs()
  const navigate = useNavigate()
  const rol = user?.rol || 'TECNICO'
  const count = unreadCount(rol as any)
  const initials = user?.nombre?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-[52px] bg-surface border-b border-border flex items-center px-4 gap-3 shrink-0 relative z-20">
      {/* Toggle sidebar */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-md text-tx3 hover:text-tx hover:bg-surface2 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Company */}
      <span className="text-xs text-tx3 font-mono hidden sm:block">Electric Line Peru S.A.C.</span>

      <div className="flex-1" />

      {/* Realtime indicator + GMT */}
      <div className="hidden sm:flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-ac animate-pulse" />
        <span className="text-[10px] text-tx3 font-mono">en vivo</span>
        <span className="text-[10px] text-tx3 font-mono opacity-50">· GMT-5</span>
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={togglePanel}
          className={`relative p-1.5 rounded-md transition-colors ${
            panelOpen ? 'bg-surface2 text-tx' : 'text-tx3 hover:text-tx hover:bg-surface2'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white text-[9px] rounded-full flex items-center justify-center leading-none font-mono">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
        {panelOpen && <NotifPanel />}
      </div>

      {/* User chip */}
      <div className="flex items-center gap-2 pl-3 border-l border-border">
        <div className="w-7 h-7 rounded-lg bg-ac2/20 border border-ac2/30 flex items-center justify-center text-[11px] font-semibold text-ac2 shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-medium text-tx leading-tight">{user?.nombre?.split(' ')[0]}</p>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${ROL_COLORS[rol]}`}>
            {rol}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="p-1 text-tx3 hover:text-danger transition-colors ml-1"
          title="Cerrar sesión"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
