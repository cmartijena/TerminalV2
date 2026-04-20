import { useEffect, useState } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useSolicitudes } from '../store/solicitudes'
import type { TipoSolicitud, TipoMaquina } from '../types'

// ── Constantes ──────────────────────────────────────────────────────────────
const TIPOS_MAQ: { value: TipoMaquina; label: string; icon: string }[] = [
  { value: 'BOX_SIMPLE', label: 'Box Simple',    icon: '▣' },
  { value: 'BOX_DUAL',   label: 'Box Dual',      icon: '▣▣' },
  { value: 'WALL_PARED', label: 'Wall de Pared', icon: '▤' },
]

const EST: Record<string, { bg: string; color: string; border: string }> = {
  PENDIENTE: { bg:'rgba(247,147,26,0.1)',  color:'#f7931a', border:'rgba(247,147,26,0.3)' },
  APROBADO:  { bg:'rgba(0,229,160,0.1)',   color:'#00e5a0', border:'rgba(0,229,160,0.3)' },
  RECHAZADO: { bg:'rgba(247,37,100,0.1)',  color:'#f72564', border:'rgba(247,37,100,0.3)' },
}

// ── Estilos base ─────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width:'100%', background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8,
  padding:'9px 12px', fontSize:12, color:'#e8eeff', outline:'none', fontFamily:'system-ui',
}
const lbl: React.CSSProperties = {
  fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1.2,
  display:'block', marginBottom:5, textTransform:'uppercase' as const,
}
const sec: React.CSSProperties = {
  fontSize:9, fontWeight:700, fontFamily:'monospace', letterSpacing:1.5,
  paddingBottom:7, marginBottom:12, marginTop:18,
  borderBottom:'1px solid #1e2d4a', display:'flex', alignItems:'center', gap:7,
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function F({ label, children, half=false }: { label:string; children:React.ReactNode; half?:boolean }) {
  return (
    <div style={{ marginBottom:10, gridColumn: half ? 'span 1' : 'span 2' }}>
      <span style={lbl}>{label}</span>
      {children}
    </div>
  )
}

function Dot({ color }: { color:string }) {
  return <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }} />
}

function Row({ label, value, color }: { label:string; value?:string; color?:string }) {
  if (!value) return null
  return (
    <div style={{ marginBottom:5 }}>
      <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:10, color:color||'#e8eeff', wordBreak:'break-word' as const }}>{value}</div>
    </div>
  )
}

