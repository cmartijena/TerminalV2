/**
 * WAM Status Store — TerminalOS v2
 * 
 * Llama a /api/terminales/online en el WAM backend (Railway).
 * Ese endpoint consulta terminal_view_data en el EGM y retorna:
 *   { online: N, total: N, terminales: [{alias, pos, status, online}] }
 * 
 * status puede ser: "idle" | "active" | "off" | "maintenance" | ""
 * online = status not in ("off", "offline", "")
 * 
 * Conectada = online === true  (idle o active)
 * Desconectada = online === false (off, maintenance, o ausente)
 */
import { create } from 'zustand'
import { WAM_API_URL, WAM_API_SECRET } from '../lib/config'

export type WAMStatusValue = 'idle' | 'active' | 'off' | 'maintenance' | null

// Normaliza código: "BOXELG-E00011" y "WLLELG-E0011" → "BOXELG-E11" / "WLLELG-E11"
// Permite comparar alias WAM (formato variable) con códigos de Supabase (4 dígitos)
function normCodigo(s: string): string {
  if (!s) return ''
  const m = s.trim().toUpperCase().match(/^([A-Z0-9]+)-E0*(\d+)$/)
  return m ? `${m[1]}-E${m[2]}` : s.trim().toUpperCase()
}

interface WAMTerminal {
  alias:  string   // e.g. "BOXELG-E00012"
  pos:    string
  status: string   // "idle" | "active" | "off" | "maintenance" | ""
  online: boolean  // true si idle o active
}

interface WAMStore {
  // Map CODIGO_UPPER -> { status, online }
  statusMap:  Record<string, { status: string; online: boolean }>
  loaded:     boolean
  loading:    boolean
  lastFetch:  number
  error:      string | null

  fetch:       () => Promise<void>
  getStatus:   (codigo: string) => WAMStatusValue
  // true=conectada(idle|active), false=desconectada(off), null=sin datos WAM
  getConexion: (codigo: string) => boolean | null
}

export const useWAMStatus = create<WAMStore>((set, get) => ({
  statusMap: {},
  loaded:    false,
  loading:   false,
  lastFetch: 0,
  error:     null,

  fetch: async () => {
    const { loading, lastFetch } = get()
    // Evitar refetch si fue hace menos de 30s o ya está cargando
    if (loading || Date.now() - lastFetch < 30_000) return

    set({ loading: true, error: null })
    try {
      const base   = WAM_API_URL.replace(/\/$/, '')
      const secret = encodeURIComponent(WAM_API_SECRET)
      const url    = `${base}/api/terminales/online?secret=${secret}`

      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)

      const data = await r.json()
      if (data?.error) throw new Error(data.error)

      // La respuesta es { online: N, total: N, terminales: [...] }
      const arr: WAMTerminal[] = Array.isArray(data)
        ? data
        : (data.terminales || data.terminals || [])

      if (!Array.isArray(arr)) throw new Error('Respuesta inesperada del WAM API')

      const map: Record<string, { status: string; online: boolean }> = {}
      arr.forEach(t => {
        const raw = (t.alias || '').trim()
        if (!raw) return
        const key = normCodigo(raw)  // normalizar para comparar con Supabase
        map[key] = {
          status: (t.status || '').toLowerCase(),
          online: t.online === true,
        }
      })

      console.log(`[WAM] ${Object.keys(map).length} terminales cargadas. Online: ${arr.filter(t=>t.online).length}`)
      set({ statusMap: map, loaded: true, loading: false, lastFetch: Date.now(), error: null })
    } catch (e: any) {
      console.warn('[WAM] Error cargando estado terminales:', e.message)
      set({ loading: false, loaded: true, error: e.message, lastFetch: Date.now() })
    }
  },

  getStatus: (codigo) => {
    const { statusMap, loaded } = get()
    if (!loaded) return null
    const key = normCodigo(codigo || '')
    const t   = statusMap[key]
    if (!t) return null  // No encontrada en WAM = sin datos (no asumir off)

    const s = t.status
    if (s === 'idle')                           return 'idle'
    if (s === 'active' || s === 'playing')      return 'active'
    if (s === 'maintenance' || s === 'maint_off') return 'maintenance'
    if (s === 'off' || s === 'offline' || s === '') return 'off'
    return null
  },

  getConexion: (codigo) => {
    const { statusMap, loaded } = get()
    if (!loaded) return null
    const key = normCodigo(codigo || '')
    const t   = statusMap[key]
    if (!t) return null          // Sin datos en WAM
    return t.online              // true=conectada, false=desconectada
  },
}))
