import { create } from 'zustand'
import { supa } from '../lib/supabase'
import { WAM_API_URL, WAM_API_SECRET } from '../lib/config'

// Estados WAM reales del EGM
export type WAMStatusValue = 'idle' | 'active' | 'off' | 'maintenance' | null

interface WAMStore {
  // Map codigo -> status leído de Supabase (columna wam_status)
  statusMap: Record<string, WAMStatusValue>
  loaded: boolean
  lastFetch: number
  fetch: () => Promise<void>
  // Actualizar estado WAM de una terminal en Supabase
  update: (id: string, codigo: string, status: WAMStatusValue) => Promise<boolean>
  // getConexion: true=conectada, false=desconectada, null=sin datos
  getConexion: (codigo: string) => boolean | null
  getStatus: (codigo: string) => WAMStatusValue
}

export const useWAMStatus = create<WAMStore>((set, get) => ({
  statusMap: {},
  loaded: false,
  lastFetch: 0,

  fetch: async () => {
    const { lastFetch } = get()
    if (Date.now() - lastFetch < 30_000) return
    try {
      // Leer columna wam_status de todas las terminales
      const { data, error } = await supa
        .from('terminales')
        .select('codigo, wam_status')
        .not('wam_status', 'is', null)

      if (error) {
        // Si la columna no existe aún, silenciar el error
        if (error.message?.includes('wam_status')) {
          set({ loaded: true, lastFetch: Date.now() })
          return
        }
        throw error
      }

      const map: Record<string, WAMStatusValue> = {}
      ;(data || []).forEach((t: any) => {
        if (t.codigo && t.wam_status) map[t.codigo.toUpperCase()] = t.wam_status
      })
      set({ statusMap: map, loaded: true, lastFetch: Date.now() })
    } catch {
      set({ loaded: true, lastFetch: Date.now() })
    }
  },

  update: async (id, codigo, status) => {
    try {
      const { error } = await supa
        .from('terminales')
        .update({ wam_status: status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return false
      // Actualizar el map local inmediatamente
      set(s => ({ statusMap: { ...s.statusMap, [codigo.toUpperCase()]: status } }))
      return true
    } catch { return false }
  },

  getStatus: (codigo) => {
    const { statusMap, loaded } = get()
    if (!loaded) return null
    return statusMap[codigo?.toUpperCase()] ?? null
  },

  getConexion: (codigo) => {
    const st = get().getStatus(codigo)
    if (st === null) return null
    return st === 'idle' || st === 'active'
  },
}))

// ── También intentar leer del WAM API real ────────────────────────────────────
// Esta función se llama desde el componente para sincronizar si el backend
// agrega el endpoint /api/terminal-status en el futuro
export async function syncWAMFromAPI(): Promise<Record<string, WAMStatusValue>> {
  const base   = WAM_API_URL.replace(/\/$/, '')
  const secret = encodeURIComponent(WAM_API_SECRET)
  const endpoints = [
    `${base}/api/terminal-status?secret=${secret}`,
    `${base}/api/terminals?secret=${secret}`,
    `${base}/api/machines?secret=${secret}`,
  ]
  for (const url of endpoints) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const d = await r.json()
      if (d?.error) continue
      const arr = Array.isArray(d) ? d : (d.terminals || d.machines || d.data || [])
      if (!Array.isArray(arr) || !arr.length) continue
      const map: Record<string, WAMStatusValue> = {}
      arr.forEach((t: any) => {
        const code = (t.machine_id || t.alias || t.codigo || '').trim().toUpperCase()
        const raw  = (t.content_status || t.status || t.wam_status || '').toLowerCase()
        if (!code) return
        if (raw === 'idle') map[code] = 'idle'
        else if (raw === 'active' || raw === 'playing') map[code] = 'active'
        else if (raw === 'maintenance' || raw === 'maint_off') map[code] = 'maintenance'
        else map[code] = 'off'
      })
      return map
    } catch { continue }
  }
  return {}
}
