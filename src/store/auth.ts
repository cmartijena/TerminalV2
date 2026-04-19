import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Usuario, Rol } from '../types'
import { supa } from '../lib/supabase'

interface AuthState {
  user: Usuario | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  canSee: (roles: Rol[]) => boolean
  isAdmin: () => boolean
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,

      login: async (username, password) => {
        set({ loading: true })
        try {
          const { data, error } = await supa
            .from('usuarios_sistema')
            .select('*')
            .eq('usuario', username)
            .eq('activo', true)
            .single()

          if (error || !data) {
            set({ loading: false })
            return { ok: false, error: 'Usuario no encontrado' }
          }

          if (data.password !== password) {
            set({ loading: false })
            return { ok: false, error: 'Contraseña incorrecta' }
          }

          const user: Usuario = {
            id: data.id,
            _id: data.id,
            user: data.usuario,
            pass: data.password,
            rol: data.rol,
            nombre: data.nombre,
            correo: data.email || '',
            empresas: data.empresas || [],
            activo: data.activo,
          }

          set({ user, loading: false })
          return { ok: true }
        } catch (e) {
          set({ loading: false })
          return { ok: false, error: 'Error de conexión' }
        }
      },

      logout: () => set({ user: null }),

      canSee: (roles) => {
        const u = get().user
        if (!u) return false
        return roles.includes(u.rol)
      },

      isAdmin: () => get().user?.rol === 'ADMINISTRADOR',
    }),
    { name: 'terminalos-auth' }
  )
)