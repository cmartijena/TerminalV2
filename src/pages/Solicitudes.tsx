import { useEffect, useState } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useSolicitudes } from '../store/solicitudes'
import type { TipoSolicitud, TipoMaquina } from '../types'

// ── Constantes ──────────────────────────────────────────────────────────────
const TIPOS_SOL: { value: TipoSolicitud; label: string; desc: string }[] = [
  { value: 'NUEVO_LOCAL',    label: 'Nuevo local',    desc: 'Apertura de nueva agencia/sede' },
  { value: 'NUEVA_TERMINAL', label: 'Nueva terminal', desc: 'Agregar máquinas a local existente' },
  { value: 'NUEVA_EMPRESA',  label: 'Nueva empresa',  desc: 'Registrar nuevo operador' },
]

const TIPOS_MAQ: { value: TipoMaquina; label: string; desc: string }[] = [
  { value: 'BOX_SIMPLE', label: 'Box Simple',   desc: 'Cabina individual estándar' },
  { value: 'BOX_DUAL',   label: 'Box Dual',     desc: 'Cabina doble con 2 pantallas' },
  { value: 'WALL_PARED', label: 'Wall de Pared', desc: 'Montaje en pared, sin cabina' },
]

const EST: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDIENTE: { bg: 'rgba(247,147,26,0.1)',  color: '#f7931a', border: 'rgba(247,147,26,0.3)',  label: 'PENDIENTE' },
  APROBADO:  { bg: 'rgba(0,229,160,0.1)',   color: '#00e5a0', border: 'rgba(0,229,160,0.3)',   label: 'APROBADO'  },
  RECHAZADO: { bg: 'rgba(247,37,100,0.1)',  color: '#f72564', border: 'rgba(247,37,100,0.3)',  label: 'RECHAZADO' },
}

const S = {
  page:  { padding: '20px 24px', background: '#0a0e1a', minHeight: '100vh' },
  card:  { background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 12, padding: '16px 18px' },
  input: { width: '100%', background: '#141d35', border: '1px solid #1e2d4a', borderRadius: 8,
           padding: '8px 12px', fontSize: 12, color: '#e8eeff', outline: 'none', fontFamily: 'system-ui' },
  lbl:   { fontSize: 8, color: '#7b8db0', fontFamily: 'monospace', letterSpacing: 1, display: 'block', marginBottom: 5 },
  sec:   { fontSize: 10, fontWeight: 600, color: '#7c5cfc', fontFamily: 'monospace', letterSpacing: 1,
           borderBottom: '1px solid #1e2d4a', paddingBottom: 6, marginBottom: 10 },
} as const

