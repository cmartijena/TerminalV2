import { create } from 'zustand'
import { supa } from '../lib/supabase'

type EstadoT = 'DISPONIBLE' | 'ASIGNADA' | 'ACTIVO' | 'NO DISPONIBLE' | 'EN REPARACION' | 'BAJA'

// Prefijos por modelo — código base según el modelo elegido
export const MOD_PREFIJOS: Record<string, string> = {
  'WALL':       'WLLELG-E',
  'SMALL WALL': 'SWLELG-E',
  'TOTEM':      'TOTELG-E',
  'BOX SIMPLE': 'BOXELG-E',
  'BOXDUAL':    'BXDELG-E',
}

export interface TerminalOp {
  id?: string
  codigo: string
  modelo: string
  serie?: string
  estado?: EstadoT
  agencia_id?: string | null
  observacion?: string
}

export interface Traslado {
  terminal_id: string
  terminal_codigo: string
  agencia_destino_id: string
  agencia_destino_nombre: string
  observacion: string
  solicitado_por: string
  rol: string
}

interface TerminalStore {
  saving: boolean
  crear: (t: TerminalOp) => Promise<{ ok: boolean; error?: string }>
  crearBatch: (codigos: string[], modelo: string) => Promise<{ ok: boolean; creados: number; error?: string }>
  actualizar: (id: string, campos: Partial<TerminalOp>) => Promise<{ ok: boolean; error?: string }>
  asignar: (id: string, agencia_id: string | null) => Promise<{ ok: boolean; error?: string }>
  cambiarEstado: (id: string, estado: EstadoT, observacion?: string) => Promise<{ ok: boolean; error?: string }>
  darBaja: (id: string, motivo: string) => Promise<{ ok: boolean; error?: string }>
  solicitarTraslado: (t: Traslado) => Promise<{ ok: boolean; error?: string }>
  stockPorModelo: (terminales: any[]) => Record<string, number>
  // Obtener siguiente correlativo para un prefijo
  siguienteCodigo: (prefijo: string, terminales: any[]) => string
  // Verificar si un código ya existe
  codigoExiste: (codigo: string, terminales: any[]) => boolean
}

export const useTerminalOps = create<TerminalStore>((_set, _get) => ({
  saving: false,

  crear: async (t) => {
    try {
      // Verificar duplicado antes de insertar
      const { data: exist } = await supa
        .from('terminales')
        .select('id')
        .ilike('codigo', t.codigo.trim())
        .limit(1)
      if (exist && exist.length > 0)
        return { ok: false, error: `El código ${t.codigo} ya existe en el registro` }

      const { error } = await supa.from('terminales').insert([{
        codigo:      t.codigo.toUpperCase().trim(),
        modelo:      t.modelo,
        serie:       t.serie || null,
        estado:      t.estado || 'DISPONIBLE',
        agencia_id:  t.agencia_id || null,
        observacion: t.observacion || null,
      }])
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  crearBatch: async (codigos, modelo) => {
    try {
      // Verificar duplicados en bloque
      const { data: exist } = await supa
        .from('terminales')
        .select('codigo')
        .in('codigo', codigos.map(c => c.toUpperCase()))
      if (exist && exist.length > 0) {
        const dups = exist.map((e:any) => e.codigo).join(', ')
        return { ok: false, creados: 0, error: `Códigos ya existen: ${dups}` }
      }
      const rows = codigos.map(cod => ({
        codigo: cod.toUpperCase().trim(), modelo, estado: 'DISPONIBLE', agencia_id: null,
      }))
      const { error, data } = await supa.from('terminales').insert(rows).select()
      if (error) return { ok: false, creados: 0, error: error.message }
      return { ok: true, creados: data?.length || 0 }
    } catch(e: any) { return { ok: false, creados: 0, error: e.message } }
  },

  actualizar: async (id, campos) => {
    try {
      const { error } = await supa.from('terminales')
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  asignar: async (id, agencia_id) => {
    try {
      const { error } = await supa.from('terminales')
        .update({ agencia_id, estado: agencia_id ? 'ACTIVO' : 'DISPONIBLE', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  cambiarEstado: async (id, estado, observacion) => {
    try {
      const campos: any = { estado, updated_at: new Date().toISOString() }
      if (observacion) campos.observacion = observacion
      if (['DISPONIBLE','NO DISPONIBLE','BAJA'].includes(estado)) campos.agencia_id = null
      const { error } = await supa.from('terminales').update(campos).eq('id', id)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  darBaja: async (id, motivo) => {
    try {
      const { error } = await supa.from('terminales')
        .update({ estado: 'BAJA', agencia_id: null, observacion: `BAJA: ${motivo}`, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  solicitarTraslado: async (t) => {
    try {
      // Guardar solicitud de traslado en tabla solicitudes o en observacion
      // Si no existe tabla traslados, lo guardamos en observacion del terminal + estado
      const obs = `TRASLADO SOLICITADO → ${t.agencia_destino_nombre} | Por: ${t.solicitado_por} | ${t.observacion}`
      const { error } = await supa.from('terminales')
        .update({ observacion: obs, updated_at: new Date().toISOString() })
        .eq('id', t.terminal_id)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  stockPorModelo: (terminales) => {
    const stock: Record<string, number> = {}
    terminales.filter(t => (t.estado as string) === 'DISPONIBLE')
      .forEach(t => { stock[t.modelo] = (stock[t.modelo] || 0) + 1 })
    return stock
  },

  siguienteCodigo: (prefijo, terminales) => {
    // Buscar el mayor número existente con ese prefijo
    const nums = terminales
      .filter(t => t.codigo?.toUpperCase().startsWith(prefijo.toUpperCase()))
      .map(t => {
        const m = t.codigo.match(/-E0*(\d+)$/)
        return m ? parseInt(m[1]) : 0
      })
    const max = nums.length > 0 ? Math.max(...nums) : 0
    const siguiente = max + 1
    return `${prefijo}${String(siguiente).padStart(4, '0')}`
  },

  codigoExiste: (codigo, terminales) => {
    const norm = (s: string) => s?.toUpperCase().trim()
    return terminales.some(t => norm(t.codigo) === norm(codigo))
  },
}))
