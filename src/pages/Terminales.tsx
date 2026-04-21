import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useTerminalOps } from '../store/terminalOps'

const EMP_COLS = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']
const EST: Record<string,{color:string;label:string}> = {
  'ACTIVO':        { color:'#00e5a0', label:'ACTIVO'  },
  'NO DISPONIBLE': { color:'#f72564', label:'N/DISP'  },
  'EN PRODUCCION': { color:'#00e5a0', label:'EN PROD' },
  'DISPONIBLE':    { color:'#4f8ef7', label:'DISP'    },
  'EN REPARACION': { color:'#f7931a', label:'REPARA'  },
  'BAJA':          { color:'#3d4f73', label:'BAJA'    },
}
const MOD: Record<string,{color:string;short:string}> = {
  'BOXDUAL':    { color:'#7c5cfc', short:'DUAL'   },
  'BOX SIMPLE': { color:'#4f8ef7', short:'SIMPLE' },
  'WALL':       { color:'#f7931a', short:'WALL'   },
}
const MODELOS = ['BOXDUAL','BOX SIMPLE','WALL'] as const
const ESTADOS_EDIT = ['ACTIVO','NO DISPONIBLE','EN REPARACION','BAJA'] as const

const S = {
  page: { padding:'20px 24px', background:'#0a0e1a', minHeight:'100vh' } as React.CSSProperties,
  card: { background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:12 } as React.CSSProperties,
  inp:  { background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8,
          padding:'8px 12px', fontSize:12, color:'#e8eeff', outline:'none',
          fontFamily:'system-ui', width:'100%' } as React.CSSProperties,
  chip: (active:boolean, color='#4f8ef7') => ({
    padding:'3px 11px', borderRadius:7, fontSize:9, fontFamily:'monospace',
    cursor:'pointer', border:'1px solid', fontWeight:500,
    background: active ? `${color}14` : 'transparent',
    borderColor: active ? `${color}50` : '#1e2d4a',
    color: active ? color : '#7b8db0', transition:'all .12s',
  } as React.CSSProperties),
  modal: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.8)',
           display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
  mbox: { background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:14,
          padding:'22px 24px', width:480, maxWidth:'92vw', maxHeight:'88vh', overflowY:'auto' as const },
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ v, map }: { v:string; map:Record<string,{color:string;label:string}> }) {
  const m = map[v] || { color:'#3d4f73', label:v }
  return (
    <span style={{ fontSize:8, color:m.color, background:`${m.color}12`,
      border:`1px solid ${m.color}30`, padding:'2px 7px', borderRadius:6,
      fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' as const }}>{m.label}</span>
  )
}

// ── Sección label ─────────────────────────────────────────────────────────────
function SecLbl({ label, color='#4f8ef7' }: { label:string; color?:string }) {
  return (
    <div style={{ fontSize:8, color, fontFamily:'monospace', fontWeight:700,
      letterSpacing:1.2, marginBottom:8, marginTop:14 }}>{label}</div>
  )
}

// ── Modal crear terminal ──────────────────────────────────────────────────────
function ModalCrear({ agencias, onClose, onDone }: { agencias:any[]; onClose:()=>void; onDone:()=>void }) {
  const { crear, crearBatch } = useTerminalOps()
  const [modo,    setModo]  = useState<'uno'|'lote'>('uno')
  const [codigo,  setCod]   = useState('')
  const [modelo,  setMod]   = useState<'BOXDUAL'|'BOX SIMPLE'|'WALL'>('BOXDUAL')
  const [serie,   setSerie] = useState('')
  const [agId,    setAgId]  = useState('')
  const [obs,     setObs]   = useState('')
  // Lote
  const [prefijo, setPref]  = useState('WLLELG-E')
  const [desde,   setDesde] = useState(1)
  const [hasta,   setHasta] = useState(10)
  const [serieLote, setSerL]= useState('')
  const [saving,  setSav]   = useState(false)
  const [err,     setErr]   = useState('')
  const [ok,      setOk]    = useState(false)

  const handleUno = async () => {
    if (!codigo.trim()) { setErr('Ingresa el código'); return }
    setSav(true); setErr('')
    const res = await crear({ codigo, modelo, serie, agencia_id: agId||null, estado: agId?'ACTIVO':'NO DISPONIBLE', observacion:obs })
    setSav(false)
    if (res.ok) { setOk(true); setCod(''); setSerie(''); setObs(''); setTimeout(onDone, 1200) }
    else setErr(res.error||'Error')
  }

  const handleLote = async () => {
    const codigos = Array.from({length: hasta-desde+1}, (_,i) => `${prefijo}${String(desde+i).padStart(4,'0')}`)
    setSav(true); setErr('')
    const res = await crearBatch(codigos, modelo, serieLote||undefined)
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone, 1400) }
    else setErr(res.error||'Error')
  }

  const lotePreview = Array.from({length:Math.min(3,hasta-desde+1)}, (_,i) =>
    `${prefijo}${String(desde+i).padStart(4,'0')}`).join(', ') + (hasta-desde+1>3?'...':'')

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#e8eeff' }}>Nueva terminal</h3>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#3d4f73', cursor:'pointer', fontSize:20 }}>✕</button>
        </div>

        {/* Modo */}
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          <button onClick={()=>setModo('uno')} style={S.chip(modo==='uno','#00e5a0')}>Terminal individual</button>
          <button onClick={()=>setModo('lote')} style={S.chip(modo==='lote','#7c5cfc')}>Carga en lote</button>
        </div>

        {/* Modelo (ambos modos) */}
        <SecLbl label="MODELO" color="#7c5cfc"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:4 }}>
          {MODELOS.map(m => {
            const mc = MOD[m]
            return (
              <div key={m} onClick={()=>setMod(m)}
                style={{ padding:'10px 8px', borderRadius:9, cursor:'pointer', textAlign:'center',
                  background: modelo===m ? `${mc.color}12` : '#141d35',
                  border:`1px solid ${modelo===m ? mc.color+'45' : '#1e2d4a'}` }}>
                <div style={{ fontSize:12, fontWeight:700, color: modelo===m?mc.color:'#7b8db0', marginBottom:2 }}>{mc.short}</div>
                <div style={{ fontSize:9, color:'#3d4f73', fontFamily:'monospace' }}>{m}</div>
              </div>
            )
          })}
        </div>

        {modo==='uno' ? (<>
          <SecLbl label="DATOS DE LA TERMINAL"/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>CÓDIGO *</div>
              <input value={codigo} onChange={e=>setCod(e.target.value.toUpperCase())}
                placeholder="WLLELG-E0001" style={S.inp}/>
            </div>
            <div>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>SERIE</div>
              <input value={serie} onChange={e=>setSerie(e.target.value)}
                placeholder="Número de serie..." style={S.inp}/>
            </div>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>ASIGNAR A AGENCIA (opcional)</div>
            <select value={agId} onChange={e=>setAgId(e.target.value)} style={{ ...S.inp, appearance:'none' as any }}>
              <option value="">Sin asignar (stock disponible)</option>
              {agencias.filter(a=>a.estado==='EN PRODUCCION').map((a:any) => (
                <option key={a._id} value={a._id}>{a.subagencia} — {a.empresa}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>OBSERVACIONES</div>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
              placeholder="Notas adicionales..." style={{ ...S.inp, resize:'none' as any }}/>
          </div>
          {!ok ? (
            <button onClick={handleUno} disabled={saving}
              style={{ width:'100%', marginTop:14, padding:'11px', borderRadius:9, fontSize:13, fontWeight:700,
                background: saving?'#1e2d4a':'rgba(0,229,160,0.12)', border:`1px solid ${saving?'#1e2d4a':'rgba(0,229,160,0.4)'}`,
                color: saving?'#3d4f73':'#00e5a0', cursor:saving?'not-allowed':'pointer' }}>
              {saving?'Guardando...':'Crear terminal'}
            </button>
          ) : (
            <div style={{ marginTop:14, padding:'10px', background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.25)', borderRadius:9, textAlign:'center', fontSize:12, color:'#00e5a0' }}>
              ✓ Terminal creada correctamente
            </div>
          )}
        </>) : (<>
          <SecLbl label="CONFIGURACIÓN DE LOTE" color="#7c5cfc"/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px', gap:8, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>PREFIJO</div>
              <input value={prefijo} onChange={e=>setPref(e.target.value.toUpperCase())}
                placeholder="WLLELG-E" style={S.inp}/>
            </div>
            <div>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>DESDE #</div>
              <input type="number" value={desde} min={1} onChange={e=>setDesde(Number(e.target.value))} style={S.inp}/>
            </div>
            <div>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>HASTA #</div>
              <input type="number" value={hasta} min={desde} onChange={e=>setHasta(Number(e.target.value))} style={S.inp}/>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>SERIE BASE (opcional)</div>
            <input value={serieLote} onChange={e=>setSerL(e.target.value)}
              placeholder="SN-2025 → genera SN-2025-001, SN-2025-002..." style={S.inp}/>
          </div>
          {/* Preview */}
          <div style={{ padding:'9px 12px', background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, marginBottom:14 }}>
            <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginBottom:4 }}>PREVIEW · {hasta-desde+1} terminales</div>
            <div style={{ fontSize:10, color:'#7c5cfc', fontFamily:'monospace' }}>{lotePreview}</div>
            <div style={{ fontSize:9, color:'#3d4f73', marginTop:4 }}>Estado inicial: NO DISPONIBLE (stock)</div>
          </div>
          {!ok ? (
            <button onClick={handleLote} disabled={saving||hasta<desde}
              style={{ width:'100%', padding:'11px', borderRadius:9, fontSize:13, fontWeight:700,
                background: saving?'#1e2d4a':'rgba(124,92,252,0.12)', border:`1px solid ${saving?'#1e2d4a':'rgba(124,92,252,0.4)'}`,
                color: saving?'#3d4f73':'#7c5cfc', cursor:saving?'not-allowed':'pointer' }}>
              {saving?'Creando...':`Crear ${hasta-desde+1} terminales`}
            </button>
          ) : (
            <div style={{ padding:'10px', background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.25)', borderRadius:9, textAlign:'center', fontSize:12, color:'#00e5a0' }}>
              ✓ {hasta-desde+1} terminales creadas en stock
            </div>
          )}
        </>)}

        {err && <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(247,37,100,0.08)', border:'1px solid rgba(247,37,100,0.2)', borderRadius:8, fontSize:11, color:'#f72564' }}>{err}</div>}
      </div>
    </div>
  )
}

// ── Modal asignar / cambiar estado / dar baja ─────────────────────────────────
function ModalAccion({
  term, agencias, accion, onClose, onDone
}: {
  term:any; agencias:any[]; accion:'asignar'|'estado'|'baja'; onClose:()=>void; onDone:()=>void
}) {
  const { asignar, cambiarEstado, darBaja } = useTerminalOps()
  const [agId,    setAgId]   = useState(term.agencia_id||'')
  const [estado,  setEst]    = useState(term.estado||'NO DISPONIBLE')
  const [obs,     setObs]    = useState('')
  const [motivo,  setMot]    = useState('')
  const [saving,  setSav]    = useState(false)
  const [ok,      setOk]     = useState(false)
  const [err,     setErr]    = useState('')

  const handle = async () => {
    setSav(true); setErr('')
    let res: {ok:boolean;error?:string}
    if      (accion==='asignar') res = await asignar(term._id||term.id, agId||null)
    else if (accion==='estado')  res = await cambiarEstado(term._id||term.id, estado as any, obs)
    else                         res = await darBaja(term._id||term.id, motivo)
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone, 1200) }
    else setErr(res.error||'Error')
  }

  const titulo = accion==='asignar' ? 'Asignar agencia' : accion==='estado' ? 'Cambiar estado' : 'Dar de baja'
  const color  = accion==='baja' ? '#f72564' : accion==='asignar' ? '#00e5a0' : '#f7931a'

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{ ...S.mbox, width:420 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <div>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#e8eeff' }}>{titulo}</h3>
            <p style={{ margin:'3px 0 0', fontSize:10, color:'#7b8db0', fontFamily:'monospace' }}>{term.codigo} · {term.modelo}</p>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#3d4f73', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>

        {accion==='asignar' && (
          <>
            <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:6 }}>AGENCIA DESTINO</div>
            <select value={agId} onChange={e=>setAgId(e.target.value)} style={{ ...S.inp, appearance:'none' as any, marginBottom:10 }}>
              <option value="">Sin asignar (dejar en stock)</option>
              {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
                <option key={a._id} value={a._id||a.id}>{a.subagencia} — {a.empresa} — {a.sucursal}</option>
              ))}
            </select>
            <div style={{ padding:'8px 11px', background:'rgba(0,229,160,0.06)', border:'1px solid rgba(0,229,160,0.18)', borderRadius:8, fontSize:9, color:'#00e5a0', fontFamily:'monospace' }}>
              {agId ? 'Al asignar, el estado cambiará a ACTIVO automáticamente' : 'Sin agencia = estado NO DISPONIBLE (stock)'}
            </div>
          </>
        )}

        {accion==='estado' && (
          <>
            <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:6 }}>NUEVO ESTADO</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:12 }}>
              {ESTADOS_EDIT.map(e => {
                const em = EST[e]||{color:'#3d4f73',label:e}
                return (
                  <div key={e} onClick={()=>setEst(e)}
                    style={{ padding:'9px 11px', borderRadius:8, cursor:'pointer',
                      background: estado===e?`${em.color}12`:'#141d35',
                      border:`1px solid ${estado===e?em.color+'45':'#1e2d4a'}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:em.color }}/>
                      <span style={{ fontSize:10, fontWeight:600, color:estado===e?em.color:'#7b8db0' }}>{e}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {(estado==='EN REPARACION'||estado==='BAJA') && (
              <>
                <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:6 }}>OBSERVACIÓN</div>
                <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
                  placeholder="Motivo del cambio de estado..." style={{ ...S.inp, resize:'none' as any }}/>
              </>
            )}
            {(estado==='NO DISPONIBLE'||estado==='BAJA') && (
              <div style={{ marginTop:8, padding:'7px 10px', background:'rgba(247,37,100,0.06)', border:'1px solid rgba(247,37,100,0.18)', borderRadius:7, fontSize:9, color:'#f72564', fontFamily:'monospace' }}>
                ⚠ La agencia asignada será liberada automáticamente
              </div>
            )}
          </>
        )}

        {accion==='baja' && (
          <>
            <div style={{ padding:'10px 12px', background:'rgba(247,37,100,0.06)', border:'1px solid rgba(247,37,100,0.18)', borderRadius:8, marginBottom:12 }}>
              <p style={{ margin:0, fontSize:11, color:'#f72564', fontWeight:600 }}>Esta acción es irreversible</p>
              <p style={{ margin:'4px 0 0', fontSize:10, color:'#7b8db0' }}>La terminal quedará en estado BAJA y será desvinculada de su agencia.</p>
            </div>
            <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', marginBottom:6 }}>MOTIVO DE BAJA *</div>
            <textarea value={motivo} onChange={e=>setMot(e.target.value)} rows={3}
              placeholder="Describe el motivo de la baja..." style={{ ...S.inp, resize:'none' as any }}/>
          </>
        )}

        {err && <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(247,37,100,0.08)', border:'1px solid rgba(247,37,100,0.2)', borderRadius:8, fontSize:11, color:'#f72564' }}>{err}</div>}

        {!ok ? (
          <button onClick={handle} disabled={saving || (accion==='baja'&&!motivo.trim())}
            style={{ width:'100%', marginTop:14, padding:'11px', borderRadius:9, fontSize:13, fontWeight:700,
              background:`${color}12`, border:`1px solid ${color}40`,
              color: saving?'#3d4f73':color, cursor:saving?'not-allowed':'pointer',
              opacity: (accion==='baja'&&!motivo.trim()) ? .5 : 1 }}>
            {saving ? 'Guardando...' : titulo}
          </button>
        ) : (
          <div style={{ marginTop:14, padding:'10px', background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.25)', borderRadius:9, textAlign:'center', fontSize:12, color:'#00e5a0' }}>
            ✓ {titulo} aplicado correctamente
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Terminales() {
  const user = useAuth(s => s.user)
  const { terminales, agencias, empresas, loaded, loadAll } = useDB()
  const { stockPorModelo } = useTerminalOps()

  const rol     = user?.rol || 'TECNICO'
  const isFranq = rol === 'FRANQUICIADO'
  const isAdmin = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const miEmp   = isFranq ? (user?.empresas?.[0]||'') : ''
  const miEmpObj = empresas.find(e => e.nombre===miEmp||e._id===miEmp)
  const miEmpNombre = miEmpObj?.nombre || miEmp

  const visibles = useMemo(() =>
    isFranq ? terminales.filter(t=>t.empresa===miEmpNombre) : terminales,
  [terminales, isFranq, miEmpNombre])

  // ── Estado UI ──────────────────────────────────────────────────────────────
  const [buscar,    setBuscar]   = useState('')
  const [filtEst,   setFiltEst]  = useState('todos')
  const [filtEmp,   setFiltEmp]  = useState('todas')
  const [filtMod,   setFiltMod]  = useState('todos')
  const [pagina,    setPagina]   = useState(1)
  const [detalle,   setDetalle]  = useState<string|null>(null)
  const [modalCrear,setMCrear]   = useState(false)
  const [modalAcc,  setMAcc]     = useState<{accion:'asignar'|'estado'|'baja';term:any}|null>(null)
  const POR_PAG = 50

  // ── Recargar datos tras operación ──────────────────────────────────────────
  const reload = useCallback(async () => {
    await loadAll()
    setMAcc(null)
    setMCrear(false)
  }, [loadAll])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = visibles.length
    const activo  = visibles.filter(t=>(t.estado as string)==='ACTIVO').length
    const noDisp  = visibles.filter(t=>(t.estado as string)==='NO DISPONIBLE').length
    const boxdual = visibles.filter(t=>t.modelo==='BOXDUAL').length
    const wall    = visibles.filter(t=>t.modelo==='WALL').length
    const simple  = visibles.filter(t=>t.modelo==='BOX SIMPLE').length
    return { total, activo, noDisp, boxdual, wall, simple }
  }, [visibles])

  // Stock disponible (sin agencia asignada) — sincronizado con solicitudes
  const stock = useMemo(() => stockPorModelo(terminales), [terminales, stockPorModelo])

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = buscar.toLowerCase()
    return visibles.filter(t => {
      if (q && !t.codigo?.toLowerCase().includes(q) &&
               !t.agencia?.toLowerCase().includes(q) &&
               !t.empresa?.toLowerCase().includes(q) &&
               !t.modelo?.toLowerCase().includes(q)) return false
      if (filtEst!=='todos' && (t.estado as string)!==filtEst) return false
      if (filtEmp!=='todas' && t.empresa!==filtEmp) return false
      if (filtMod!=='todos' && t.modelo!==filtMod) return false
      return true
    })
  }, [visibles, buscar, filtEst, filtEmp, filtMod])

  const pagTotal = Math.max(1, Math.ceil(filtradas.length/POR_PAG))
  const pagItems = filtradas.slice((pagina-1)*POR_PAG, pagina*POR_PAG)
  const resetPag = () => setPagina(1)

  const termDet   = terminales.find(t=>t._id===detalle)
  const agDet     = termDet ? agencias.find(a=>a.id_sub===termDet.id_sub) : null
  const empDetIdx = termDet ? empresas.findIndex(e=>e.nombre===termDet.empresa) : 0
  const empDetCol = EMP_COLS[empDetIdx>=0?empDetIdx%EMP_COLS.length:0]
  const emps      = useMemo(()=>Array.from(new Set(visibles.map(t=>t.empresa).filter(Boolean))).sort(),[visibles])
  const empColor  = (n:string) => { const i=empresas.findIndex(e=>e.nombre===n); return EMP_COLS[i>=0?i%EMP_COLS.length:0] }

  return (
    <div style={S.page}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:19, fontWeight:700, color:'#e8eeff' }}>
            {isFranq?`Terminales · ${miEmpNombre}`:'Terminales'}
          </h1>
          <p style={{ margin:'3px 0 0', fontSize:10, color:'#7b8db0', fontFamily:'monospace' }}>
            {loaded?`${stats.total} terminales · ${stats.activo} activas · ${stats.noDisp} en stock`:'Cargando...'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={()=>setMCrear(true)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:9,
              background:'rgba(0,229,160,0.12)', border:'1px solid rgba(0,229,160,0.4)',
              color:'#00e5a0', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva terminal
          </button>
        )}
      </div>

      {/* ── STOCK BANNER (sincronizado con solicitudes) ── */}
      <div style={{ ...S.card, padding:'11px 15px', marginBottom:12, borderColor: Object.values(stock).every(v=>v===0)?'rgba(247,37,100,0.3)':'#1e2d4a' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: Object.values(stock).every(v=>v===0)?'#f72564':'#00e5a0' }}/>
            <span style={{ fontSize:10, fontWeight:600, color:'#e8eeff' }}>Stock disponible para asignación</span>
            <span style={{ fontSize:9, color:'#3d4f73', fontFamily:'monospace' }}>· sincronizado con solicitudes</span>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {[
              ['BOXDUAL','Box Dual','#7c5cfc'],
              ['BOX SIMPLE','Box Simple','#4f8ef7'],
              ['WALL','Wall','#f7931a'],
            ].map(([k,l,c])=>(
              <div key={k} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px',
                background:`${stock[k]>0?c:'#1e2d4a'}12`, border:`1px solid ${stock[k]>0?c+'35':'#1e2d4a'}`,
                borderRadius:8 }}>
                <div style={{ width:5, height:5, borderRadius:1, background:stock[k]>0?c as string:'#3d4f73' }}/>
                <span style={{ fontSize:9, color:stock[k]>0?c as string:'#3d4f73', fontFamily:'monospace' }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:800, color:stock[k]>0?c as string:'#3d4f73',
                  fontFamily:'monospace', minWidth:20, textAlign:'center' }}>{stock[k]}</span>
                {stock[k]===0 && <span style={{ fontSize:8, color:'#f72564', fontFamily:'monospace' }}>SIN STOCK</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:12 }}>
        {[
          { l:'TOTAL',    v:stats.total,   c:'#4f8ef7', s:'terminales en flota',
            ico:<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></> },
          { l:'ACTIVAS',  v:stats.activo,  c:'#00e5a0', s:`${stats.total>0?Math.round(stats.activo/stats.total*100):0}% de la flota`,
            ico:<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
          { l:'STOCK',    v:stats.noDisp,  c:'#f72564', s:'sin asignar',
            ico:<><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></> },
          { l:'BOX DUAL', v:stats.boxdual, c:'#7c5cfc', s:`${stats.simple} box simple`,
            ico:<><rect x="1" y="4" width="9" height="16" rx="1"/><rect x="14" y="4" width="9" height="16" rx="1"/></> },
          { l:'WALL',     v:stats.wall,    c:'#f7931a', s:'montaje en pared',
            ico:<><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></> },
        ].map((k,i)=>(
          <div key={i} style={{ ...S.card, padding:'13px 15px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:7 }}>
              <span style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1.5 }}>{k.l}</span>
              <div style={{ width:26, height:26, borderRadius:7, background:`${k.c}15`, border:`1px solid ${k.c}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={k.c} strokeWidth="2" strokeLinecap="round">{k.ico}</svg>
              </div>
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:k.c, lineHeight:1, marginBottom:4 }}>{loaded?k.v:'—'}</div>
            <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* ── BARRA MODELOS ── */}
      <div style={{ ...S.card, padding:'11px 15px', marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
          <span style={{ fontSize:9, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1 }}>DISTRIBUCIÓN POR MODELO</span>
          <div style={{ display:'flex', gap:10 }}>
            {[['BOX DUAL','#7c5cfc',stats.boxdual],['WALL','#f7931a',stats.wall],['BOX SIMPLE','#4f8ef7',stats.simple]].map(([l,c,v])=>(
              <div key={l as string} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:6, height:6, borderRadius:1, background:c as string }}/>
                <span style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace' }}>{l as string} {loaded?v:0}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height:12, background:'#1e2d4a', borderRadius:6, overflow:'hidden', display:'flex' }}>
          {loaded && stats.total>0 && [
            { w:stats.boxdual/stats.total*100, c:'#7c5cfc', l:`DUAL ${stats.boxdual}` },
            { w:stats.wall/stats.total*100,    c:'#f7931a', l:`WALL ${stats.wall}` },
            { w:stats.simple/stats.total*100,  c:'#4f8ef7', l:`SIMPLE ${stats.simple}` },
          ].map((seg,i)=>seg.w>0&&(
            <div key={i} style={{ width:`${seg.w}%`, background:seg.c, display:'flex', alignItems:'center', justifyContent:'center', transition:'width .5s' }}>
              {seg.w>8&&<span style={{ fontSize:8, color:'#fff', fontFamily:'monospace', fontWeight:700 }}>{seg.l}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── LISTA + DETALLE ── */}
      <div style={{ display:'grid', gridTemplateColumns:detalle?'1fr 370px':'1fr', gap:14 }}>

        {/* Lista */}
        <div style={{ ...S.card, padding:'15px 17px' }}>
          {/* Filtros */}
          <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:180, position:'relative' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3d4f73" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={buscar} onChange={e=>{setBuscar(e.target.value);resetPag()}}
                placeholder="Buscar código, agencia, empresa, modelo..."
                style={{ ...S.inp, paddingLeft:30 }}/>
            </div>
            {!isFranq&&(
              <select value={filtEmp} onChange={e=>{setFiltEmp(e.target.value);resetPag()}}
                style={{ ...S.inp, width:'auto', appearance:'none' as any }}>
                <option value="todas">Todas las empresas</option>
                {emps.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            )}
          </div>
          <div style={{ display:'flex', gap:5, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginRight:2 }}>ESTADO:</span>
            {[['todos','Todas','#4f8ef7'],['ACTIVO','Activas','#00e5a0'],['NO DISPONIBLE','Stock','#f72564'],['EN REPARACION','Reparación','#f7931a'],['BAJA','Baja','#3d4f73']].map(([v,l,c])=>(
              <button key={v} onClick={()=>{setFiltEst(v);resetPag()}} style={S.chip(filtEst===v,c)}>{l as string}</button>
            ))}
            <div style={{ width:1, height:18, background:'#1e2d4a', margin:'0 4px' }}/>
            <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginRight:2 }}>MODELO:</span>
            {[['todos','Todos','#7b8db0'],['BOXDUAL','Dual','#7c5cfc'],['WALL','Wall','#f7931a'],['BOX SIMPLE','Simple','#4f8ef7']].map(([v,l,c])=>(
              <button key={v} onClick={()=>{setFiltMod(v);resetPag()}} style={S.chip(filtMod===v,c)}>{l as string}</button>
            ))}
          </div>

          {!loaded ? (
            <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'40px 0' }}>Cargando terminales...</p>
          ) : filtradas.length===0 ? (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace' }}>Sin resultados · ajusta los filtros</p>
              <button onClick={()=>{setBuscar('');setFiltEst('todos');setFiltEmp('todas');setFiltMod('todos');resetPag()}}
                style={{ marginTop:8, padding:'5px 14px', borderRadius:7, background:'transparent', border:'1px solid #1e2d4a', color:'#7b8db0', fontSize:10, cursor:'pointer' }}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 1.2fr 90px 80px 28px', gap:8, padding:'4px 10px 7px', borderBottom:'1px solid #1e2d4a', marginBottom:4 }}>
                {['CÓDIGO','AGENCIA','EMPRESA','MODELO','ESTADO',''].map((h,i)=>(
                  <span key={i} style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', letterSpacing:1.2 }}>{h}</span>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:detalle?'calc(100vh - 460px)':'calc(100vh - 420px)', overflowY:'auto', paddingRight:2 }}>
                {pagItems.map(t=>{
                  const em=EST[t.estado as string]||{color:'#3d4f73',label:t.estado}
                  const mo=MOD[t.modelo]||{color:'#3d4f73',short:t.modelo}
                  const ec=empColor(t.empresa)
                  const isSel=detalle===t._id
                  return (
                    <div key={t._id} onClick={()=>setDetalle(isSel?null:(t._id||''))}
                      style={{ display:'grid', gridTemplateColumns:'140px 1fr 1.2fr 90px 80px 28px', gap:8,
                        padding:'8px 10px', borderRadius:8, cursor:'pointer', transition:'all .1s',
                        background:isSel?`${ec}08`:'#141d35', border:`1px solid ${isSel?ec+'45':'#1e2d4a'}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:5, height:5, borderRadius:'50%', background:em.color, flexShrink:0 }}/>
                        <span style={{ fontSize:10, fontWeight:700, color:'#e8eeff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.codigo}</span>
                      </div>
                      <span style={{ fontSize:10, color:t.agencia?'#7b8db0':'#3d4f73', alignSelf:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontStyle:t.agencia?'normal':'italic' }}>{t.agencia||'Sin agencia'}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:5, height:5, borderRadius:1, background:ec, flexShrink:0 }}/>
                        <span style={{ fontSize:10, color:t.empresa?'#7b8db0':'#3d4f73', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontStyle:t.empresa?'normal':'italic' }}>{t.empresa||'—'}</span>
                      </div>
                      <span style={{ fontSize:8, color:mo.color, background:`${mo.color}12`, border:`1px solid ${mo.color}30`, padding:'2px 7px', borderRadius:6, fontFamily:'monospace', alignSelf:'center', textAlign:'center' }}>{mo.short}</span>
                      <span style={{ fontSize:8, color:em.color, background:`${em.color}12`, border:`1px solid ${em.color}30`, padding:'2px 6px', borderRadius:6, fontFamily:'monospace', alignSelf:'center', textAlign:'center' }}>{em.label}</span>
                      <span style={{ color:'#4f8ef7', alignSelf:'center', textAlign:'right', fontSize:13, display:'inline-block', transition:'transform .15s', transform:isSel?'rotate(90deg)':'rotate(0)' }}>›</span>
                    </div>
                  )
                })}
              </div>
              {/* Paginación */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:9, borderTop:'1px solid #1e2d4a' }}>
                <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>{filtradas.length} resultado{filtradas.length!==1?'s':''} · pág {pagina}/{pagTotal} · {POR_PAG}/pág</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={()=>setPagina(1)} disabled={pagina===1} style={{ ...S.chip(false), padding:'3px 8px', opacity:pagina===1?.4:1 }}>«</button>
                  <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1} style={{ ...S.chip(false), opacity:pagina===1?.4:1 }}>‹ Ant</button>
                  {Array.from({length:Math.min(5,pagTotal)},(_,i)=>{
                    let p=pagina<=3?i+1:pagTotal-pagina<2?pagTotal-4+i:pagina-2+i
                    if(p<1||p>pagTotal) return null
                    return <button key={p} onClick={()=>setPagina(p)} style={S.chip(p===pagina,'#4f8ef7')}>{p}</button>
                  })}
                  <button onClick={()=>setPagina(p=>Math.min(pagTotal,p+1))} disabled={pagina===pagTotal} style={{ ...S.chip(false), opacity:pagina===pagTotal?.4:1 }}>Sig ›</button>
                  <button onClick={()=>setPagina(pagTotal)} disabled={pagina===pagTotal} style={{ ...S.chip(false), padding:'3px 8px', opacity:pagina===pagTotal?.4:1 }}>»</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Panel detalle */}
        {detalle && termDet && (
          <div style={{ ...S.card, borderColor:`${empDetCol}30`, padding:'16px 18px', position:'sticky', top:20, alignSelf:'start', maxHeight:'calc(100vh - 60px)', overflowY:'auto' as const }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div style={{ display:'flex', gap:11, alignItems:'center' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${empDetCol}15`, border:`1px solid ${empDetCol}35`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={empDetCol} strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:8, color:empDetCol, fontFamily:'monospace', fontWeight:600, marginBottom:2 }}>{termDet.empresa||'Sin empresa'}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#e8eeff', fontFamily:'monospace', lineHeight:1 }}>{termDet.codigo}</div>
                </div>
              </div>
              <button onClick={()=>setDetalle(null)} style={{ background:'transparent', border:'none', color:'#3d4f73', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {termDet.modelo && <Badge v={termDet.modelo} map={MOD as any}/>}
              <Badge v={termDet.estado as string} map={EST}/>
            </div>

            <SecLbl label="DATOS DE LA TERMINAL" color="#4f8ef7"/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:12 }}>
              {[
                { l:'CÓDIGO', v:termDet.codigo, mono:true },
                { l:'MODELO', v:termDet.modelo, mono:true },
                { l:'SERIE',  v:termDet.serie||'—', mono:true },
                { l:'EMPRESA',v:termDet.empresa||'—', color:empDetCol },
              ].map((f,i)=>(
                <div key={i} style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 11px' }}>
                  <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>{f.l}</div>
                  <div style={{ fontSize:11, color:f.color||'#e8eeff', fontFamily:f.mono?'monospace':'system-ui', fontWeight:f.mono?700:400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{f.v}</div>
                </div>
              ))}
            </div>
            {termDet.observacion && (
              <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 11px', marginBottom:12 }}>
                <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:3 }}>OBSERVACIÓN</div>
                <div style={{ fontSize:10, color:'#7b8db0', lineHeight:1.5 }}>{termDet.observacion}</div>
              </div>
            )}

            <SecLbl label="AGENCIA ASIGNADA" color="#7c5cfc"/>
            {agDet ? (
              <div style={{ background:'rgba(124,92,252,0.05)', border:'1px solid rgba(124,92,252,0.18)', borderRadius:9, padding:'11px 13px', marginBottom:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom: agDet.correo||agDet.direccion ? 8 : 0 }}>
                  {[{l:'LOCAL',v:agDet.subagencia},{l:'DPTO.',v:agDet.sucursal},{l:'ENCARGADO',v:agDet.encargado||'—'},{l:'ESTADO',v:agDet.estado}].map((f,i)=>(
                    <div key={i}>
                      <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:1 }}>{f.l}</div>
                      <div style={{ fontSize:10, color:'#e8eeff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{f.v||'—'}</div>
                    </div>
                  ))}
                </div>
                {agDet.correo&&<div style={{ paddingTop:7, borderTop:'1px solid rgba(124,92,252,0.15)' }}><div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:1 }}>CORREO</div><div style={{ fontSize:10, color:'#4f8ef7' }}>{agDet.correo}</div></div>}
                {agDet.direccion&&<div style={{ marginTop:6 }}><div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:1 }}>DIRECCIÓN</div><div style={{ fontSize:10, color:'#7b8db0', lineHeight:1.4 }}>{agDet.direccion}</div></div>}
              </div>
            ) : (
              <div style={{ background:'rgba(247,37,100,0.05)', border:'1px solid rgba(247,37,100,0.15)', borderRadius:9, padding:'10px 13px', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#f72564', flexShrink:0 }}/>
                  <span style={{ fontSize:10, color:'#f72564', fontFamily:'monospace' }}>En stock · sin agencia asignada</span>
                </div>
                <p style={{ fontSize:9, color:'#3d4f73', margin:'4px 0 0', fontFamily:'monospace' }}>Disponible para asignación o solicitudes</p>
              </div>
            )}

            {/* Acciones admin */}
            {isAdmin && (
              <>
                <SecLbl label="ACCIONES" color="#7b8db0"/>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={()=>setMAcc({accion:'asignar',term:termDet})}
                    style={{ padding:'9px', borderRadius:8, background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.25)', color:'#00e5a0', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                    {agDet?'Reasignar agencia':'Asignar a agencia'}
                  </button>
                  <button onClick={()=>setMAcc({accion:'estado',term:termDet})}
                    style={{ padding:'9px', borderRadius:8, background:'rgba(247,147,26,0.08)', border:'1px solid rgba(247,147,26,0.25)', color:'#f7931a', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    Cambiar estado
                  </button>
                  {termDet.estado!=='BAJA'&&(
                    <button onClick={()=>setMAcc({accion:'baja',term:termDet})}
                      style={{ padding:'9px', borderRadius:8, background:'rgba(247,37,100,0.06)', border:'1px solid rgba(247,37,100,0.18)', color:'#f72564', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      Dar de baja
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── MODALES ── */}
      {modalCrear && <ModalCrear agencias={agencias} onClose={()=>setMCrear(false)} onDone={reload}/>}
      {modalAcc   && <ModalAccion term={modalAcc.term} agencias={agencias} accion={modalAcc.accion} onClose={()=>setMAcc(null)} onDone={reload}/>}
    </div>
  )
}
