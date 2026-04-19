import { create } from 'zustand'
import { supa } from '../lib/supabase'
import type { DB, Empresa, Agencia, Terminal, UsuarioEGM, AccesoWAM } from '../types'

interface DBState extends DB {
  loaded: boolean
  loading: boolean
  loadAll: () => Promise<void>
  empColor: (nombre: string) => string
  visibleEmpresas: (userRol: string, userEmpresas: string[]) => string[]
}

const COLORES = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff','#f72564','#ed93b1','#97c459']

function genSub(emp: string, dept: string, ag: string) {
  return [emp, dept, ag].map(s => s.toUpperCase().replace(/\s+/g,'_').substring(0,4)).join('-')
}

export const useDB = create<DBState>((set, get) => ({
  empresas: [],
  agencias: [],
  terminales: [],
  usuarios: [],
  usuariosSistema: [],
  accesosWAM: [],
  loaded: false,
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    try {
      // Empresas — columna razon_social
      const { data: emps } = await supa.from('empresas').select('*').eq('activo', true)
      const empresas: Empresa[] = (emps || []).map((e: any) => ({
        _id: e.id,
        id:  e.id,
        nombre: e.razon_social || e.nombre_comercial || e.nombre || '',
        ruc:    e.ruc,
        activo: e.activo,
      }))

      // Agencias
      const { data: ags } = await supa.from('agencias').select('*')
      const agencias: Agencia[] = (ags || []).map((a: any) => {
        const empObj   = empresas.find(e => String(e._id) === String(a.empresa_id))
        const empNombre = empObj?.nombre || ''
        return {
          _id: a.id, id: a.id,
          empresa:    empNombre,
          sucursal:   a.departamento || '',
          subagencia: a.nombre       || '',
          id_sub:     genSub(empNombre, a.departamento || '', a.nombre || ''),
          estado:     a.estado       || 'PENDIENTE',
          encargado:  a.encargado,
          correo:     a.correo,
          rol:        a.rol,
          pos:        a.pos,
          direccion:  a.direccion,
          lat:        a.lat,
          lng:        a.lng,
          usuario:    a.usuario,
          realPassword: a.password,
          fecha_inicio: a.fecha_inicio,
          fotos: a.foto_url ? [a.foto_url] : [],
        }
      })

      // Terminales
      const { data: terms } = await supa.from('terminales').select('*')
      const terminales: Terminal[] = (terms || []).map((t: any) => {
        const ag = agencias.find(a => String(a._id) === String(t.agencia_id))
        return {
          _id: t.id, id: t.id,
          codigo:     t.codigo   || '',
          modelo:     t.modelo   || '',
          serie:      t.serie    || '',
          estado:     t.estado   || 'DISPONIBLE',
          empresa:    ag?.empresa    || '',
          sucursal:   ag?.sucursal   || '',
          agencia:    ag?.subagencia || '',
          id_sub:     ag?.id_sub     || '',
          agencia_id: t.agencia_id,
          observacion: t.observacion || '',
        }
      })

      // Usuarios EGM
      const usuarios: UsuarioEGM[] = agencias
        .filter(a => a.usuario)
        .map(a => ({
          _agencia_id: a._id,
          empresa:    a.empresa,
          sucursal:   a.sucursal,
          subagencia: a.subagencia,
          id_sub:     a.id_sub,
          user:       a.usuario!,
          realPassword: a.realPassword,
          rol:        a.rol,
          activo:     a.estado !== 'DADA DE BAJA' ? 'SI' : 'NO',
        }))

      // Usuarios sistema
      const { data: usrsSis } = await supa.from('usuarios_sistema').select('*').eq('activo', true)

      // Accesos WAM
      const { data: wamAcc } = await supa.from('accesos_wam').select('*').order('created_at', { ascending: false })
      const accesosWAM: AccesoWAM[] = (wamAcc || []).map((r: any) => ({
        _id:     r.id,
        cliente: r.cliente  || '',
        correo:  r.correo   || '',
        empresa: r.empresa  || '',
        user:    r.usuario  || '',
        pwd:     r.password || '',
        url:     r.url_wam  || '',
        notas:   r.notas    || '',
        estado:  r.estado   || 'ACTIVO',
        created_at: r.created_at,
      }))

      set({
        empresas,
        agencias,
        terminales,
        usuarios,
        usuariosSistema: usrsSis || [],
        accesosWAM,
        loaded: true,
        loading: false,
      })
    } catch (e) {
      console.error('Error cargando BD:', e)
      set({ loading: false })
    }
  },

  empColor: (nombre) => {
    const idx = get().empresas.findIndex(e => e.nombre === nombre)
    return COLORES[idx >= 0 ? idx % COLORES.length : 0]
  },

  visibleEmpresas: (userRol, userEmpresas) => {
    const { empresas } = get()
    if (userRol === 'FRANQUICIADO') return userEmpresas
    return empresas.map(e => e.nombre)
  },
}))