// ── Sección header ──────────────────────────────────────────────────────────
function SecHeader({ color, icon, label }: { color:string; icon:React.ReactNode; label:string }) {
  return (
    <div style={{ ...sec, color }}>
      <div style={{ width:20, height:20, borderRadius:6, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">{icon}</svg>
      </div>
      {label}
    </div>
  )
}

// ── Maquinas selector ────────────────────────────────────────────────────────
interface MaqEntry { tipo: TipoMaquina; cant: number }

function MaqSelector({ value, onChange }: { value: MaqEntry[]; onChange: (v:MaqEntry[]) => void }) {
  const toggle = (tipo: TipoMaquina) => {
    const exists = value.find(m => m.tipo === tipo)
    if (exists) onChange(value.filter(m => m.tipo !== tipo))
    else onChange([...value, { tipo, cant:1 }])
  }
  const setCant = (tipo: TipoMaquina, cant: number) => {
    onChange(value.map(m => m.tipo === tipo ? { ...m, cant: Math.max(1, cant) } : m))
  }
  const total = value.reduce((a, m) => a + m.cant, 0)
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:10 }}>
        {TIPOS_MAQ.map(m => {
          const sel = value.find(v => v.tipo === m.value)
          return (
            <div key={m.value} onClick={() => toggle(m.value)}
              style={{ padding:'10px 8px', borderRadius:9, cursor:'pointer', textAlign:'center',
                background: sel ? 'rgba(124,92,252,0.12)' : '#141d35',
                border: `1px solid ${sel ? 'rgba(124,92,252,0.45)' : '#1e2d4a'}`,
                transition:'all .15s' }}>
              <div style={{ fontSize:18, marginBottom:4, filter: sel ? 'none' : 'grayscale(1) opacity(0.4)' }}>{m.icon}</div>
              <div style={{ fontSize:10, fontWeight:600, color: sel ? '#e8eeff' : '#7b8db0' }}>{m.label}</div>
              {sel && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:6 }}
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => setCant(m.value, sel.cant-1)}
                    style={{ width:22, height:22, borderRadius:6, background:'#1e2d4a', border:'none', color:'#e8eeff', fontSize:14, cursor:'pointer' }}>−</button>
                  <span style={{ fontSize:14, fontWeight:800, color:'#7c5cfc', minWidth:20, textAlign:'center' }}>{sel.cant}</span>
                  <button onClick={() => setCant(m.value, sel.cant+1)}
                    style={{ width:22, height:22, borderRadius:6, background:'#1e2d4a', border:'none', color:'#e8eeff', fontSize:14, cursor:'pointer' }}>+</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {total > 0 && (
        <div style={{ padding:'7px 10px', background:'rgba(124,92,252,0.06)', border:'1px solid rgba(124,92,252,0.2)', borderRadius:8, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:9, color:'#7b8db0', fontFamily:'monospace' }}>TOTAL SOLICITADO</span>
          <span style={{ fontSize:11, color:'#7c5cfc', fontFamily:'monospace', fontWeight:700 }}>
            {value.map(m => `${m.cant} ${TIPOS_MAQ.find(t=>t.value===m.tipo)?.label}`).join(' + ')} = {total} terminales
          </span>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Solicitudes() {
  const user    = useAuth(s => s.user)
  const { empresas, agencias, terminales, loaded, loadAll } = useDB()
  const { solicitudes, loading, crear, aprobar, rechazar, loadAll:loadSol } = useSolicitudes()

  const rol     = user?.rol || 'TECNICO'
  const isAdmin = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const isFranq = rol === 'FRANQUICIADO'

  const miEmpresa    = isFranq ? (user?.empresas?.[0]||'') : ''
  const miEmpresaObj = empresas.find(e => e.nombre===miEmpresa||e._id===miEmpresa)
  const miEmpNombre  = miEmpresaObj?.nombre || miEmpresa

  // ── Form ────────────────────────────────────────────────────────────────
  const [tipo,    setTipo]   = useState<TipoSolicitud>('NUEVO_LOCAL')
  const [empresa, setEmp]    = useState(miEmpNombre)
  // Datos agencia nueva
  const [agNombre, setAgNom]  = useState('')
  const [agEnc,    setAgEnc]  = useState('')
  const [agTel,    setAgTel]  = useState('')
  const [agCorreo, setAgCor]  = useState('')
  const [agDir,    setAgDir]  = useState('')
  const [agMaps,   setAgMaps] = useState('')
  // Datos terminal en agencia existente
  const [deptSel,  setDept]   = useState('')
  const [agSel,    setAgSel]  = useState('')
  // Equipamiento (ambos tipos)
  const [maquinas, setMaq]    = useState<MaqEntry[]>([])
  const [notas,    setNotas]  = useState('')
  // Form status
  const [sending,  setSend]   = useState(false)
  const [success,  setOk]     = useState(false)
  const [formErr,  setErr]    = useState('')

  // Admin
  const [filtro,   setFiltro] = useState<'PENDIENTE'|'APROBADO'|'RECHAZADO'|'TODOS'>('PENDIENTE')
  const [detalle,  setDet]    = useState<string|null>(null)
  const [recModal, setRec]    = useState<string|null>(null)
  const [motivo,   setMot]    = useState('')
  const [actLoad,  setActL]   = useState(false)

  useEffect(() => { if(!loaded) loadAll(); loadSol() }, [])
  useEffect(() => { if(miEmpNombre) setEmp(miEmpNombre) }, [miEmpNombre])
  useEffect(() => { setMaq([]); setAgSel(''); setDept('') }, [tipo])

  // Agrupación por departamento
  const deptos = Array.from(new Set(agencias.map(a=>a.sucursal).filter(Boolean))).sort()
  const agsDept = deptSel ? agencias.filter(a=>a.sucursal===deptSel && (!isFranq || a.empresa===miEmpNombre)) : []
  const agInfo  = agencias.find(a=>a._id===agSel||a.id===Number(agSel))
  const termCount = agInfo ? terminales.filter(t=>t.id_sub===agInfo.id_sub).length : 0

  const tipoLabel = (v:string) => v==='NUEVO_LOCAL'?'Nuevo local':v==='NUEVA_TERMINAL'?'Nueva terminal':'Nueva empresa'
  const fmtFecha = (d?:string) => {
    if(!d) return '—'
    const dt=new Date(d)
    return dt.toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric'})+' · '+dt.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})
  }

  const handleEnviar = async () => {
    const totalMaq = maquinas.reduce((a,m)=>a+m.cant,0)
    if(tipo==='NUEVO_LOCAL' && (!agNombre||!agDir)) { setErr('Completa nombre y dirección de la agencia'); return }
    if(tipo==='NUEVA_TERMINAL' && !agSel) { setErr('Selecciona la agencia'); return }
    if(totalMaq===0) { setErr('Selecciona al menos un tipo de terminal'); return }
    setSend(true); setErr('')

    const empObj = empresas.find(e=>e.nombre===empresa)
    const maqStr = maquinas.map(m=>`${m.cant}x${m.tipo}`).join(',')
    const totalTerms = maquinas.reduce((a,m)=>a+m.cant,0)

    const res = await crear({
      tipo, empresa,
      empresa_id: empObj?._id,
      franquiciado_nombre:   user?.nombre||'',
      franquiciado_correo:   user?.correo||'',
      franquiciado_telefono: agTel || agInfo?.encargado||'',
      franquiciado_cargo:    '',
      agencia_nombre:  tipo==='NUEVO_LOCAL' ? agNombre : (agInfo?.subagencia||''),
      direccion:       tipo==='NUEVO_LOCAL' ? agDir : (agInfo?.direccion||'Sin dirección'),
      maps_link:       tipo==='NUEVO_LOCAL' ? agMaps : '',
      cant_terminales: totalTerms,
      tipo_maquina:    maquinas[0]?.tipo||'BOX_SIMPLE',
      notas:           [
        tipo==='NUEVO_LOCAL' ? `Encargado: ${agEnc} | Tel: ${agTel} | Correo: ${agCorreo}` : `Agencia: ${agInfo?.subagencia} | Dptos: ${deptSel}`,
        `Equipamiento: ${maqStr}`,
        notas,
      ].filter(Boolean).join(' | '),
      solicitante_id:     String(user?.id||''),
      solicitante_nombre: user?.nombre||'',
    })
    setSend(false)
    if(res.ok) {
      setOk(true); setAgNom(''); setAgEnc(''); setAgTel(''); setAgCor(''); setAgDir(''); setAgMaps('')
      setMaq([]); setNotas(''); setAgSel(''); setDept('')
      setTimeout(()=>setOk(false),6000)
    } else setErr(res.error||'Error al enviar')
  }

  const pendCount = solicitudes.filter(s=>s.estado==='PENDIENTE').length
  const solFiltradas = filtro==='TODOS' ? solicitudes : solicitudes.filter(s=>s.estado===filtro)
  const solRec = solicitudes.find(s=>s.id===recModal)

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding:'20px 24px', background:'#0a0e1a', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:19, fontWeight:700, color:'#e8eeff' }}>Solicitudes</h1>
          <p style={{ margin:'3px 0 0', fontSize:10, color:'#7b8db0', fontFamily:'monospace' }}>
            {isAdmin ? `Revisión de solicitudes` : `Solicitudes de ${user?.nombre||''} · ${miEmpNombre}`}
          </p>
        </div>
        {isAdmin && pendCount>0 && (
          <div style={{ background:'rgba(247,147,26,0.1)', border:'1px solid rgba(247,147,26,0.3)', borderRadius:10, padding:'6px 14px', display:'flex', alignItems:'center', gap:7 }}>
            <Dot color="#f7931a"/>
            <span style={{ fontSize:11, color:'#f7931a', fontFamily:'monospace', fontWeight:600 }}>{pendCount} pendiente{pendCount>1?'s':''}</span>
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'400px 1fr', gap:16 }}>

        {/* ══ FORMULARIO ══════════════════════════════════════════════════ */}
        <div style={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:12, padding:'18px 20px' }}>

          {/* Tipo tabs */}
          <div style={{ marginBottom:18 }}>
            <span style={lbl}>TIPO DE SOLICITUD</span>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {([
                { v:'NUEVO_LOCAL',    l:'Nuevo Local',    icon:<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>, c:'#00e5a0' },
                { v:'NUEVA_TERMINAL', l:'Nuevo Terminal',  icon:<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>, c:'#4f8ef7' },
                { v:'NUEVA_EMPRESA',  l:'Nueva Empresa',  icon:<path d="M12 22V12M2 7l10-5 10 5M2 7v10l10 5 10-5V7"/>, c:'#7c5cfc' },
              ] as const).map(t => (
                <div key={t.v} onClick={()=>setTipo(t.v as TipoSolicitud)}
                  style={{ padding:'10px 8px', borderRadius:9, cursor:'pointer', textAlign:'center',
                    background: tipo===t.v ? `${t.c}12` : '#141d35',
                    border: `1px solid ${tipo===t.v ? t.c+'50' : '#1e2d4a'}`,
                    transition:'all .15s' }}>
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:5 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tipo===t.v ? t.c : '#3d4f73'} strokeWidth="2" strokeLinecap="round">{t.icon}</svg>
                  </div>
                  <div style={{ fontSize:10, fontWeight:600, color: tipo===t.v ? t.c : '#7b8db0' }}>{t.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Empresa (readonly franquiciado) */}
          <div style={{ padding:'9px 12px', background:'rgba(10,14,26,0.6)', border:'1px solid #1e2d4a', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:2 }}>EMPRESA</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#00e5a0' }}>{empresa||'—'}</div>
            </div>
            <div>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:2, textAlign:'right' }}>SOLICITANTE</div>
              <div style={{ fontSize:12, color:'#4f8ef7' }}>{user?.nombre||'—'}</div>
            </div>
          </div>

          {/* ── NUEVO LOCAL ── */}
          {tipo==='NUEVO_LOCAL' && (<>
            <SecHeader color="#00e5a0" label="DATOS DE LA NUEVA AGENCIA"
              icon={<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <F label="NOMBRE DE LA AGENCIA *">
                <input value={agNombre} onChange={e=>setAgNom(e.target.value)} placeholder="Ej. ALISOS 2, MODELO NORTE" style={inp}/>
              </F>
              <F label="NOMBRE DEL ENCARGADO *">
                <input value={agEnc} onChange={e=>setAgEnc(e.target.value)} placeholder="Nombre completo" style={inp}/>
              </F>
              <F label="TELÉFONO DEL ENCARGADO" half>
                <input value={agTel} onChange={e=>setAgTel(e.target.value)} placeholder="+51 999 999 999" style={inp}/>
              </F>
              <F label="CORREO DE LA AGENCIA" half>
                <input value={agCorreo} onChange={e=>setAgCor(e.target.value)} placeholder="local@correo.com" type="email" style={inp}/>
              </F>
              <F label="DIRECCIÓN COMPLETA *">
                <input value={agDir} onChange={e=>setAgDir(e.target.value)} placeholder="Av. / Jr., Número, Distrito, Ciudad" style={inp}/>
              </F>
              <F label="LINK GOOGLE MAPS">
                <input value={agMaps} onChange={e=>setAgMaps(e.target.value)} placeholder="https://maps.google.com/..." style={inp}/>
              </F>
            </div>
          </>)}

          {/* ── NUEVA TERMINAL ── */}
          {tipo==='NUEVA_TERMINAL' && (<>
            <SecHeader color="#4f8ef7" label="SELECCIONAR AGENCIA"
              icon={<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <span style={lbl}>DEPARTAMENTO</span>
                <select value={deptSel} onChange={e=>{setDept(e.target.value);setAgSel('')}}
                  style={{ ...inp, appearance:'none' as any }}>
                  <option value="">Seleccionar...</option>
                  {deptos.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <span style={lbl}>AGENCIA</span>
                <select value={agSel} onChange={e=>setAgSel(e.target.value)}
                  style={{ ...inp, appearance:'none' as any }} disabled={!deptSel}>
                  <option value="">Seleccionar agencia...</option>
                  {agsDept.map(a=><option key={a._id} value={String(a._id||a.id)}>{a.subagencia}</option>)}
                </select>
              </div>
            </div>

            {/* Info de la agencia seleccionada */}
            {agInfo && (
              <div style={{ padding:'11px 13px', background:'rgba(79,142,247,0.06)', border:'1px solid rgba(79,142,247,0.2)', borderRadius:9, marginBottom:14 }}>
                <div style={{ fontSize:9, color:'#4f8ef7', fontFamily:'monospace', fontWeight:600, marginBottom:8 }}>INFORMACIÓN DE LA AGENCIA</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <Row label="AGENCIA"   value={agInfo.subagencia} />
                  <Row label="EMPRESA"   value={agInfo.empresa} />
                  <Row label="ENCARGADO" value={agInfo.encargado} />
                  <Row label="CORREO"    value={agInfo.correo} color="#4f8ef7" />
                  <Row label="DIRECCIÓN" value={agInfo.direccion} />
                  <Row label="TERMINALES ACTUALES" value={`${termCount} terminales`} color="#7c5cfc" />
                </div>
              </div>
            )}
          </>)}

          {/* ── NUEVA EMPRESA ── */}
          {tipo==='NUEVA_EMPRESA' && (<>
            <SecHeader color="#7c5cfc" label="DATOS DE LA NUEVA EMPRESA"
              icon={<path d="M12 22V12M2 7l10-5 10 5M2 7v10l10 5 10-5V7"/>}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <F label="NOMBRE DE LA EMPRESA *">
                <input value={agNombre} onChange={e=>setAgNom(e.target.value)} placeholder="Razón social" style={inp}/>
              </F>
              <F label="NOMBRE DEL REPRESENTANTE *">
                <input value={agEnc} onChange={e=>setAgEnc(e.target.value)} placeholder="Nombre completo" style={inp}/>
              </F>
              <F label="TELÉFONO" half>
                <input value={agTel} onChange={e=>setAgTel(e.target.value)} placeholder="+51 999 999 999" style={inp}/>
              </F>
              <F label="CORREO CORPORATIVO" half>
                <input value={agCorreo} onChange={e=>setAgCor(e.target.value)} placeholder="empresa@correo.com" style={inp}/>
              </F>
              <F label="DIRECCIÓN PRINCIPAL">
                <input value={agDir} onChange={e=>setAgDir(e.target.value)} placeholder="Sede principal" style={inp}/>
              </F>
              <F label="RUC / DOCUMENTO">
                <input value={agMaps} onChange={e=>setAgMaps(e.target.value)} placeholder="20XXXXXXXXX" style={inp}/>
              </F>
            </div>
          </>)}

          {/* ── Equipamiento ── */}
          <SecHeader color="#7c5cfc" label="EQUIPAMIENTO SOLICITADO"
            icon={<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>}/>
          <MaqSelector value={maquinas} onChange={setMaq}/>

          {/* Notas */}
          <div style={{ marginTop:12 }}>
            <span style={lbl}>NOTAS ADICIONALES</span>
            <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={3}
              placeholder="Información adicional, horarios, acceso al local, observaciones..."
              style={{ ...inp, resize:'vertical' as any, lineHeight:1.6 }}/>
          </div>

          {/* Errores y éxito */}
          {formErr && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(247,37,100,0.08)', border:'1px solid rgba(247,37,100,0.2)', borderRadius:8, fontSize:11, color:'#f72564' }}>{formErr}</div>
          )}
          {success && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.2)', borderRadius:8, fontSize:11, color:'#00e5a0' }}>
              ✓ Solicitud enviada. El administrador la revisará pronto.
            </div>
          )}

          <button onClick={handleEnviar} disabled={sending} style={{
            width:'100%', marginTop:14, padding:'12px', borderRadius:9, fontSize:13, fontWeight:700,
            cursor: sending?'not-allowed':'pointer',
            background: sending ? '#1e2d4a' : 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(79,142,247,0.15))',
            border: `1px solid ${sending ? '#1e2d4a' : 'rgba(124,92,252,0.5)'}`,
            color: sending ? '#3d4f73' : '#e8eeff',
          }}>
            {sending ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>

        {/* ══ PANEL SOLICITUDES ══════════════════════════════════════════ */}
        <div style={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:12, padding:'18px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#e8eeff' }}>
              {isAdmin ? 'Solicitudes recibidas' : 'Mis solicitudes'}
            </p>
            <div style={{ display:'flex', gap:4 }}>
              {(['PENDIENTE','APROBADO','RECHAZADO','TODOS'] as const).map(f => {
                const e = EST[f]||{ bg:'rgba(79,142,247,0.1)', color:'#4f8ef7', border:'rgba(79,142,247,0.3)' }
                return (
                  <button key={f} onClick={()=>setFiltro(f)} style={{
                    padding:'3px 10px', borderRadius:6, fontSize:9, fontFamily:'monospace', cursor:'pointer', border:'1px solid',
                    background: filtro===f ? e.bg : 'transparent',
                    borderColor: filtro===f ? e.border : '#1e2d4a',
                    color: filtro===f ? e.color : '#7b8db0',
                  }}>
                    {f==='TODOS'?'Todos':f.charAt(0)+f.slice(1).toLowerCase()}
                    {f==='PENDIENTE'&&pendCount>0&&<span style={{ marginLeft:4,background:'#f7931a',color:'#fff',borderRadius:8,padding:'0 5px',fontSize:8 }}>{pendCount}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? (
            <p style={{ fontSize:11,color:'#3d4f73',fontFamily:'monospace',textAlign:'center',padding:'40px 0' }}>Cargando...</p>
          ) : solFiltradas.length===0 ? (
            <div style={{ textAlign:'center',padding:'50px 0',color:'#3d4f73' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1e2d4a" strokeWidth="1.5" style={{ display:'block',margin:'0 auto 12px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p style={{ fontSize:11,fontFamily:'monospace' }}>No hay solicitudes{filtro!=='TODOS'?' en este estado':''}</p>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8,maxHeight:580,overflowY:'auto',paddingRight:2 }}>
              {solFiltradas.map(sol => {
                const es = EST[sol.estado]||EST.PENDIENTE
                const isOpen = detalle===sol.id
                return (
                  <div key={sol.id} style={{ background:'#141d35', border:`1px solid ${isOpen ? es.border : '#1e2d4a'}`, borderRadius:10, overflow:'hidden', transition:'all .15s' }}>

                    {/* Cabecera siempre visible */}
                    <div onClick={()=>setDet(isOpen?null:(sol.id||''))}
                      style={{ padding:'11px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', flex:1, minWidth:0 }}>
                        <span style={{ fontSize:8,background:es.bg,color:es.color,border:`1px solid ${es.border}`,padding:'2px 8px',borderRadius:8,fontFamily:'monospace',fontWeight:600,flexShrink:0 }}>{sol.estado}</span>
                        <span style={{ fontSize:8,color:'#4f8ef7',background:'rgba(79,142,247,0.1)',border:'1px solid rgba(79,142,247,0.2)',padding:'2px 8px',borderRadius:8,fontFamily:'monospace',flexShrink:0 }}>{tipoLabel(sol.tipo)}</span>
                        <span style={{ fontSize:11,fontWeight:700,color:'#e8eeff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{sol.agencia_nombre||'—'}</span>
                        <span style={{ fontSize:9,color:'#7b8db0',flexShrink:0 }}>· {sol.empresa}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        <span style={{ fontSize:8,color:'#3d4f73',fontFamily:'monospace' }}>{fmtFecha(sol.created_at)}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3d4f73" strokeWidth="2"
                          style={{ transform: isOpen?'rotate(180deg)':'rotate(0)', transition:'transform .2s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {/* Detalle expandible */}
                    {isOpen && (
                      <div style={{ padding:'0 14px 14px', borderTop:'1px solid #1e2d4a' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>

                          {/* Datos franquiciado */}
                          <div style={{ background:'#0f1629',borderRadius:9,padding:'10px 12px' }}>
                            <div style={{ fontSize:8,color:'#7c5cfc',fontFamily:'monospace',fontWeight:700,marginBottom:8,letterSpacing:1 }}>SOLICITANTE</div>
                            <Row label="Nombre"   value={sol.solicitante_nombre||sol.franquiciado_nombre}/>
                            <Row label="Empresa"  value={sol.empresa}/>
                            <Row label="Correo"   value={sol.franquiciado_correo} color="#4f8ef7"/>
                            <Row label="Teléfono" value={sol.franquiciado_telefono}/>
                            <Row label="Cargo"    value={sol.franquiciado_cargo}/>
                            <div style={{ fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginTop:6 }}>
                              Enviada: {fmtFecha(sol.created_at)}
                            </div>
                          </div>

                          {/* Datos local/terminal */}
                          <div style={{ background:'#0f1629',borderRadius:9,padding:'10px 12px' }}>
                            <div style={{ fontSize:8,color:'#4f8ef7',fontFamily:'monospace',fontWeight:700,marginBottom:8,letterSpacing:1 }}>
                              {sol.tipo==='NUEVO_LOCAL'?'AGENCIA SOLICITADA':sol.tipo==='NUEVA_TERMINAL'?'AGENCIA DESTINO':'EMPRESA SOLICITADA'}
                            </div>
                            <Row label="Nombre"     value={sol.agencia_nombre}/>
                            <Row label="Dirección"  value={sol.direccion}/>
                            <div style={{ marginBottom:5 }}>
                              <div style={{ fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginBottom:1 }}>EQUIPAMIENTO</div>
                              <div style={{ fontSize:13,fontWeight:800,color:'#7c5cfc' }}>{sol.cant_terminales} terminales</div>
                              <div style={{ fontSize:9,color:'#7b8db0' }}>
                                {sol.notas?.includes('Equipamiento:') ? sol.notas.split('Equipamiento:')[1].split('|')[0].trim() : sol.tipo_maquina}
                              </div>
                            </div>
                            {sol.maps_link && (
                              <a href={sol.maps_link} target="_blank" rel="noreferrer"
                                style={{ display:'inline-flex',alignItems:'center',gap:4,fontSize:10,color:'#00e5a0',textDecoration:'none',
                                  background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.2)',padding:'4px 10px',borderRadius:7 }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                Ver en Google Maps
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Notas */}
                        {sol.notas && (
                          <div style={{ marginTop:8,padding:'8px 10px',background:'#0f1629',borderRadius:8 }}>
                            <div style={{ fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginBottom:3 }}>NOTAS / DETALLES</div>
                            <div style={{ fontSize:10,color:'#7b8db0',lineHeight:1.5 }}>{sol.notas}</div>
                          </div>
                        )}

                        {/* Motivo rechazo */}
                        {sol.estado==='RECHAZADO'&&sol.motivo_rechazo&&(
                          <div style={{ marginTop:8,padding:'8px 10px',background:'rgba(247,37,100,0.05)',border:'1px solid rgba(247,37,100,0.15)',borderRadius:8 }}>
                            <div style={{ fontSize:8,color:'#f72564',fontFamily:'monospace',marginBottom:3 }}>MOTIVO DE RECHAZO</div>
                            <div style={{ fontSize:10,color:'#7b8db0' }}>{sol.motivo_rechazo}</div>
                          </div>
                        )}

                        {/* Aprobado por */}
                        {sol.estado==='APROBADO'&&sol.aprobado_por&&(
                          <div style={{ marginTop:8,fontSize:9,color:'#00e5a0',fontFamily:'monospace' }}>
                            ✓ Aprobado por {sol.aprobado_por} · {fmtFecha(sol.updated_at)}
                          </div>
                        )}

                        {/* Botones admin */}
                        {isAdmin&&sol.estado==='PENDIENTE'&&(
                          <div style={{ display:'flex',gap:8,marginTop:12 }}>
                            <button onClick={()=>{ setActL(true); aprobar(sol.id||'',user?.nombre||'Admin').then(()=>{setActL(false);setDet(null)}) }}
                              disabled={actLoad}
                              style={{ flex:1,padding:'9px',borderRadius:8,background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',color:'#00e5a0',fontSize:12,fontWeight:600,cursor:'pointer' }}>
                              ✓ Aprobar solicitud
                            </button>
                            <button onClick={()=>{setRec(sol.id||'');setMot('')}}
                              disabled={actLoad}
                              style={{ flex:1,padding:'9px',borderRadius:8,background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.25)',color:'#f72564',fontSize:12,fontWeight:600,cursor:'pointer' }}>
                              ✕ Rechazar
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

      {/* Modal rechazo */}
      {recModal&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999 }}
          onClick={()=>setRec(null)}>
          <div style={{ background:'#0f1629',border:'1px solid #1e2d4a',borderRadius:14,padding:'22px 24px',width:440,maxWidth:'90vw' }}
            onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:'0 0 5px',fontSize:14,fontWeight:700,color:'#e8eeff' }}>Rechazar solicitud</h3>
            {solRec&&<p style={{ margin:'0 0 14px',fontSize:11,color:'#7b8db0' }}>{solRec.empresa} · {solRec.agencia_nombre} · {solRec.cant_terminales} terminales</p>}
            <span style={lbl}>MOTIVO DEL RECHAZO *</span>
            <textarea value={motivo} onChange={e=>setMot(e.target.value)} rows={4}
              placeholder="Indica el motivo para que el franquiciado pueda corregirlo..."
              style={{ ...inp,resize:'none' as any,marginBottom:14 }}/>
            <div style={{ display:'flex',gap:8 }}>
              <button onClick={()=>setRec(null)}
                style={{ flex:1,padding:'9px',borderRadius:8,background:'transparent',border:'1px solid #1e2d4a',color:'#7b8db0',fontSize:12,cursor:'pointer' }}>Cancelar</button>
              <button onClick={async()=>{ if(!motivo.trim())return; setActL(true); await rechazar(recModal,motivo); setActL(false);setRec(null);setMot('') }}
                disabled={!motivo.trim()||actLoad}
                style={{ flex:1,padding:'9px',borderRadius:8,background:'rgba(247,37,100,0.1)',border:'1px solid rgba(247,37,100,0.3)',color:'#f72564',fontSize:12,fontWeight:600,cursor:!motivo.trim()?'not-allowed':'pointer',opacity:!motivo.trim()?.5:1 }}>
                {actLoad?'Rechazando...':'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
