import { create } from 'zustand'
import { WAM_API_URL, WAM_API_SECRET } from '../lib/config'

export interface WAMTerminal {
  machine_id: string
  status: 'idle' | 'active' | 'off' | 'maintenance' | string
  content_status?: string
  terminal_status?: string
  game?: string
  balance?: number
  free_balance?: number
  pos?: string
}

interface WAMStore {
  terminals: WAMTerminal[]
  loaded: boolean
  loading: boolean
  lastFetch: number
  fetch: () => Promise<void>
  // Retorna el estado WAM real o null si no hay datos
  getStatus: (codigo: string) => 'active' | 'idle' | 'off' | 'maintenance' | null
  // true = conectada (idle|active), false = desconectada (off|maintenance), null = sin datos WAM
  getConexion: (codigo: string) => boolean | null
}

export const useWAMStatus = create<WAMStore>((set, get) => ({
  terminals: [],
  loaded: false,
  loading: false,
  lastFetch: 0,

  fetch: async () => {
    const { loading, lastFetch } = get()
    if (loading || (Date.now() - lastFetch < 30_000)) return
    set({ loading: true })
    try {
      const base   = WAM_API_URL.replace(/\/$/, '')
      const secret = encodeURIComponent(WAM_API_SECRET)
      let terminals: WAMTerminal[] = []

      // Endpoints a probar en orden
      const endpoints = [
        `${base}/api/terminals?secret=${secret}`,
        `${base}/api/machines?secret=${secret}`,
        `${base}/api/egm/terminals?secret=${secret}`,
        `${base}/api/terminal/list?secret=${secret}`,
        `${base}/api/status?secret=${secret}`,
      ]

      for (const url of endpoints) {
        try {
          const r = await fetch(url)
          if (!r.ok) continue
          const d = await r.json()
          if (d?.error) continue

          const normalize = (t: any): WAMTerminal => ({
            machine_id:      (t.machine_id || t.alias || t.Alias || t.id || t.code || '').trim().toUpperCase(),
            status:          (t.content_status || t.status || t.terminal_status || t.state || 'off').toLowerCase(),
            content_status:  t.content_status || '',
            terminal_status: t.terminal_status || t.TerminalStatus || '',
            game:            t.game || t.Game || t.game_name || '',
            balance:         t.balance ?? t.Balance ?? 0,
            free_balance:    t.free_balance ?? t.FreeBalance ?? 0,
            pos:             t.pos || t.POS || '',
          })

          // Array directo
          if (Array.isArray(d) && d.length > 0) {
            terminals = d.map(normalize); break
          }
          // Objeto con subarray
          const raw = d.terminals || d.machines || d.data || d.results || d.items
          if (Array.isArray(raw) && raw.length > 0) {
            terminals = raw.map(normalize); break
          }
        } catch { continue }
      }

      set({ terminals, loaded: true, loading: false, lastFetch: Date.now() })
    } catch {
      set({ loading: false, loaded: true })
    }
  },

  getStatus: (codigo) => {
    const { terminals, loaded } = get()
    // Si no se cargó aún, no hay datos
    if (!loaded) return null
    // Si el API cargó pero no devolvió terminales, sin datos
    if (!terminals.length) return null

    const norm = (s: string) => s.replace(/[-_\s]/g, '').toUpperCase()
    const t = terminals.find(t => norm(t.machine_id) === norm(codigo))
    // Terminal no encontrada en WAM = apagada/desconocida
    if (!t) return 'off'

    const s = t.status.toLowerCase()
    if (s === 'idle' || s === 'idle_event') return 'idle'
    if (s === 'active' || s === 'playing' || s === 'in_game' || s === 'in_use') return 'active'
    if (s === 'maintenance' || s === 'maint' || s === 'maint_off') return 'maintenance'
    return 'off'
  },

  getConexion: (codigo) => {
    const st = get().getStatus(codigo)
    if (st === null) return null          // sin datos WAM
    return st === 'idle' || st === 'active'  // true=conectada, false=desconectada
  },
}))
