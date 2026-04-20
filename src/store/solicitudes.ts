import { create } from 'zustand'
import { supa } from '../lib/supabase'
import type { Solicitud } from '../types'

interface SolicitudState {
  solicitudes: Solicitud[]
  loading: boolean
  loadAll: () => Promise<void>
  crear: (s: Omit<Solicitud, 'id'|'_id'|'estado'|'created_at'|'updated_at'>) => Promise<{ ok: boolean; error?: string }>
  aprobar: (id: string, por: string) => Promise<{ ok: boolean; error?: string }>
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
        set({
          solicitudes: data.map((r: any): Solicitud => ({
            id: r.id, _id: r.id,
            tipo:   (r.tipo === 'NUEVO_LOCAL' || r.tipo === 'NUEVA_TERMINAL' ? r.tipo : 'NUEVO_LOCAL') as any,
            estado: r.estado || 'PENDIENTE',
            empresa:    r.empresa    || '',
            empresa_id: r.empresa_id || '',
            franquiciado_nombre:   r.franquiciado_nombre   || '',
            franquiciado_correo:   r.franquiciado_correo   || '',
            franquiciado_telefono: r.franquiciado_telefono || '',
            franquiciado_cargo:    r.franquiciado_cargo    || '',
            agencia_nombre:  r.agencia_nombre  || '',
            direccion:       r.direccion       || '',
            maps_link:       r.maps_link       || '',
            lat:             r.lat,
            lng:             r.lng,
            cant_terminales: r.cant_terminales || 1,
            tipo_maquina:    r.tipo_maquina    || 'BOX_SIMPLE',
            notas:           r.notas           || '',
            solicitante_id:     r.solicitante_id     || '',
            solicitante_nombre: r.solicitante_nombre || '',
            motivo_rechazo:     r.motivo_rechazo     || '',
            aprobado_por:       r.aprobado_por       || '',
            created_at:  r.created_at,
            updated_at:  r.updated_at,
          }))
        })
      }
    } catch(e) { console.error('solicitudes:', e) }
    set({ loading: false })
  },

  crear: async (s) => {
    try {
      const { error } = await supa.from('solicitudes').insert([{
        tipo:    s.tipo,
        encargado: s.franquiciado_nombre, // backward compat
        empresa: s.empresa,
        empresa_id: s.empresa_id,
        franquiciado_nombre:   s.franquiciado_nombre,
        franquiciado_correo:   s.franquiciado_correo,
        franquiciado_telefono: s.franquiciado_telefono,
        franquiciado_cargo:    s.franquiciado_cargo,
        agencia_nombre:  s.agencia_nombre,
        direccion:       s.direccion,
        maps_link:       s.maps_link,
        lat:             s.lat,
        lng:             s.lng,
        cant_terminales: s.cant_terminales,
        tipo_maquina:    s.tipo_maquina,
        notas:           s.notas,
        estado: 'PENDIENTE',
        solicitante_id:     s.solicitante_id,
        solicitante_nombre: s.solicitante_nombre,
      }])
      if (error) return { ok: false, error: error.message }
      await get().loadAll()
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  aprobar: async (id, por) => {
    try {
      const { error } = await supa.from('solicitudes')
        .update({ estado: 'APROBADO', aprobado_por: por, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      await get().loadAll()
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  rechazar: async (id, motivo) => {
    try {
      const { error } = await supa.from('solicitudes')
        .update({ estado: 'RECHAZADO', motivo_rechazo: motivo, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { ok: false, error: error.message }
      await get().loadAll()
      return { ok: true }
    } catch(e: any) { return { ok: false, error: e.message } }
  },

  pendientes: () => get().solicitudes.filter(s => s.estado === 'PENDIENTE').length,
}))
