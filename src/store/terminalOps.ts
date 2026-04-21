import { create } from 'zustand'
import { supa } from '../lib/supabase'

type EstadoT = 'DISPONIBLE' | 'ASIGNADA' | 'ACTIVO' | 'NO DISPONIBLE' | 'EN REPARACION' | 'BAJA'

export interface TerminalOp {
  id?: string
  codigo: string
  modelo: 'BOXDUAL' | 'BOX SIMPLE' | 'WALL'
  serie?: string
  estado?: EstadoT
  agencia_id?: string | null
  observacion?: string
}

interface TerminalStore {
  saving: boolean
  crear: (t: TerminalOp) => Promise<{ ok: boolean; error?: string }>
  crearBatch: (codigos: string[], modelo: string, serie_base?: string) => Promise<{ ok: boolean; creados: number; error?: string }>
  actualizar: (id: string, campos: Partial<TerminalOp>) => Promise<{ ok: boolean; error?: string }>
  asignar: (id: string, agencia_id: string | null) => Promise<{ ok: boolean; error?: string }>
  cambiarEstado: (id: string, estado: EstadoT, observacion?: string) => Promise<{ ok: boolean; error?: string }>
  darBaja: (id: string, motivo: string) => Promise<{ ok: boolean; error?: string }>
  stockPorModelo: (terminales: any[]) => Record<string, number>
}

export const useTerminalOps = create<TerminalStore>((_set, _get) => ({
  saving: false,

  crear: async (t) => {
    try {
      const { error } = await supa.from('terminales').insert([{
        codigo:     t.codigo.toUpperCase().trim(),
        modelo:     t.modelo,
        serie:      t.serie || null,
        estado:     t.estado || 'DISPONIBLE',
        agencia_id: t.agencia_id || null,
        observacion: t.observacion || null,
      }])
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  crearBatch: async (codigos, modelo, serie_base) => {
    try {
      const rows = codigos.map((cod, i) => ({
        codigo:     cod.toUpperCase().trim(),
        modelo,
        serie:      serie_base ? `${serie_base}-${String(i+1).padStart(3,'0')}` : null,
        estado:     'DISPONIBLE',
        agencia_id: null,
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
        .update({
          agencia_id,
          estado: agencia_id ? 'ASIGNADA' : 'DISPONIBLE',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  cambiarEstado: async (id, estado, observacion) => {
    try {
      const campos: any = { estado, updated_at: new Date().toISOString() }
      if (observacion) campos.observacion = observacion
      if (estado === 'DISPONIBLE' || estado === 'NO DISPONIBLE' || estado === 'BAJA') campos.agencia_id = null
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

  // Stock disponible (NO DISPONIBLE) por modelo
  stockPorModelo: (terminales) => {
    const stock: Record<string, number> = { BOXDUAL: 0, 'BOX SIMPLE': 0, WALL: 0 }
    terminales
      .filter(t => (t.estado as string) === 'DISPONIBLE')
      .forEach(t => { if (t.modelo in stock) stock[t.modelo]++ })
    return stock
  },
}))
