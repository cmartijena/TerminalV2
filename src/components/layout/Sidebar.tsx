import { NavLink } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useDB } from '../../store/db'
import { useNotifs } from '../../store/notifs'

const IconDashboard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IconTerminales = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
)
const IconAgencias = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconEmpresas = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22V12M2 7l10-5 10 5M2 7v10l10 5 10-5V7"/>
  </svg>
)
const IconChart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
)
const IconKey = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
)
const IconUsers = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconHistory = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="12 8 12 12 14 14"/>
    <path d="M3.05 11a9 9 0 1 0 .5-4.5L1 4"/>
    <polyline points="1 4 1 9 6 9"/>
  </svg>
)
const IconFranq = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
)
const IconPWA = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
)

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const user = useAuth(s => s.user)
  const unread = useNotifs(s => s.unreadCount)
  const rol = user?.rol || 'TECNICO'
  const count = unread(rol as any)
  const { terminales } = useDB()
  const offlineCount = terminales.filter(t => t.estado === 'EN PRODUCCION' && !t.wam_online).length

  const navSections: Array<{label:string; items:Array<{to:string;label:string;icon:React.ReactNode;roles?:string[];soon?:boolean;badgeOffline?:boolean}>}> = [
    {
      label: 'PRINCIPAL',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard />, roles: ['ADMINISTRADOR','DIRECTIVO','FRANQUICIADO','TECNICO'] },
        { to: '/terminales', label: 'Terminales', icon: <IconTerminales />, roles: ['ADMINISTRADOR','DIRECTIVO','FRANQUICIADO','TECNICO'], badgeOffline: true },
        { to: '/agencias', label: 'Agencias', icon: <IconAgencias />, roles: ['ADMINISTRADOR','DIRECTIVO','FRANQUICIADO'] },
        { to: '/empresas', label: 'Empresas', icon: <IconEmpresas />, roles: ['ADMINISTRADOR','DIRECTIVO'] },
      ]
    },
    {
      label: 'WAM',
      items: [
        { to: '/wam', label: 'Reportería', icon: <IconChart />, roles: ['ADMINISTRADOR','DIRECTIVO'] },
        { to: '/egm', label: 'Accesos WAM', icon: <IconKey />, roles: ['ADMINISTRADOR','DIRECTIVO','FRANQUICIADO','TECNICO'] },
      ]
    },
    {
      label: 'SISTEMA',
      items: [
        { to: '/usuarios', label: 'Usuarios', icon: <IconUsers />, roles: ['ADMINISTRADOR','DIRECTIVO'] },
        { to: '/historial', label: 'Historial', icon: <IconHistory />, roles: ['ADMINISTRADOR','DIRECTIVO'] },
      ]
    },
    {
      label: 'PRÓXIMO',
      items: [
        { to: '#', label: 'Portal franquiciado', icon: <IconFranq />, roles: ['ADMINISTRADOR'], soon: true },
        { to: '#', label: 'App móvil PWA', icon: <IconPWA />, roles: ['ADMINISTRADOR'], soon: true },
      ]
    },
  ]

  return (
    <aside className={`bg-surface border-r border-border flex flex-col transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'} shrink-0`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-border shrink-0">
        <div className="w-6 h-6 rounded-md bg-ac/10 border border-ac/30 flex items-center justify-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-ac" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-tx tracking-wide">TerminalOS</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navSections.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <div className="px-4 py-2 text-[9px] text-tx3 font-mono tracking-widest">{section.label}</div>
            )}
            {section.items
              .filter(item => !item.roles || item.roles.includes(rol))
              .map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-4 py-2 text-sm transition-all border-l-2 ${
                      item.soon
                        ? 'opacity-40 cursor-not-allowed border-transparent text-tx2'
                        : isActive
                          ? 'text-ac bg-ac/5 border-ac'
                          : 'text-tx2 border-transparent hover:text-tx hover:bg-white/[0.03]'
                    }`
                  }
                  onClick={e => item.soon && e.preventDefault()}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.label === 'Reportería' && count > 0 && (
                        <span className="text-[10px] bg-danger text-white rounded-full px-1.5 py-0.5 leading-none">{count}</span>
                      )}
                      {item.soon && (
                        <span className="text-[9px] text-pur font-mono">próx.</span>
                      )}
                      {(item as any).badgeOffline && offlineCount > 0 && (
                        <span style={{ background:'#f72564', color:'#fff', fontSize:9, borderRadius:10, padding:'1px 6px', fontFamily:'monospace', fontWeight:700 }}>{offlineCount}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[9px] text-tx3 font-mono">v2.0 · ELG</p>
        </div>
      )}
    </aside>
  )
}