// ── Campo helper ─────────────────────────────────────────────────────────────
function Field({ label, children, col = false }: { label: string; children: React.ReactNode; col?: boolean }) {
  return (
    <div style={{ marginBottom: col ? 0 : 10 }}>
      <span style={S.lbl as any}>{label}</span>
      {children}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Solicitudes() {
  const user    = useAuth(s => s.user)
  const { empresas, loaded, loadAll } = useDB()
  const { solicitudes, loading, crear, aprobar, rechazar, loadAll: loadSol } = useSolicitudes()

  const rol     = user?.rol || 'TECNICO'
  const isAdmin = ['ADMINISTRADOR', 'DIRECTIVO'].includes(rol)
  const isFranq = rol === 'FRANQUICIADO'

  // La empresa del franquiciado (primera asignada)
  const miEmpresa = isFranq ? (user?.empresas?.[0] || '') : ''
  const miEmpresaObj = empresas.find(e => e.nombre === miEmpresa || e._id === miEmpresa)

  // ── Form state ──────────────────────────────────────────────────────────
  const [tipo,     setTipo]    = useState<TipoSolicitud>('NUEVO_LOCAL')
  const [maq,      setMaq]     = useState<TipoMaquina>('BOX_SIMPLE')
  const [empresa,  setEmpresa] = useState(miEmpresa)
  const [agNombre, setAgNom]   = useState('')
  const [telefono, setTel]     = useState('')
  const [cargo,    setCargo]   = useState('')
  const [direccion,setDir]     = useState('')
  const [mapsLink, setMaps]    = useState('')
  const [cantTerm, setCant]    = useState(1)
  const [notas,    setNotas]   = useState('')
  const [sending,  setSend]    = useState(false)
  const [success,  setOk]      = useState(false)
  const [formErr,  setErr]     = useState('')

  // ── Admin state ──────────────────────────────────────────────────────────
  const [filtro,   setFiltro]  = useState<'PENDIENTE'|'APROBADO'|'RECHAZADO'|'TODOS'>('PENDIENTE')
  const [detalle,  setDetalle] = useState<string|null>(null)
  const [recModal, setRecMod]  = useState<string|null>(null)
  const [motivoRec,setMotivo]  = useState('')
  const [actLoad,  setActLoad] = useState(false)

  useEffect(() => {
    if (!loaded) loadAll()
    loadSol()
  }, [])

  // Auto-set empresa para franquiciado
  useEffect(() => {
    if (isFranq && miEmpresaObj) setEmpresa(miEmpresaObj.nombre)
  }, [miEmpresaObj])

  const handleEnviar = async () => {
    if (!agNombre.trim() || !direccion.trim() || !telefono.trim() || !cargo.trim()) {
      setErr('Completa todos los campos obligatorios'); return
    }
    setSend(true); setErr('')
    const empObj = empresas.find(e => e.nombre === empresa)
    const res = await crear({
      tipo, empresa,
      empresa_id: empObj?._id,
      franquiciado_nombre:   user?.nombre || '',
      franquiciado_correo:   user?.correo || '',
      franquiciado_telefono: telefono,
      franquiciado_cargo:    cargo,
      agencia_nombre:  agNombre,
      direccion,
      maps_link:       mapsLink,
      cant_terminales: cantTerm,
      tipo_maquina:    maq,
      notas,
      solicitante_id:     String(user?.id || ''),
      solicitante_nombre: user?.nombre || '',
    })
    setSend(false)
    if (res.ok) {
      setOk(true); setAgNom(''); setDir(''); setMaps(''); setCant(1); setNotas(''); setTel(''); setCargo('')
      setTimeout(() => setOk(false), 5000)
    } else setErr(res.error || 'Error al enviar')
  }

  const handleAprobar = async (id: string) => {
    setActLoad(true)
    await aprobar(id, user?.nombre || 'Admin')
    setActLoad(false); setDetalle(null)
  }

  const handleRechazar = async (id: string) => {
    if (!motivoRec.trim()) return
    setActLoad(true)
    await rechazar(id, motivoRec)
    setActLoad(false); setRecMod(null); setMotivo('')
  }

  const fmtFecha = (d?: string) => {
    if (!d) return '—'
    const dt = new Date(d)
    return dt.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' + dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  const solFiltradas = filtro === 'TODOS'
    ? solicitudes
    : solicitudes.filter(s => s.estado === filtro)

  const pendCount = solicitudes.filter(s => s.estado === 'PENDIENTE').length
  const solRec     = solicitudes.find(s => s.id === recModal)

  const maqLabel = (v: string) => TIPOS_MAQ.find(m => m.value === v)?.label || v
  const tipoLabel = (v: string) => TIPOS_SOL.find(t => t.value === v)?.label || v

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page as any}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#e8eeff' }}>Solicitudes</h1>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#7b8db0', fontFamily: 'monospace' }}>
            {isAdmin
              ? `Revisión y aprobación de solicitudes${pendCount > 0 ? ` · ${pendCount} pendiente${pendCount>1?'s':''}` : ''}`
              : `Solicitudes de ${user?.nombre || ''} · ${miEmpresa}`}
          </p>
        </div>
        {pendCount > 0 && isAdmin && (
          <div style={{ background: 'rgba(247,147,26,0.1)', border: '1px solid rgba(247,147,26,0.3)', borderRadius: 10, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f7931a' }} />
            <span style={{ fontSize: 11, color: '#f7931a', fontFamily: 'monospace', fontWeight: 600 }}>{pendCount} pendiente{pendCount>1?'s':''} de revisión</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isFranq ? '420px 1fr' : '380px 1fr', gap: 16 }}>

        {/* ══ FORMULARIO ══════════════════════════════════════════════════ */}
        <div style={S.card as any}>
          <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 600, color: '#e8eeff' }}>Nueva solicitud</p>

          {/* Tipo de solicitud */}
          <div style={{ marginBottom: 14 }}>
            <span style={S.lbl as any}>TIPO DE SOLICITUD</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {TIPOS_SOL.map(t => (
                <div key={t.value} onClick={() => setTipo(t.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px', borderRadius: 8,
                    background: tipo === t.value ? 'rgba(124,92,252,0.1)' : '#141d35',
                    border: `1px solid ${tipo===t.value ? 'rgba(124,92,252,0.4)' : '#1e2d4a'}`, cursor: 'pointer' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${tipo===t.value ? '#7c5cfc' : '#3d4f73'}`,
                    background: tipo===t.value ? '#7c5cfc' : 'transparent' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: tipo===t.value ? '#e8eeff' : '#7b8db0' }}>{t.label}</div>
                    <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Separador — Datos del franquiciado */}
          <div style={S.sec as any}>DATOS DEL FRANQUICIADO</div>

          {/* Empresa */}
          <Field label="EMPRESA">
            {isFranq ? (
              <div style={{ ...S.input as any, background: '#0a0e1a', color: '#00e5a0', fontWeight: 600, cursor: 'not-allowed' }}>
                {empresa || miEmpresa}
              </div>
            ) : (
              <select value={empresa} onChange={e => setEmpresa(e.target.value)}
                style={{ ...(S.input as any), appearance: 'none' }}>
                <option value="">Seleccionar empresa...</option>
                {empresas.map(e => <option key={e._id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            )}
          </Field>

          {/* Nombre del franquiciado (readonly) */}
          <Field label="NOMBRE DEL FRANQUICIADO">
            <div style={{ ...S.input as any, background: '#0a0e1a', color: '#4f8ef7', cursor: 'not-allowed' }}>
              {user?.nombre || '—'}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Field label="TELÉFONO DE CONTACTO *" col>
              <input value={telefono} onChange={e => setTel(e.target.value)}
                placeholder="+51 999 999 999" style={S.input as any} />
            </Field>
            <Field label="CARGO EN LA EMPRESA *" col>
              <input value={cargo} onChange={e => setCargo(e.target.value)}
                placeholder="Ej. Gerente, Propietario..." style={S.input as any} />
            </Field>
          </div>

          {/* Separador — Datos del nuevo local */}
          <div style={{ ...S.sec as any, marginTop: 14 }}>DATOS DEL NUEVO LOCAL</div>

          <Field label="NOMBRE DE LA AGENCIA / LOCAL *">
            <input value={agNombre} onChange={e => setAgNom(e.target.value)}
              placeholder="Ej. ALISOS 2, MODELO NORTE..." style={S.input as any} />
          </Field>

          <Field label="DIRECCIÓN COMPLETA *">
            <input value={direccion} onChange={e => setDir(e.target.value)}
              placeholder="Av. / Jr. / Calle, Número, Distrito, Ciudad" style={S.input as any} />
          </Field>

          <Field label="LINK DE UBICACIÓN EN GOOGLE MAPS">
            <input value={mapsLink} onChange={e => setMaps(e.target.value)}
              placeholder="https://maps.google.com/..." style={S.input as any} />
          </Field>

          {/* Separador — Equipamiento */}
          <div style={{ ...S.sec as any, marginTop: 14 }}>EQUIPAMIENTO SOLICITADO</div>

          <Field label="TIPO DE MÁQUINA">
            <div style={{ display: 'flex', gap: 6 }}>
              {TIPOS_MAQ.map(m => (
                <div key={m.value} onClick={() => setMaq(m.value)}
                  style={{ flex: 1, padding: '7px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    background: maq===m.value ? 'rgba(79,142,247,0.1)' : '#141d35',
                    border: `1px solid ${maq===m.value ? 'rgba(79,142,247,0.4)' : '#1e2d4a'}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: maq===m.value ? '#4f8ef7' : '#7b8db0', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', lineHeight: 1.3 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="CANTIDAD DE TERMINALES">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setCant(Math.max(1, cantTerm-1))}
                style={{ width: 34, height: 34, borderRadius: 8, background: '#141d35', border: '1px solid #1e2d4a', color: '#e8eeff', fontSize: 20, cursor: 'pointer' }}>−</button>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#7c5cfc', minWidth: 44, textAlign: 'center' }}>{cantTerm}</span>
              <button onClick={() => setCant(cantTerm+1)}
                style={{ width: 34, height: 34, borderRadius: 8, background: '#141d35', border: '1px solid #1e2d4a', color: '#e8eeff', fontSize: 20, cursor: 'pointer' }}>+</button>
              <div>
                <div style={{ fontSize: 10, color: '#7b8db0' }}>{maqLabel(maq)}</div>
                <div style={{ fontSize: 9, color: '#3d4f73', fontFamily: 'monospace' }}>{cantTerm} unidad{cantTerm>1?'es':''}</div>
              </div>
            </div>
          </Field>

          <Field label="NOTAS ADICIONALES">
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
              placeholder="Información adicional, horarios, acceso al local..."
              style={{ ...(S.input as any), resize: 'vertical', lineHeight: 1.5 }} />
          </Field>

          {formErr && (
            <div style={{ padding: '8px 12px', background: 'rgba(247,37,100,0.08)', border: '1px solid rgba(247,37,100,0.2)', borderRadius: 8, fontSize: 11, color: '#f72564', marginBottom: 10 }}>{formErr}</div>
          )}
          {success && (
            <div style={{ padding: '8px 12px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, fontSize: 11, color: '#00e5a0', marginBottom: 10 }}>
              Solicitud enviada. El administrador la revisará pronto.
            </div>
          )}

          <button onClick={handleEnviar} disabled={sending}
            style={{ width: '100%', padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
              background: sending ? '#1e2d4a' : 'rgba(124,92,252,0.15)',
              border: '1px solid rgba(124,92,252,0.4)', color: sending ? '#3d4f73' : '#7c5cfc' }}>
            {sending ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>

        {/* ══ PANEL DERECHO: LISTA + DETALLE ══════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={S.card as any}>
            {/* Tabs filtro */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#e8eeff' }}>
                {isAdmin ? 'Solicitudes recibidas' : 'Mis solicitudes'}
              </p>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['PENDIENTE','APROBADO','RECHAZADO','TODOS'] as const).map(f => {
                  const e = EST[f] || { bg:'rgba(79,142,247,0.1)', color:'#4f8ef7', border:'rgba(79,142,247,0.3)' }
                  return (
                    <button key={f} onClick={() => setFiltro(f)} style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 9, fontFamily: 'monospace', cursor: 'pointer', border: '1px solid',
                      background: filtro===f ? e.bg : 'transparent',
                      borderColor: filtro===f ? e.border : '#1e2d4a',
                      color: filtro===f ? e.color : '#7b8db0',
                    }}>
                      {f==='TODOS' ? 'Todos' : f.charAt(0)+f.slice(1).toLowerCase()}
                      {f==='PENDIENTE' && pendCount>0 && (
                        <span style={{ marginLeft:4, background:'#f7931a', color:'#fff', borderRadius:8, padding:'0 5px', fontSize:8 }}>{pendCount}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Lista */}
            {loading ? (
              <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'30px 0' }}>Cargando...</p>
            ) : solFiltradas.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#3d4f73' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
                <p style={{ fontSize:11, fontFamily:'monospace' }}>No hay solicitudes {filtro==='TODOS'?'':'en este estado'}</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:560, overflowY:'auto', paddingRight:2 }}>
                {solFiltradas.map(sol => {
                  const es = EST[sol.estado] || EST.PENDIENTE
                  return (
                    <div key={sol.id} onClick={() => setDetalle(detalle===sol.id ? null : (sol.id||''))}
                      style={{ background:'#141d35', border:`1px solid ${es.border}`, borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all .15s' }}>

                      {/* Header tarjeta */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                          <span style={{ fontSize:8, background:es.bg, color:es.color, border:`1px solid ${es.border}`, padding:'2px 8px', borderRadius:8, fontFamily:'monospace', fontWeight:600 }}>{sol.estado}</span>
                          <span style={{ fontSize:8, color:'#4f8ef7', background:'rgba(79,142,247,0.1)', border:'1px solid rgba(79,142,247,0.2)', padding:'2px 8px', borderRadius:8, fontFamily:'monospace' }}>{tipoLabel(sol.tipo)}</span>
                          <span style={{ fontSize:9, fontWeight:700, color:'#e8eeff' }}>{sol.agencia_nombre || '—'}</span>
                        </div>
                        <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', flexShrink:0 }}>{fmtFecha(sol.created_at)}</span>
                      </div>

                      {/* Resumen compacto */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>EMPRESA</div>
                          <div style={{ fontSize:10, fontWeight:600, color:'#e8eeff' }}>{sol.empresa}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>FRANQUICIADO</div>
                          <div style={{ fontSize:10, color:'#e8eeff' }}>{sol.franquiciado_nombre}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>EQUIPAMIENTO</div>
                          <div style={{ fontSize:10, color:'#7c5cfc', fontWeight:700 }}>{sol.cant_terminales}× {maqLabel(sol.tipo_maquina)}</div>
                        </div>
                      </div>

                      {/* Dirección */}
                      <div style={{ fontSize:9, color:'#7b8db0', marginBottom: detalle===sol.id ? 10 : 0 }}>{sol.direccion}</div>

                      {/* Detalle expandido */}
                      {detalle === sol.id && (
                        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #1e2d4a' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>

                            {/* Datos franquiciado */}
                            <div style={{ background:'#0f1629', borderRadius:8, padding:'9px 11px' }}>
                              <div style={{ fontSize:9, color:'#7c5cfc', fontFamily:'monospace', fontWeight:600, marginBottom:7 }}>DATOS DEL FRANQUICIADO</div>
                              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                <Row label="Nombre"   value={sol.franquiciado_nombre} />
                                <Row label="Correo"   value={sol.franquiciado_correo} color="#4f8ef7" />
                                <Row label="Teléfono" value={sol.franquiciado_telefono} />
                                <Row label="Cargo"    value={sol.franquiciado_cargo} />
                              </div>
                            </div>

                            {/* Datos del local */}
                            <div style={{ background:'#0f1629', borderRadius:8, padding:'9px 11px' }}>
                              <div style={{ fontSize:9, color:'#4f8ef7', fontFamily:'monospace', fontWeight:600, marginBottom:7 }}>DATOS DEL LOCAL</div>
                              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                <Row label="Agencia"   value={sol.agencia_nombre} />
                                <Row label="Dirección" value={sol.direccion} />
                                <Row label="Terminales" value={`${sol.cant_terminales} × ${maqLabel(sol.tipo_maquina)}`} color="#7c5cfc" />
                                {sol.maps_link && (
                                  <div>
                                    <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>UBICACIÓN</div>
                                    <a href={sol.maps_link} target="_blank" rel="noreferrer"
                                      style={{ fontSize:10, color:'#00e5a0', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                      Ver en Maps
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {sol.notas && (
                            <div style={{ padding:'8px 10px', background:'#0f1629', borderRadius:8, marginBottom:10 }}>
                              <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginBottom:3 }}>NOTAS</div>
                              <div style={{ fontSize:10, color:'#7b8db0' }}>{sol.notas}</div>
                            </div>
                          )}

                          {sol.estado==='RECHAZADO' && sol.motivo_rechazo && (
                            <div style={{ padding:'8px 10px', background:'rgba(247,37,100,0.05)', border:'1px solid rgba(247,37,100,0.15)', borderRadius:8, marginBottom:10 }}>
                              <div style={{ fontSize:8, color:'#f72564', fontFamily:'monospace', marginBottom:3 }}>MOTIVO DE RECHAZO</div>
                              <div style={{ fontSize:10, color:'#7b8db0' }}>{sol.motivo_rechazo}</div>
                            </div>
                          )}

                          {sol.estado==='APROBADO' && sol.aprobado_por && (
                            <div style={{ fontSize:9, color:'#00e5a0', fontFamily:'monospace' }}>
                              Aprobado por: {sol.aprobado_por} · {fmtFecha(sol.updated_at)}
                            </div>
                          )}

                          {/* Botones admin */}
                          {isAdmin && sol.estado==='PENDIENTE' && (
                            <div style={{ display:'flex', gap:8, marginTop:10 }}>
                              <button onClick={e => { e.stopPropagation(); handleAprobar(sol.id||'') }} disabled={actLoad}
                                style={{ flex:1, padding:'9px', borderRadius:8, background:'rgba(0,229,160,0.1)', border:'1px solid rgba(0,229,160,0.3)', color:'#00e5a0', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                                Aprobar solicitud
                              </button>
                              <button onClick={e => { e.stopPropagation(); setRecMod(sol.id||''); setMotivo('') }} disabled={actLoad}
                                style={{ flex:1, padding:'9px', borderRadius:8, background:'rgba(247,37,100,0.08)', border:'1px solid rgba(247,37,100,0.25)', color:'#f72564', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal rechazo ──────────────────────────────────────────────────── */}
      {recModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
          onClick={() => setRecMod(null)}>
          <div style={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:14, padding:'22px 24px', width:440, maxWidth:'90vw' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 5px', fontSize:14, fontWeight:700, color:'#e8eeff' }}>Rechazar solicitud</h3>
            {solRec && (
              <p style={{ margin:'0 0 14px', fontSize:11, color:'#7b8db0' }}>
                {solRec.empresa} · {solRec.agencia_nombre} · {solRec.cant_terminales} terminales
              </p>
            )}
            <span style={S.lbl as any}>MOTIVO DEL RECHAZO *</span>
            <textarea value={motivoRec} onChange={e => setMotivo(e.target.value)} rows={4}
              placeholder="Indica el motivo para que el franquiciado pueda corregirlo..."
              style={{ ...(S.input as any), resize:'none', marginBottom:14 }} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setRecMod(null)}
                style={{ flex:1, padding:'9px', borderRadius:8, background:'transparent', border:'1px solid #1e2d4a', color:'#7b8db0', fontSize:12, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => handleRechazar(recModal)} disabled={!motivoRec.trim() || actLoad}
                style={{ flex:1, padding:'9px', borderRadius:8, background:'rgba(247,37,100,0.1)', border:'1px solid rgba(247,37,100,0.3)', color:'#f72564', fontSize:12, fontWeight:600, cursor:!motivoRec.trim()?'not-allowed':'pointer', opacity:!motivoRec.trim()?.5:1 }}>
                {actLoad ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper para filas de detalle
function Row({ label, value, color }: { label: string; value?: string; color?: string }) {
  if (!value) return null
  return (
    <div>
      <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>{label}</div>
      <div style={{ fontSize:10, color: color || '#e8eeff', wordBreak:'break-word' }}>{value}</div>
    </div>
  )
}
