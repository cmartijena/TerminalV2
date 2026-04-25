import { create } from 'zustand'
import { WAM_API_URL, WAM_API_SECRET } from '../lib/config'

// Estado WAM de cada terminal según el EGM
export interface WAMTerminal {
  machine_id: string   // equivale al codigo en TerminalOS (BOXELG-E0011 etc)
  status: 'idle' | 'active' | 'offline' | string
  game?: string
  balance?: number
  free_balance?: number
  pos?: string
  operator?: string
}

interface WAMStore {
  terminals: WAMTerminal[]
  loaded: boolean
  loading: boolean
  lastFetch: number
  fetch: () => Promise<void>
  getStatus: (codigo: string) => 'idle' | 'active' | 'offline'
  isConnected: (codigo: string) => boolean
}

export const useWAMStatus = create<WAMStore>((set, get) => ({
  terminals: [],
  loaded: false,
  loading: false,
  lastFetch: 0,

  fetch: async () => {
    const { loading, lastFetch } = get()
    // No refetch si fue hace menos de 30s
    if (loading || (Date.now() - lastFetch < 30_000)) return

    set({ loading: true })
    try {
      const base   = WAM_API_URL.replace(/\/$/, '')
      const secret = encodeURIComponent(WAM_API_SECRET)
      
      // Intentar /api/terminals primero, luego /api/machines, luego /api/hoy con terminals
      let terminals: WAMTerminal[] = []
      
      const endpoints = [
        `${base}/api/terminals?secret=${secret}`,
        `${base}/api/machines?secret=${secret}`,
        `${base}/api/egm/terminals?secret=${secret}`,
        `${base}/api/status/terminals?secret=${secret}`,
      ]

      for (const url of endpoints) {
        try {
          const r = await fetch(url)
          if (!r.ok) continue
          const d = await r.json()
          
          if (Array.isArray(d) && d.length > 0) {
            terminals = d.map((t: any) => ({
              machine_id:   t.machine_id || t.alias || t.id || t.code || '',
              status:       t.status || t.terminal_status || t.state || 'offline',
              game:         t.game || t.game_name || '',
              balance:      t.balance ?? t.Balance ?? 0,
              free_balance: t.free_balance ?? t.FreeBalance ?? 0,
              pos:          t.pos || t.POS || '',
              operator:     t.operator || '',
            }))
            break
          }
          
          // Si viene como objeto con key 'terminals' o 'machines'
          const raw = d.terminals || d.machines || d.data || d.results
          if (Array.isArray(raw) && raw.length > 0) {
            terminals = raw.map((t: any) => ({
              machine_id:   t.machine_id || t.alias || t.id || t.code || '',
              status:       t.status || t.terminal_status || t.state || 'offline',
              game:         t.game || '',
              balance:      t.balance ?? 0,
              free_balance: t.free_balance ?? 0,
              pos:          t.pos || '',
              operator:     t.operator || '',
            }))
            break
          }
        } catch { continue }
      }

      set({ terminals, loaded: true, loading: false, lastFetch: Date.now() })
    } catch {
      set({ loading: false, loaded: true })
    }
  },

  getStatus: (codigo) => {
    const { terminals } = get()
    if (!terminals.length) return 'offline'
    const t = terminals.find(t =>
      t.machine_id?.toUpperCase() === codigo?.toUpperCase() ||
      t.machine_id?.replace(/-/g,'')?.toUpperCase() === codigo?.replace(/-/g,'')?.toUpperCase()
    )
    if (!t) return 'offline'
    const s = (t.status || '').toLowerCase()
    if (s === 'active' || s === 'playing' || s === 'in_use') return 'active'
    if (s === 'idle') return 'idle'
    return 'offline'
  },

  isConnected: (codigo) => {
    const s = get().getStatus(codigo)
    return s === 'idle' || s === 'active'
  },
}))
