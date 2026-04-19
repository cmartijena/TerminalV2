import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useNotifs } from '../../store/notifs'
import type { Notificacion, NotifTipo } from '../../types'

const TIPO_STYLES: Record<NotifTipo, { bg: string; icon: React.ReactNode }> = {
  danger: {
    bg: 'bg-danger/10',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  warn: {
    bg: 'bg-warn/10',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d29922" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  info: {
    bg: 'bg-ac2/10',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#388bfd" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  },
  success: {
    bg: 'bg-ac/10',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
}

function NotifItem({ notif }: { notif: Notificacion }) {
  const { markRead } = useNotifs()
  const navigate = useNavigate()
  const style = TIPO_STYLES[notif.tipo]

  const handleClick = () => {
    markRead(notif.id)
    if (notif.accion) navigate(notif.accion)
  }

  return (
    <div
      onClick={handleClick}
      className={`flex gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-surface2 ${
        !notif.leida ? 'bg-surface2/60' : 'opacity-60'
      }`}
    >
      <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-medium leading-tight ${notif.leida ? 'text-tx2' : 'text-tx'}`}>
            {notif.titulo}
          </p>
          <span className="text-[10px] text-tx3 shrink-0 font-mono">{notif.tiempo}</span>
        </div>
        <p className="text-[11px] text-tx2 mt-0.5 truncate">{notif.descripcion}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          {notif.roles.map(r => (
            <span key={r} className="text-[9px] font-mono text-tx3 bg-surface border border-border rounded px-1">
              {r.substring(0, 5)}
            </span>
          ))}
        </div>
      </div>
      {!notif.leida && <div className="w-1.5 h-1.5 rounded-full bg-ac2 shrink-0 mt-2" />}
    </div>
  )
}

export default function NotifPanel() {
  const user = useAuth(s => s.user)
  const { forRole, markAllRead, clearAll } = useNotifs()
  const rol = user?.rol || 'TECNICO'
  const notifs = forRole(rol as any)
  const unread = notifs.filter(n => !n.leida).length

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl overflow-hidden z-50">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-tx">Notificaciones</span>
          {unread > 0 && (
            <span className="text-[9px] bg-danger text-white rounded-full px-1.5 py-0.5 font-mono">{unread}</span>
          )}
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-[10px] text-ac2 hover:underline">Marcar leídas</button>
          )}
          <button onClick={clearAll} className="text-[10px] text-tx3 hover:text-tx2">Limpiar</button>
        </div>
      </div>
      <div className="px-3 py-1.5 bg-surface2 border-b border-border">
        <p className="text-[10px] text-tx3 font-mono">
          Mostrando para rol: <span className="text-ac">{rol}</span>
        </p>
      </div>
      <div className="max-h-96 overflow-y-auto p-2 space-y-1">
        {notifs.length === 0 ? (
          <div className="text-center py-8 text-xs text-tx3 font-mono">Sin notificaciones</div>
        ) : (
          notifs.map(n => <NotifItem key={n.id} notif={n} />)
        )}
      </div>
    </div>
  )
}