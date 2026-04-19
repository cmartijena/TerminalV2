import React, { useEffect, useState } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useSolicitudes } from '../store/solicitudes'
import type { TipoSolicitud } from '../types'

const TIPOS: { value: TipoSolicitud; label: string; desc: string }[] = [
  { value: 'NUEVO_LOCAL',     label: 'Nuevo local',     desc: 'Solicitar apertura de nueva sede' },
  { value: 'NUEVA_TERMINAL',  label: 'Nueva terminal',  desc: 'Agregar terminales a un local existente' },
  { value: 'NUEVA_EMPRESA',   label: 'Nueva empresa',   desc: 'Registrar nuevo operador/franquiciado' },
]

const ESTADO_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PENDIENTE: { bg: 'rgba(247,147,26,0.1)',  color: '#f7931a', border: 'rgba(247,147,26,0.3)' },
  APROBADO:  { bg: 'rgba(0,229,160,0.1)',   color: '#00e5a0', border: 'rgba(0,229,160,0.3)'  },
  RECHAZADO: { bg: 'rgba(247,37,100,0.1)',  color: '#f72564', border: 'rgba(247,37,100,0.3)' },
}

const S = {
  page: { padding: '20px 24px', background: '#0a0e1a', minHeight: '100vh' } as React.CSSProperties,
  card: { background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 12, padding: '16px 18px' } as React.CSSProperties,
  input: { width: '100%', background: '#141d35', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e8eeff', outline: 'none', fontFamily: 'system-ui' } as React.CSSProperties,
  label: { fontSize: 9, color: '#7b8db0', fontFamily: 'monospace', letterSpacing: 1, display: 'block', marginBottom: 5 } as React.CSSProperties,
  btn: (color: string) => ({ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${color}40`, background: `${color}15`, color, transition: 'all .15s' }) as React.CSSProperties,
}

export default function Solicitudes() {
  const user    = useAuth(s => s.user)
  const { empresas, loaded, loadAll } = useDB()
  const { solicitudes, loading, crear, aprobar, rechazar, loadAll: loadSol } = useSolicitudes()

  const rol = user?.rol || 'TECNICO'
  const isAdmin = ['ADMINISTRADOR', 'DIRECTIVO'].includes(rol)

  // Form state
  const [tipo, setTipo]         = useState<TipoSolicitud>('NUEVO_LOCAL')
  const [empresa, setEmpresa]   = useState('')
  const [encargado, setEnc]     = useState('')
  const [correo, setCorreo]     = useState('')
  const [direccion, setDir]     = useState('')
  const [cantTerm, setCant]     = useState(1)
  const [notas, setNotas]       = useState('')
  const [sending, setSending]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [formError, setFormErr] = useState('')

  // Admin state
  const [filtroE, setFiltroE]     = useState<'PENDIENTE'|'APROBADO'|'RECHAZADO'|'TODOS'>('PENDIENTE')
  const [modalSol, setModalSol]   = useState<string|null>(null)
  const [motivoRec, setMotivoRec] = useState('')
  const [actionLoad, setActLoad]  = useState(false)

  useEffect(() => {
    if (!loaded) loadAll()
    loadSol()
  }, [])

  const handleEnviar = async () => {
    if (!empresa.trim() || !encargado.trim() || !correo.trim() || !direccion.trim()) {
      setFormErr('Completa todos los campos obligatorios')
      return
    }
    setSending(true); setFormErr('')
    const empObj = empresas.find(e => e.nombre === empresa)
    const res = await crear({
      tipo, empresa, empresa_id: empObj?._id,
      encargado, correo, direccion,
      cant_terminales: cantTerm, notas,
      solicitante_id: String(user?.id || ''),
      solicitante_nombre: user?.nombre || '',
    })
    setSending(false)
    if (res.ok) { setSuccess(true); setEmpresa(''); setEnc(''); setCorreo(''); setDir(''); setCant(1); setNotas('') }
    else setFormErr(res.error || 'Error al enviar')
  }

  const handleAprobar = async (id: string) => {
    setActLoad(true)
    await aprobar(id)
    setActLoad(false); setModalSol(null)
  }

  const handleRechazar = async (id: string) => {
    if (!motivoRec.trim()) return
    setActLoad(true)
    await rechazar(id, motivoRec)
    setActLoad(false); setModalSol(null); setMotivoRec('')
  }

  const solFiltradas = filtroE === 'TODOS' ? solicitudes : solicitudes.filter(s => s.estado === filtroE)
  const pendCount    = solicitudes.filter(s => s.estado === 'PENDIENTE').length
  const solDetail    = solicitudes.find(s => s.id === modalSol || s._id === modalSol)

  const fmtFecha = (d?: string) => {
    if (!d) return ''
    const dt = new Date(d)
    return dt.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#e8eeff' }}>Solicitudes</h1>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#7b8db0', fontFamily: 'monospace' }}>
            {isAdmin ? 'Revisión y aprobación de solicitudes' : 'Envía solicitudes de nuevos locales, terminales o empresas'}
            {isAdmin && pendCount > 0 && (
              <span style={{ marginLeft: 8, background: 'rgba(247,147,26,0.15)', color: '#f7931a', border: '1px solid rgba(247,147,26,0.3)', padding: '1px 8px', borderRadius: 8, fontSize: 9, fontFamily: 'monospace' }}>
                {pendCount} pendiente{pendCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1.4fr' : '480px 1fr', gap: 16 }}>

        {/* ── FORMULARIO ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={S.card}>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#e8eeff' }}>
              {isAdmin ? 'Nueva solicitud manual' : 'Enviar solicitud'}
            </p>

            {/* Tipo */}
            <div style={{ marginBottom: 14 }}>
              <span style={S.label}>TIPO DE SOLICITUD</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {TIPOS.map(t => (
                  <div key={t.value} onClick={() => setTipo(t.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                      background: tipo === t.value ? 'rgba(124,92,252,0.1)' : '#141d35',
                      border: `1px solid ${tipo === t.value ? 'rgba(124,92,252,0.4)' : '#1e2d4a'}`, cursor: 'pointer' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${tipo === t.value ? '#7c5cfc' : '#3d4f73'}`,
                      background: tipo === t.value ? '#7c5cfc' : 'transparent', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: tipo === t.value ? '#e8eeff' : '#7b8db0' }}>{t.label}</div>
                      <div style={{ fontSize: 9, color: '#3d4f73', fontFamily: 'monospace' }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Empresa */}
            <div style={{ marginBottom: 10 }}>
              <span style={S.label}>EMPRESA *</span>
              <select value={empresa} onChange={e => setEmpresa(e.target.value)}
                style={{ ...S.input, appearance: 'none' }}>
                <option value="">Seleccionar empresa...</option>
                {empresas.map(e => <option key={e._id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </div>

            {/* Encargado */}
            <div style={{ marginBottom: 10 }}>
              <span style={S.label}>NOMBRE DEL ENCARGADO *</span>
              <input value={encargado} onChange={e => setEnc(e.target.value)}
                placeholder="Ej. Juan Pérez Quispe" style={S.input}/>
            </div>

            {/* Correo */}
            <div style={{ marginBottom: 10 }}>
              <span style={S.label}>CORREO DEL LOCAL *</span>
              <input value={correo} onChange={e => setCorreo(e.target.value)}
                placeholder="correo@ejemplo.com" type="email" style={S.input}/>
            </div>

            {/* Dirección */}
            <div style={{ marginBottom: 10 }}>
              <span style={S.label}>DIRECCIÓN / UBICACIÓN *</span>
              <input value={direccion} onChange={e => setDir(e.target.value)}
                placeholder="Av. Ejemplo 1234, Distrito, Ciudad" style={S.input}/>
            </div>

            {/* Cantidad terminales */}
            <div style={{ marginBottom: 10 }}>
              <span style={S.label}>CANTIDAD DE TERMINALES</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setCant(Math.max(1, cantTerm-1))}
                  style={{ width: 32, height: 32, borderRadius: 8, background: '#141d35', border: '1px solid #1e2d4a', color: '#e8eeff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#7c5cfc', minWidth: 40, textAlign: 'center' }}>{cantTerm}</span>
                <button onClick={() => setCant(cantTerm+1)}
                  style={{ width: 32, height: 32, borderRadius: 8, background: '#141d35', border: '1px solid #1e2d4a', color: '#e8eeff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                <span style={{ fontSize: 9, color: '#3d4f73', fontFamily: 'monospace' }}>terminal{cantTerm > 1 ? 'es' : ''} solicitada{cantTerm > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 14 }}>
              <span style={S.label}>NOTAS ADICIONALES</span>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                placeholder="Información adicional relevante..."
                style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }}/>
            </div>

            {formError && (
              <div style={{ padding: '8px 12px', background: 'rgba(247,37,100,0.08)', border: '1px solid rgba(247,37,100,0.2)', borderRadius: 8, fontSize: 11, color: '#f72564', marginBottom: 10 }}>
                {formError}
              </div>
            )}
            {success && (
              <div style={{ padding: '8px 12px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, fontSize: 11, color: '#00e5a0', marginBottom: 10 }}>
                Solicitud enviada correctamente. El administrador la revisará pronto.
              </div>
            )}

            <button onClick={handleEnviar} disabled={sending}
              style={{ width: '100%', padding: '10px', borderRadius: 8, background: sending ? '#1e2d4a' : 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.4)', color: sending ? '#3d4f73' : '#7c5cfc', fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer' }}>
              {sending ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </div>

        {/* ── LISTA DE SOLICITUDES ── */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#e8eeff' }}>
              {isAdmin ? 'Todas las solicitudes' : 'Mis solicitudes'}
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['PENDIENTE','APROBADO','RECHAZADO','TODOS'] as const).map(f => (
                <button key={f} onClick={() => setFiltroE(f)} style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 9, fontFamily: 'monospace', cursor: 'pointer', border: '1px solid',
                  background: filtroE === f ? (ESTADO_STYLE[f] || { bg: 'rgba(79,142,247,0.1)' }).bg : 'transparent',
                  borderColor: filtroE === f ? (ESTADO_STYLE[f] || { border: 'rgba(79,142,247,0.3)' }).border : '#1e2d4a',
                  color: filtroE === f ? (ESTADO_STYLE[f] || { color: '#4f8ef7' }).color : '#7b8db0',
                }}>
                  {f === 'TODOS' ? 'Todos' : f.charAt(0) + f.slice(1).toLowerCase()}
                  {f === 'PENDIENTE' && pendCount > 0 && <span style={{ marginLeft: 4, background: '#f7931a', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 8 }}>{pendCount}</span>}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p style={{ fontSize: 11, color: '#3d4f73', fontFamily: 'monospace', textAlign: 'center', padding: '30px 0' }}>Cargando...</p>
          ) : solFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: .3 }}>📋</div>
              <p style={{ fontSize: 11, color: '#3d4f73', fontFamily: 'monospace' }}>
                {filtroE === 'PENDIENTE' ? 'No hay solicitudes pendientes' : 'Sin solicitudes en este estado'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto', paddingRight: 2 }}>
              {solFiltradas.map(sol => {
                const est = ESTADO_STYLE[sol.estado] || ESTADO_STYLE.PENDIENTE
                const tipoLabel = TIPOS.find(t => t.value === sol.tipo)?.label || sol.tipo
                return (
                  <div key={sol.id} style={{ background: '#141d35', border: `1px solid ${est.border}`, borderRadius: 10, padding: '11px 13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 8, background: est.bg, color: est.color, border: `1px solid ${est.border}`, padding: '2px 8px', borderRadius: 8, fontFamily: 'monospace', fontWeight: 600 }}>{sol.estado}</span>
                        <span style={{ fontSize: 8, color: '#4f8ef7', background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', padding: '2px 8px', borderRadius: 8, fontFamily: 'monospace' }}>{tipoLabel}</span>
                      </div>
                      <span style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>{fmtFecha(sol.created_at)}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', marginBottom: 1 }}>EMPRESA</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>{sol.empresa}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', marginBottom: 1 }}>ENCARGADO</div>
                        <div style={{ fontSize: 11, color: '#e8eeff' }}>{sol.encargado}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', marginBottom: 1 }}>CORREO</div>
                        <div style={{ fontSize: 10, color: '#4f8ef7' }}>{sol.correo}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', marginBottom: 1 }}>TERMINALES</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#7c5cfc' }}>{sol.cant_terminales}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: sol.estado === 'PENDIENTE' && isAdmin ? 10 : 0 }}>
                      <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', marginBottom: 1 }}>DIRECCIÓN</div>
                      <div style={{ fontSize: 10, color: '#7b8db0' }}>{sol.direccion}</div>
                    </div>

                    {sol.notas && (
                      <div style={{ marginBottom: 8, padding: '6px 8px', background: '#0f1629', borderRadius: 6 }}>
                        <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', marginBottom: 1 }}>NOTAS</div>
                        <div style={{ fontSize: 10, color: '#7b8db0' }}>{sol.notas}</div>
                      </div>
                    )}

                    {sol.estado === 'RECHAZADO' && sol.motivo_rechazo && (
                      <div style={{ padding: '6px 8px', background: 'rgba(247,37,100,0.05)', border: '1px solid rgba(247,37,100,0.15)', borderRadius: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 8, color: '#f72564', fontFamily: 'monospace', marginBottom: 1 }}>MOTIVO DE RECHAZO</div>
                        <div style={{ fontSize: 10, color: '#7b8db0' }}>{sol.motivo_rechazo}</div>
                      </div>
                    )}

                    {sol.solicitante_nombre && (
                      <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>
                        Solicitado por: {sol.solicitante_nombre}
                      </div>
                    )}

                    {/* Acciones admin */}
                    {isAdmin && sol.estado === 'PENDIENTE' && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button onClick={() => handleAprobar(sol.id || sol._id || '')} disabled={actionLoad}
                          style={{ flex: 1, padding: '7px', borderRadius: 7, background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', color: '#00e5a0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          Aprobar
                        </button>
                        <button onClick={() => { setModalSol(sol.id || sol._id || ''); setMotivoRec('') }} disabled={actionLoad}
                          style={{ flex: 1, padding: '7px', borderRadius: 7, background: 'rgba(247,37,100,0.08)', border: '1px solid rgba(247,37,100,0.25)', color: '#f72564', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal rechazo */}
      {modalSol && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 14, padding: '22px 24px', width: 420, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#e8eeff' }}>Rechazar solicitud</h3>
            {solDetail && (
              <p style={{ margin: '0 0 14px', fontSize: 11, color: '#7b8db0' }}>
                {solDetail.empresa} · {solDetail.encargado} · {solDetail.cant_terminales} terminales
              </p>
            )}
            <label style={S.label}>MOTIVO DEL RECHAZO *</label>
            <textarea value={motivoRec} onChange={e => setMotivoRec(e.target.value)} rows={3}
              placeholder="Indica el motivo para que el solicitante pueda corregirlo..."
              style={{ ...S.input, resize: 'none', marginBottom: 14 }}/>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalSol(null)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2d4a', color: '#7b8db0', fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => handleRechazar(modalSol)} disabled={!motivoRec.trim() || actionLoad}
                style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'rgba(247,37,100,0.1)', border: '1px solid rgba(247,37,100,0.3)', color: '#f72564', fontSize: 12, fontWeight: 600, cursor: !motivoRec.trim() ? 'not-allowed' : 'pointer', opacity: !motivoRec.trim() ? .5 : 1 }}>
                {actionLoad ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
