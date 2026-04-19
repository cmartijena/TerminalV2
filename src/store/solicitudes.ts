import { create } from 'zustand'
import { supa } from '../lib/supabase'
import type { Solicitud } from '../types'

interface SolicitudState {
  solicitudes: Solicitud[]
  loading: boolean
  loadAll: () => Promise<void>
  crear: (s: Omit<Solicitud, 'id'|'_id'|'estado'|'created_at'|'updated_at'>) => Promise<{ ok: boolean; error?: string }>
  aprobar: (id: string) => Promise<{ ok: boolean; error?: string }>
  rechazar: (id: string, motivo: string) => Promise<{ ok: boolean; error?: string }>
  pendientes: () => number
}

export const useSolicitudes = create<SolicitudState>((set, get) => ({
  solicitudes: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supa
        .from('solicitudes')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) {
        set({ solicitudes: data.map((r: any) => ({
          id: r.id, _id: r.id,
          tipo: r.tipo, empresa: r.empresa || '',
          empresa_id: r.empresa_id,
          encargado: r.encargado || '',
          correo: r.correo || '',
          direccion: r.direccion || '',
          lat: r.lat, lng: r.lng,
          cant_terminales: r.cant_terminales || 0,
          notas: r.notas || '',
          estado: r.estado || 'PENDIENTE',
          solicitante_id: r.solicitante_id,
          solicitante_nombre: r.solicitante_nombre || '',
          motivo_rechazo: r.motivo_rechazo || '',
          created_at: r.created_at,
          updated_at: r.updated_at,
        })) })
      }
    } catch(e) {
      console.error('Error loading solicitudes:', e)
    }
    set({ loading: false })
  },

  crear: async (s) => {
    try {
      const { error } = await supa.from('solicitudes').insert([{
        tipo: s.tipo,
        empresa: s.empresa,
        empresa_id: s.empresa_id,
        encargado: s.encargado,
        correo: s.correo,
        direccion: s.direccion,
        lat: s.lat,
        lng: s.lng,
        cant_terminales: s.cant_terminales,
        notas: s.notas,
        estado: 'PENDIENTE',
        solicitante_id: s.solicitante_id,
        solicitante_nombre: s.solicitante_nombre,
      }])
if (error) return { ok: false, error: error.message }
      await get().loadAll()
      return { ok: true }
    } catch(e: any) {
      return { ok: false, error: e.message }
    }
  },

  aprobar: async (id) => {
    try {
      const { error } = await supa.from('solicitudes')
        .update({ estado: 'APROBADO', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      await get().loadAll()
      return { ok: true }
    } catch(e: any) {
      return { ok: false, error: e.message }
    }
  },

  rechazar: async (id, motivo) => {
    try {
      const { error } = await supa.from('solicitudes')
        .update({ estado: 'RECHAZADO', motivo_rechazo: motivo, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      await get().loadAll()
      return { ok: true }
    } catch(e: any) {
      return { ok: false, error: e.message }
    }
  },

  pendientes: () => get().solicitudes.filter(s => s.estado === 'PENDIENTE').length,
}))
