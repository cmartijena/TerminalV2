import { create } from 'zustand'
import type { Notificacion, Rol } from '../types'

interface NotifState {
  notifs: Notificacion[]
  panelOpen: boolean
  addNotif: (n: Omit<Notificacion, 'id' | 'tiempo' | 'leida'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
  togglePanel: () => void
  forRole: (rol: Rol) => Notificacion[]
  unreadCount: (rol: Rol) => number
}

const ROLES_NOTIF: Record<string, Rol[]> = {
  terminal_offline:   ['ADMINISTRADOR', 'TECNICO'],
  terminal_online:    ['ADMINISTRADOR', 'TECNICO'],
  balance_bajo:       ['ADMINISTRADOR', 'DIRECTIVO'],
  solicitud_traslado: ['ADMINISTRADOR'],
  acceso_wam:         ['ADMINISTRADOR'],
  agencia_baja:       ['ADMINISTRADOR', 'DIRECTIVO'],
  nuevo_usuario:      ['ADMINISTRADOR'],
  alerta_general:     ['ADMINISTRADOR', 'DIRECTIVO', 'FRANQUICIADO', 'TECNICO'],
}

export const NOTIF_ROLES = ROLES_NOTIF

export const useNotifs = create<NotifState>((set, get) => ({
  notifs: [
    {
      id: 'demo-1',
      tipo: 'danger',
      titulo: 'Terminal T-0847 offline',
      descripcion: 'Agencia Chorrillos · sin señal',
      roles: ['ADMINISTRADOR', 'TECNICO'],
      tiempo: 'hace 3 min',
      leida: false,
      accion: '/terminales',
    },
    {
      id: 'demo-2',
      tipo: 'warn',
      titulo: 'Balance WAM bajo',
      descripcion: 'VSSlots · S/ 1,200 disponible',
      roles: ['ADMINISTRADOR', 'DIRECTIVO'],
      tiempo: 'hace 15 min',
      leida: false,
      accion: '/wam',
    },
    {
      id: 'demo-3',
      tipo: 'info',
      titulo: 'Nueva solicitud de traslado',
      descripcion: 'T-0312 → Agencia Miraflores',
      roles: ['ADMINISTRADOR'],
      tiempo: 'hace 1 hora',
      leida: false,
      accion: '/solicitudes',
    },
    {
      id: 'demo-4',
      tipo: 'success',
      titulo: 'Acceso WAM creado',
      descripcion: 'Eli Tapia · Drsoftgames@gmail.com',
      roles: ['ADMINISTRADOR'],
      tiempo: 'hace 2 horas',
      leida: true,
      accion: '/egm',
    },
  ],
  panelOpen: false,

  addNotif: (n) => {
    const notif: Notificacion = {
      ...n,
      id: `notif-${Date.now()}`,
      tiempo: 'ahora',
      leida: false,
    }
    set((s) => ({ notifs: [notif, ...s.notifs].slice(0, 50) }))
  },

  markRead: (id) =>
    set((s) => ({
      notifs: s.notifs.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    })),

  markAllRead: () =>
    set((s) => ({ notifs: s.notifs.map((n) => ({ ...n, leida: true })) })),

  clearAll: () => set({ notifs: [] }),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  forRole: (rol) => get().notifs.filter((n) => n.roles.includes(rol)),

  unreadCount: (rol) =>
    get().notifs.filter((n) => n.roles.includes(rol) && !n.leida).length,
}))