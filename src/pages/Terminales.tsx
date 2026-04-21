import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useTerminalOps } from '../store/terminalOps'

// ── Constantes ────────────────────────────────────────────────────────────────
const EMP_COLS = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']
const EST: Record<string,{color:string;label:string;desc:string}> = {
  'DISPONIBLE':    { color:'#00e5a0', label:'STOCK',   desc:'En stock, lista para asignar'        },
  'ASIGNADA':      { color:'#4f8ef7', label:'ASIGNAD', desc:'Asignada, agencia no activa aún'     },
  'ACTIVO':        { color:'#7c5cfc', label:'ACTIVO',  desc:'En producción, agencia activa'       },
  'NO DISPONIBLE': { color:'#f72564', label:'NO DISP', desc:'Creada pero deshabilitada'           },
  'EN REPARACION': { color:'#f7931a', label:'REPARA',  desc:'Fuera de servicio temporal'          },
  'BAJA':          { color:'#3d4f73', label:'BAJA',    desc:'Dada de baja definitivamente'        },
}
const MOD: Record<string,{color:string;short:string}> = {
  'BOXDUAL':    { color:'#7c5cfc', short:'DUAL'   },
  'BOX SIMPLE': { color:'#4f8ef7', short:'SIMPLE' },
  'WALL':       { color:'#f7931a', short:'WALL'   },
}
const MODELOS    = ['BOXDUAL','BOX SIMPLE','WALL'] as const
const TODOS_EST  = ['DISPONIBLE','ASIGNADA','ACTIVO','NO DISPONIBLE','EN REPARACION','BAJA'] as const

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = {
  page: { padding:'20px 24px', background:'#0a0e1a', minHeight:'100vh' } as React.CSSProperties,
  card: { background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:12 } as React.CSSProperties,
  inp:  { background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8,
          padding:'8px 12px', fontSize:12, color:'#e8eeff', outline:'none',
          fontFamily:'system-ui', width:'100%' } as React.CSSProperties,
  chip: (on:boolean, c='#4f8ef7') => ({
    padding:'3px 11px', borderRadius:7, fontSize:9, fontFamily:'monospace',
    cursor:'pointer', border:'1px solid', fontWeight:500, transition:'all .12s',
    background: on?`${c}14`:'transparent', borderColor:on?`${c}50`:'#1e2d4a', color:on?c:'#7b8db0',
  } as React.CSSProperties),
  modal: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.82)',
           display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
  mbox: (w=480) => ({ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:14,
    padding:'22px 24px', width:w, maxWidth:'93vw', maxHeight:'90vh', overflowY:'auto' as const }),
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const Lbl = ({t}:{t:string}) => (
  <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.2,marginBottom:5,marginTop:10}}>{t}</div>
)
function Badge({v,map}:{v:string;map:typeof EST|typeof MOD}){
  const m = (map as any)[v]||{color:'#3d4f73',label:v}
  return <span style={{fontSize:8,color:m.color,background:`${m.color}12`,border:`1px solid ${m.color}30`,
    padding:'2px 7px',borderRadius:6,fontFamily:'monospace',fontWeight:600,whiteSpace:'nowrap' as const}}>{m.label}</span>
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV(rows: any[], filename: string) {
  const headers = ['Código','Modelo','Serie','Estado','Empresa','Agencia','Departamento','Observación']
  const lines   = rows.map(t => [
    t.codigo, t.modelo, t.serie||'', t.estado,
    t.empresa||'', t.agencia||'', t.sucursal||'', t.observacion||''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
  const csv  = [headers.join(','), ...lines].join('\n')
  const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Modal: Nueva Terminal ─────────────────────────────────────────────────────
function ModalNueva({ agencias, onClose, onDone }:{ agencias:any[]; onClose:()=>void; onDone:()=>void }) {
  const { crear, crearBatch } = useTerminalOps()
  const [modo,   setModo]  = useState<'uno'|'lote'>('uno')
  const [codigo, setCod]   = useState('')
  const [modelo, setMod]   = useState<typeof MODELOS[number]>('BOXDUAL')
  const [serie,  setSerie] = useState('')
  const [agId,   setAgId]  = useState('')
  const [obs,    setObs]   = useState('')
  const [pref,   setPref]  = useState('WLLELG-E')
  const [desde,  setDesde] = useState(1)
  const [hasta,  setHasta] = useState(10)
  const [serL,   setSerL]  = useState('')
  const [saving, setSav]   = useState(false)
  const [err,    setErr]   = useState('')
  const [ok,     setOk]    = useState(false)

  const handleUno = async () => {
    if (!codigo.trim()) { setErr('Ingresa el código'); return }
    setSav(true); setErr('')
    const res = await crear({ codigo, modelo, serie, agencia_id:agId||null, estado:agId?'ASIGNADA':'DISPONIBLE', observacion:obs })
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone,1200) } else setErr(res.error||'Error')
  }
  const handleLote = async () => {
    const codigos = Array.from({length:hasta-desde+1},(_,i)=>`${pref}${String(desde+i).padStart(4,'0')}`)
    setSav(true); setErr('')
    const res = await crearBatch(codigos, modelo, serL||undefined)
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone,1400) } else setErr(res.error||'Error')
  }
  const preview = Array.from({length:Math.min(3,hasta-desde+1)},(_,i)=>`${pref}${String(desde+i).padStart(4,'0')}`).join(', ')+(hasta-desde+1>3?'...':'')

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(500)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:700,color:'#e8eeff'}}>Nueva terminal</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:20}}>✕</button>
        </div>

        {/* Modo */}
        <div style={{display:'flex',gap:6,marginBottom:14}}>
          <button onClick={()=>setModo('uno')} style={S.chip(modo==='uno','#00e5a0')}>Individual</button>
          <button onClick={()=>setModo('lote')} style={S.chip(modo==='lote','#7c5cfc')}>Carga en lote</button>
        </div>

        {/* Modelo */}
        <Lbl t="MODELO"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginBottom:6}}>
          {MODELOS.map(m=>{const mc=MOD[m];return(
            <div key={m} onClick={()=>setMod(m)} style={{padding:'10px 8px',borderRadius:9,cursor:'pointer',textAlign:'center',
              background:modelo===m?`${mc.color}12`:'#141d35',border:`1px solid ${modelo===m?mc.color+'45':'#1e2d4a'}`}}>
              <div style={{fontSize:12,fontWeight:700,color:modelo===m?mc.color:'#7b8db0',marginBottom:2}}>{mc.short}</div>
              <div style={{fontSize:9,color:'#3d4f73',fontFamily:'monospace'}}>{m}</div>
            </div>
          )})}
        </div>

        {modo==='uno'?(<>
          <Lbl t="CÓDIGO *"/>
          <input value={codigo} onChange={e=>setCod(e.target.value.toUpperCase())} placeholder="WLLELG-E0246" style={S.inp}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div><Lbl t="SERIE"/><input value={serie} onChange={e=>setSerie(e.target.value)} placeholder="Número de serie" style={S.inp}/></div>
            <div>
              <Lbl t="ASIGNAR A AGENCIA"/>
              <select value={agId} onChange={e=>setAgId(e.target.value)} style={{...S.inp,appearance:'none' as any}}>
                <option value="">Sin asignar (DISPONIBLE)</option>
                {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
                  <option key={a._id} value={a._id||a.id}>{a.subagencia} — {a.empresa}</option>
                ))}
              </select>
            </div>
          </div>
          <Lbl t="OBSERVACIONES"/>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
            placeholder="Notas adicionales..." style={{...S.inp,resize:'none' as any}}/>
        </>):(<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 80px 80px',gap:8}}>
            <div><Lbl t="PREFIJO"/><input value={pref} onChange={e=>setPref(e.target.value.toUpperCase())} style={S.inp}/></div>
            <div><Lbl t="DESDE"/><input type="number" value={desde} min={1} onChange={e=>setDesde(Number(e.target.value))} style={S.inp}/></div>
            <div><Lbl t="HASTA"/><input type="number" value={hasta} min={desde} onChange={e=>setHasta(Number(e.target.value))} style={S.inp}/></div>
          </div>
          <Lbl t="SERIE BASE (opcional)"/>
          <input value={serL} onChange={e=>setSerL(e.target.value)} placeholder="SN-2025 → SN-2025-001..." style={S.inp}/>
          <div style={{marginTop:10,padding:'9px 12px',background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8}}>
            <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginBottom:3}}>PREVIEW · {hasta-desde+1} terminales · estado inicial: DISPONIBLE</div>
            <div style={{fontSize:10,color:'#7c5cfc',fontFamily:'monospace'}}>{preview}</div>
          </div>
        </>)}

        {err && <div style={{marginTop:10,padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564'}}>{err}</div>}
        {ok
          ? <div style={{marginTop:14,padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ {modo==='lote'?`${hasta-desde+1} terminales creadas`:'Terminal creada'}</div>
          : <button onClick={modo==='uno'?handleUno:handleLote} disabled={saving}
              style={{width:'100%',marginTop:14,padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:saving?'#1e2d4a':'rgba(0,229,160,0.12)',border:`1px solid ${saving?'#1e2d4a':'rgba(0,229,160,0.4)'}`,color:saving?'#3d4f73':'#00e5a0'}}>
              {saving?'Guardando...':modo==='lote'?`Crear ${hasta-desde+1} terminales`:'Crear terminal'}
            </button>}
      </div>
    </div>
  )
}

// ── Modal: Cambiar Estado ─────────────────────────────────────────────────────
function ModalEstado({ term, onClose, onDone }:{ term:any; onClose:()=>void; onDone:()=>void }) {
  const { cambiarEstado } = useTerminalOps()
  const [estado, setEst] = useState(term.estado||'DISPONIBLE')
  const [obs,    setObs] = useState('')
  const [saving, setSav] = useState(false)
  const [err,    setErr] = useState('')
  const [ok,     setOk]  = useState(false)

  const handle = async () => {
    setSav(true); setErr('')
    const res = await cambiarEstado(term._id||term.id, estado as any, obs)
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone,1200) } else setErr(res.error||'Error')
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(460)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>Cambiar estado</h3>
            <p style={{margin:'3px 0 0',fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>{term.codigo} · {term.modelo}</p>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
        </div>

        <Lbl t="NUEVO ESTADO"/>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
          {TODOS_EST.map(e=>{
            const em = EST[e]
            return (
              <div key={e} onClick={()=>setEst(e)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',borderRadius:9,cursor:'pointer',
                  background:estado===e?`${em.color}10`:'#141d35',border:`1px solid ${estado===e?em.color+'45':'#1e2d4a'}`}}>
                <div style={{width:9,height:9,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:600,color:estado===e?em.color:'#e8eeff'}}>{e}</div>
                  <div style={{fontSize:9,color:'#3d4f73',fontFamily:'monospace'}}>{em.desc}</div>
                </div>
                {estado===e && <div style={{width:7,height:7,borderRadius:'50%',background:em.color}}/>}
              </div>
            )
          })}
        </div>

        {['EN REPARACION','BAJA','NO DISPONIBLE'].includes(estado) && (<>
          <Lbl t="OBSERVACIÓN / MOTIVO"/>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3}
            placeholder="Describe el motivo del cambio..." style={{...S.inp,resize:'none' as any,marginBottom:10}}/>
        </>)}

        {['DISPONIBLE','NO DISPONIBLE','BAJA'].includes(estado) && (
          <div style={{padding:'7px 11px',background:'rgba(247,147,26,0.06)',border:'1px solid rgba(247,147,26,0.2)',borderRadius:8,fontSize:9,color:'#f7931a',fontFamily:'monospace',marginBottom:10}}>
            ⚠ La agencia asignada será liberada automáticamente
          </div>
        )}
        {estado==='BAJA' && (
          <div style={{padding:'7px 11px',background:'rgba(247,37,100,0.06)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:9,color:'#f72564',marginBottom:10}}>
            Esta acción es irreversible.
          </div>
        )}

        {err && <div style={{marginTop:8,padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564'}}>{err}</div>}
        {ok
          ? <div style={{marginTop:12,padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ Estado actualizado correctamente</div>
          : <button onClick={handle} disabled={saving}
              style={{width:'100%',marginTop:12,padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:`${EST[estado]?.color||'#4f8ef7'}12`,border:`1px solid ${EST[estado]?.color||'#4f8ef7'}40`,
                color:saving?'#3d4f73':EST[estado]?.color||'#4f8ef7'}}>
              {saving?'Guardando...':'Confirmar cambio'}
            </button>}
      </div>
    </div>
  )
}

// ── Modal: Asignar Agencia ────────────────────────────────────────────────────
function ModalAsignar({ term, agencias, onClose, onDone }:{ term:any; agencias:any[]; onClose:()=>void; onDone:()=>void }) {
  const { asignar } = useTerminalOps()
  const [agId,   setAgId] = useState(term.agencia_id||'')
  const [saving, setSav]  = useState(false)
  const [err,    setErr]  = useState('')
  const [ok,     setOk]   = useState(false)

  const handle = async () => {
    setSav(true); setErr('')
    const res = await asignar(term._id||term.id, agId||null)
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone,1200) } else setErr(res.error||'Error')
  }
  const agSel = agencias.find((a:any)=>a._id===agId||String(a.id)===agId)

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(440)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>Asignar agencia</h3>
            <p style={{margin:'3px 0 0',fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>{term.codigo} · {term.modelo}</p>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
        </div>

        <Lbl t="AGENCIA DESTINO"/>
        <select value={agId} onChange={e=>setAgId(e.target.value)}
          style={{...S.inp,appearance:'none' as any,marginBottom:10}}>
          <option value="">Sin asignar (vuelve a DISPONIBLE)</option>
          {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
            <option key={a._id||a.id} value={a._id||a.id}>{a.subagencia} — {a.empresa} — {a.sucursal}</option>
          ))}
        </select>

        {/* Info agencia seleccionada */}
        {agSel && (
          <div style={{padding:'10px 13px',background:'rgba(79,142,247,0.06)',border:'1px solid rgba(79,142,247,0.2)',borderRadius:9,marginBottom:12}}>
            <div style={{fontSize:9,color:'#4f8ef7',fontFamily:'monospace',fontWeight:600,marginBottom:6}}>AGENCIA SELECCIONADA</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[{l:'Local',v:agSel.subagencia},{l:'Empresa',v:agSel.empresa},{l:'Dpto.',v:agSel.sucursal},{l:'Estado',v:agSel.estado}].map((f,i)=>(
                <div key={i}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>{f.l}</div><div style={{fontSize:10,color:'#e8eeff'}}>{f.v||'—'}</div></div>
              ))}
            </div>
          </div>
        )}

        <div style={{padding:'8px 11px',background:agId?'rgba(79,142,247,0.06)':'rgba(0,229,160,0.06)',
          border:`1px solid ${agId?'rgba(79,142,247,0.2)':'rgba(0,229,160,0.2)'}`,borderRadius:8,fontSize:9,
          color:agId?'#4f8ef7':'#00e5a0',fontFamily:'monospace',marginBottom:14}}>
          {agId?'Estado resultante: ASIGNADA (activo cuando la agencia esté en producción)':'Sin agencia = estado DISPONIBLE (vuelve a stock)'}
        </div>

        {err && <div style={{padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564',marginBottom:10}}>{err}</div>}
        {ok
          ? <div style={{padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ Asignación aplicada</div>
          : <button onClick={handle} disabled={saving}
              style={{width:'100%',padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:'rgba(0,229,160,0.12)',border:'1px solid rgba(0,229,160,0.4)',color:saving?'#3d4f73':'#00e5a0'}}>
              {saving?'Guardando...':agId?'Asignar agencia':'Desasignar (a stock)'}
            </button>}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Terminales() {
  const user = useAuth(s => s.user)
  const { terminales, agencias, empresas, loaded, loadAll } = useDB()
  const { stockPorModelo } = useTerminalOps()

  const rol        = user?.rol||'TECNICO'
  const isFranq    = rol==='FRANQUICIADO'
  const isAdmin    = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const miEmpNombre = isFranq ? (empresas.find(e=>e.nombre===user?.empresas?.[0]||e._id===user?.empresas?.[0])?.nombre||user?.empresas?.[0]||'') : ''

  const visibles = useMemo(()=>isFranq?terminales.filter(t=>t.empresa===miEmpNombre):terminales,[terminales,isFranq,miEmpNombre])

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [buscar,   setBuscar]  = useState('')
  const [filtEst,  setFiltEst] = useState('todos')
  const [filtEmp,  setFiltEmp] = useState('todas')
  const [filtAg,   setFiltAg]  = useState('todas')
  const [filtMod,  setFiltMod] = useState('todos')
  const [pagina,   setPagina]  = useState(1)
  const [detalle,  setDetalle] = useState<string|null>(null)
  const [mNueva,   setMNueva]  = useState(false)
  const [mEstado,  setMEstado] = useState<any|null>(null)
  const [mAsignar, setMAsig]   = useState<any|null>(null)
  const POR_PAG = 50

  const reload = useCallback(async()=>{ await loadAll(); setMNueva(false); setMEstado(null); setMAsig(null) },[loadAll])

  const emps = useMemo(()=>Array.from(new Set(visibles.map(t=>t.empresa).filter(Boolean))).sort(),[visibles])
  const ags  = useMemo(()=>Array.from(new Set(visibles.map(t=>t.agencia).filter(Boolean))).sort(),[visibles])

  const filtradas = useMemo(()=>{
    const q = buscar.toLowerCase()
    return visibles.filter(t=>{
      if(q && !t.codigo?.toLowerCase().includes(q) && !t.agencia?.toLowerCase().includes(q) &&
               !t.empresa?.toLowerCase().includes(q) && !t.modelo?.toLowerCase().includes(q)) return false
      if(filtEst!=='todos' && (t.estado as string)!==filtEst) return false
      if(filtEmp!=='todas' && t.empresa!==filtEmp) return false
      if(filtAg !=='todas' && t.agencia!==filtAg)  return false
      if(filtMod!=='todos' && t.modelo!==filtMod)  return false
      return true
    })
  },[visibles,buscar,filtEst,filtEmp,filtAg,filtMod])

  const pagTotal = Math.max(1,Math.ceil(filtradas.length/POR_PAG))
  const pagItems = filtradas.slice((pagina-1)*POR_PAG,pagina*POR_PAG)
  const resetPag = ()=>setPagina(1)

  const stats = useMemo(()=>({
    total:   visibles.length,
    activo:  visibles.filter(t=>(t.estado as string)==='ACTIVO').length,
    asig:    visibles.filter(t=>(t.estado as string)==='ASIGNADA').length,
    disp:    visibles.filter(t=>(t.estado as string)==='DISPONIBLE').length,
    noDisp:  visibles.filter(t=>(t.estado as string)==='NO DISPONIBLE').length,
    boxdual: visibles.filter(t=>t.modelo==='BOXDUAL').length,
    wall:    visibles.filter(t=>t.modelo==='WALL').length,
    simple:  visibles.filter(t=>t.modelo==='BOX SIMPLE').length,
  }),[visibles])

  const stock    = useMemo(()=>stockPorModelo(terminales),[terminales,stockPorModelo])
  const empColor = (n:string)=>{ const i=empresas.findIndex(e=>e.nombre===n); return EMP_COLS[i>=0?i%EMP_COLS.length:0] }

  const termDet   = terminales.find(t=>t._id===detalle)
  const agDet     = termDet?agencias.find(a=>a.id_sub===termDet.id_sub):null
  const empDetIdx = termDet?empresas.findIndex(e=>e.nombre===termDet.empresa):0
  const empDetCol = EMP_COLS[empDetIdx>=0?empDetIdx%EMP_COLS.length:0]

  // ── Exportar ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const ts = new Date().toISOString().slice(0,10)
    const filename = `terminales_${filtEst!=='todos'?filtEst+'_':''}${filtEmp!=='todas'?filtEmp+'_':''}${ts}.csv`
    exportCSV(filtradas, filename)
  }

  return (
    <div style={S.page}>

      {/* HEADER */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h1 style={{margin:0,fontSize:19,fontWeight:700,color:'#e8eeff'}}>{isFranq?`Terminales · ${miEmpNombre}`:'Terminales'}</h1>
          <p style={{margin:'3px 0 0',fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>
            {loaded?`${stats.total} terminales · ${stats.activo} activas · ${stats.disp} en stock · ${stats.noDisp} no disponibles`:'Cargando...'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={()=>setMNueva(true)}
            style={{display:'flex',alignItems:'center',gap:8,padding:'9px 18px',borderRadius:9,
              background:'rgba(0,229,160,0.12)',border:'1px solid rgba(0,229,160,0.4)',
              color:'#00e5a0',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva terminal
          </button>
        )}
      </div>

      {/* STOCK BANNER */}
      <div style={{...S.card,padding:'11px 15px',marginBottom:12,borderColor:Object.values(stock).some(v=>v>0)?'#1e2d4a':'rgba(247,37,100,0.25)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:Object.values(stock).some(v=>v>0)?'#00e5a0':'#f72564'}}/>
            <span style={{fontSize:10,fontWeight:600,color:'#e8eeff'}}>Stock disponible</span>
            <span style={{fontSize:9,color:'#3d4f73',fontFamily:'monospace'}}>· terminales DISPONIBLES para asignar</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            {[['BOXDUAL','Box Dual','#7c5cfc'],['BOX SIMPLE','Box Simple','#4f8ef7'],['WALL','Wall','#f7931a']].map(([k,l,c])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',
                background:`${stock[k]>0?c:'#f72564'}12`,border:`1px solid ${stock[k]>0?c+'35':'rgba(247,37,100,0.25)'}`,borderRadius:8}}>
                <div style={{width:5,height:5,borderRadius:1,background:stock[k]>0?c as string:'#f72564'}}/>
                <span style={{fontSize:9,color:stock[k]>0?c as string:'#f72564',fontFamily:'monospace'}}>{l as string}</span>
                <span style={{fontSize:13,fontWeight:800,color:stock[k]>0?c as string:'#f72564',fontFamily:'monospace',minWidth:20,textAlign:'center'}}>{stock[k]}</span>
                {stock[k]===0&&<span style={{fontSize:7,color:'#f72564',fontFamily:'monospace'}}>SIN STOCK</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:12}}>
        {[
          {l:'TOTAL',     v:stats.total,   c:'#4f8ef7', s:'terminales en flota',
            ico:<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>},
          {l:'EN PROD.',  v:stats.activo,  c:'#7c5cfc', s:'agencias activas',
            ico:<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>},
          {l:'ASIGNADAS', v:stats.asig,    c:'#4f8ef7', s:'empresa asignada',
            ico:<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>},
          {l:'STOCK',     v:stats.disp,    c:'#00e5a0', s:'disponibles para asignar',
            ico:<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>},
          {l:'NO DISP.',  v:stats.noDisp,  c:'#f72564', s:'deshabilitadas',
            ico:<><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>},
        ].map((k,i)=>(
          <div key={i} style={{...S.card,padding:'13px 15px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:7}}>
              <span style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.5}}>{k.l}</span>
              <div style={{width:26,height:26,borderRadius:7,background:`${k.c}15`,border:`1px solid ${k.c}30`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={k.c} strokeWidth="2" strokeLinecap="round">{k.ico}</svg>
              </div>
            </div>
            <div style={{fontSize:28,fontWeight:800,color:k.c,lineHeight:1,marginBottom:4}}>{loaded?k.v:'—'}</div>
            <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* BARRA MODELOS */}
      <div style={{...S.card,padding:'11px 15px',marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
          <span style={{fontSize:9,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1}}>DISTRIBUCIÓN POR MODELO</span>
          <div style={{display:'flex',gap:10}}>
            {[['BOX DUAL','#7c5cfc',stats.boxdual],['WALL','#f7931a',stats.wall],['BOX SIMPLE','#4f8ef7',stats.simple]].map(([l,c,v])=>(
              <div key={l as string} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:6,height:6,borderRadius:1,background:c as string}}/>
                <span style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace'}}>{l as string} {loaded?v:0}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{height:12,background:'#1e2d4a',borderRadius:6,overflow:'hidden',display:'flex'}}>
          {loaded&&stats.total>0&&[
            {w:stats.boxdual/stats.total*100,c:'#7c5cfc',l:`DUAL ${stats.boxdual}`},
            {w:stats.wall/stats.total*100,   c:'#f7931a',l:`WALL ${stats.wall}`},
            {w:stats.simple/stats.total*100, c:'#4f8ef7',l:`SIMPLE ${stats.simple}`},
          ].map((seg,i)=>seg.w>0&&(
            <div key={i} style={{width:`${seg.w}%`,background:seg.c,display:'flex',alignItems:'center',justifyContent:'center',transition:'width .5s'}}>
              {seg.w>8&&<span style={{fontSize:8,color:'#fff',fontFamily:'monospace',fontWeight:700}}>{seg.l}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* LISTA + DETALLE */}
      <div style={{display:'grid',gridTemplateColumns:detalle?'1fr 370px':'1fr',gap:14}}>

        <div style={{...S.card,padding:'15px 17px'}}>
          {/* Búsqueda + dropdowns */}
          <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:180,position:'relative'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3d4f73" strokeWidth="2"
                style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={buscar} onChange={e=>{setBuscar(e.target.value);resetPag()}}
                placeholder="Buscar código, agencia, empresa, modelo..."
                style={{...S.inp,paddingLeft:30}}/>
            </div>
            {!isFranq&&(
              <select value={filtEmp} onChange={e=>{setFiltEmp(e.target.value);setFiltAg('todas');resetPag()}}
                style={{...S.inp,width:'auto',appearance:'none' as any}}>
                <option value="todas">Todas las empresas</option>
                {emps.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            )}
            <select value={filtAg} onChange={e=>{setFiltAg(e.target.value);resetPag()}}
              style={{...S.inp,width:'auto',appearance:'none' as any}}>
              <option value="todas">Todas las agencias</option>
              {ags.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
            {/* Exportar */}
            <button onClick={()=>handleExport()}
              style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,
                background:'rgba(79,142,247,0.1)',border:'1px solid rgba(79,142,247,0.3)',
                color:'#4f8ef7',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap' as const}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar CSV {filtradas.length!==visibles.length&&`(${filtradas.length})`}
            </button>
          </div>

          {/* Chips estado + modelo */}
          <div style={{display:'flex',gap:5,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginRight:2}}>ESTADO:</span>
            <button onClick={()=>{setFiltEst('todos');resetPag()}} style={S.chip(filtEst==='todos','#7b8db0')}>Todas</button>
            {TODOS_EST.map(e=>(
              <button key={e} onClick={()=>{setFiltEst(e);resetPag()}} style={S.chip(filtEst===e,EST[e].color)}>
                {EST[e].label}
              </button>
            ))}
            <div style={{width:1,height:18,background:'#1e2d4a',margin:'0 4px'}}/>
            <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginRight:2}}>MODELO:</span>
            {[['todos','Todos','#7b8db0'],['BOXDUAL','Dual','#7c5cfc'],['WALL','Wall','#f7931a'],['BOX SIMPLE','Simple','#4f8ef7']].map(([v,l,c])=>(
              <button key={v} onClick={()=>{setFiltMod(v);resetPag()}} style={S.chip(filtMod===v,c as string)}>{l as string}</button>
            ))}
          </div>

          {/* Tabla */}
          {!loaded?(
            <p style={{fontSize:11,color:'#3d4f73',fontFamily:'monospace',textAlign:'center',padding:'40px 0'}}>Cargando terminales...</p>
          ):filtradas.length===0?(
            <div style={{textAlign:'center',padding:'40px 0'}}>
              <p style={{fontSize:11,color:'#3d4f73',fontFamily:'monospace'}}>Sin resultados · ajusta los filtros</p>
              <button onClick={()=>{setBuscar('');setFiltEst('todos');setFiltEmp('todas');setFiltAg('todas');setFiltMod('todos');resetPag()}}
                style={{marginTop:8,padding:'5px 14px',borderRadius:7,background:'transparent',border:'1px solid #1e2d4a',color:'#7b8db0',fontSize:10,cursor:'pointer'}}>
                Limpiar filtros
              </button>
            </div>
          ):(
            <>
              <div style={{display:'grid',gridTemplateColumns:'140px 1fr 1.2fr 90px 80px 28px',gap:8,padding:'4px 10px 7px',borderBottom:'1px solid #1e2d4a',marginBottom:4}}>
                {['CÓDIGO','AGENCIA','EMPRESA','MODELO','ESTADO',''].map((h,i)=>(
                  <span key={i} style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1.2}}>{h}</span>
                ))}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3,maxHeight:detalle?'calc(100vh - 480px)':'calc(100vh - 440px)',overflowY:'auto',paddingRight:2}}>
                {pagItems.map(t=>{
                  const em=EST[t.estado as string]||{color:'#3d4f73',label:t.estado}
    
                  const ec=empColor(t.empresa)
                  const isSel=detalle===t._id
                  return(
                    <div key={t._id} onClick={()=>setDetalle(isSel?null:(t._id||''))}
                      style={{display:'grid',gridTemplateColumns:'140px 1fr 1.2fr 90px 80px 28px',gap:8,
                        padding:'8px 10px',borderRadius:8,cursor:'pointer',transition:'all .1s',
                        background:isSel?`${ec}08`:'#141d35',border:`1px solid ${isSel?ec+'45':'#1e2d4a'}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <div style={{width:5,height:5,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                        <span style={{fontSize:10,fontWeight:700,color:'#e8eeff',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.codigo}</span>
                      </div>
                      <span style={{fontSize:10,color:t.agencia?'#7b8db0':'#3d4f73',alignSelf:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontStyle:t.agencia?'normal':'italic'}}>{t.agencia||'Sin agencia'}</span>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <div style={{width:5,height:5,borderRadius:1,background:ec,flexShrink:0}}/>
                        <span style={{fontSize:10,color:t.empresa?'#7b8db0':'#3d4f73',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontStyle:t.empresa?'normal':'italic'}}>{t.empresa||'—'}</span>
                      </div>
                      <Badge v={t.modelo} map={MOD as any}/>
                      <Badge v={t.estado as string} map={EST}/>
                      <span style={{color:'#4f8ef7',alignSelf:'center',textAlign:'right',fontSize:13,display:'inline-block',transition:'transform .15s',transform:isSel?'rotate(90deg)':'rotate(0)'}}>›</span>
                    </div>
                  )
                })}
              </div>
              {/* Paginación */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,paddingTop:9,borderTop:'1px solid #1e2d4a'}}>
                <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>{filtradas.length} resultado{filtradas.length!==1?'s':''} · pág {pagina}/{pagTotal}</span>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>setPagina(1)} disabled={pagina===1} style={{...S.chip(false),padding:'3px 8px',opacity:pagina===1?.4:1}}>«</button>
                  <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1} style={{...S.chip(false),opacity:pagina===1?.4:1}}>‹</button>
                  {Array.from({length:Math.min(5,pagTotal)},(_,i)=>{
                    let p=pagina<=3?i+1:pagTotal-pagina<2?pagTotal-4+i:pagina-2+i
                    if(p<1||p>pagTotal) return null
                    return <button key={p} onClick={()=>setPagina(p)} style={S.chip(p===pagina,'#4f8ef7')}>{p}</button>
                  })}
                  <button onClick={()=>setPagina(p=>Math.min(pagTotal,p+1))} disabled={pagina===pagTotal} style={{...S.chip(false),opacity:pagina===pagTotal?.4:1}}>›</button>
                  <button onClick={()=>setPagina(pagTotal)} disabled={pagina===pagTotal} style={{...S.chip(false),padding:'3px 8px',opacity:pagina===pagTotal?.4:1}}>»</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* PANEL DETALLE */}
        {detalle&&termDet&&(
          <div style={{...S.card,borderColor:`${empDetCol}30`,padding:'16px 18px',position:'sticky',top:20,alignSelf:'start',maxHeight:'calc(100vh - 60px)',overflowY:'auto' as const}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
              <div style={{display:'flex',gap:11,alignItems:'center'}}>
                <div style={{width:40,height:40,borderRadius:10,background:`${empDetCol}15`,border:`1px solid ${empDetCol}35`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={empDetCol} strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                </div>
                <div>
                  <div style={{fontSize:8,color:empDetCol,fontFamily:'monospace',fontWeight:600,marginBottom:2}}>{termDet.empresa||'Sin empresa'}</div>
                  <div style={{fontSize:15,fontWeight:800,color:'#e8eeff',fontFamily:'monospace',lineHeight:1}}>{termDet.codigo}</div>
                </div>
              </div>
              <button onClick={()=>setDetalle(null)} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:14}}>
              <Badge v={termDet.modelo} map={MOD as any}/>
              <Badge v={termDet.estado as string} map={EST}/>
            </div>
            <div style={{fontSize:8,color:'#4f8ef7',fontFamily:'monospace',fontWeight:700,letterSpacing:1.2,marginBottom:8}}>DATOS DE LA TERMINAL</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
              {[{l:'CÓDIGO',v:termDet.codigo,mono:true},{l:'MODELO',v:termDet.modelo,mono:true},{l:'SERIE',v:termDet.serie||'—',mono:true},{l:'EMPRESA',v:termDet.empresa||'—',color:empDetCol}].map((f,i)=>(
                <div key={i} style={{background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,padding:'8px 11px'}}>
                  <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1,marginBottom:3}}>{f.l}</div>
                  <div style={{fontSize:11,color:f.color||'#e8eeff',fontFamily:f.mono?'monospace':'system-ui',fontWeight:f.mono?700:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{f.v}</div>
                </div>
              ))}
            </div>
            {termDet.observacion&&(
              <div style={{background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,padding:'8px 11px',marginBottom:12}}>
                <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:3}}>OBSERVACIÓN</div>
                <div style={{fontSize:10,color:'#7b8db0',lineHeight:1.5}}>{termDet.observacion}</div>
              </div>
            )}
            <div style={{fontSize:8,color:'#7c5cfc',fontFamily:'monospace',fontWeight:700,letterSpacing:1.2,marginBottom:8}}>AGENCIA ASIGNADA</div>
            {agDet?(
              <div style={{background:'rgba(124,92,252,0.05)',border:'1px solid rgba(124,92,252,0.18)',borderRadius:9,padding:'11px 13px',marginBottom:14}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[{l:'LOCAL',v:agDet.subagencia},{l:'DPTO.',v:agDet.sucursal},{l:'ENCARGADO',v:agDet.encargado||'—'},{l:'ESTADO',v:agDet.estado}].map((f,i)=>(
                    <div key={i}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:1}}>{f.l}</div><div style={{fontSize:10,color:'#e8eeff'}}>{f.v||'—'}</div></div>
                  ))}
                </div>
                {agDet.correo&&<div style={{marginTop:7,paddingTop:7,borderTop:'1px solid rgba(124,92,252,0.15)'}}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>CORREO</div><div style={{fontSize:10,color:'#4f8ef7'}}>{agDet.correo}</div></div>}
                {agDet.direccion&&<div style={{marginTop:5}}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>DIRECCIÓN</div><div style={{fontSize:10,color:'#7b8db0'}}>{agDet.direccion}</div></div>}
              </div>
            ):(
              <div style={{background:'rgba(0,229,160,0.04)',border:'1px solid rgba(0,229,160,0.15)',borderRadius:9,padding:'10px 13px',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#00e5a0',flexShrink:0}}/>
                  <span style={{fontSize:10,color:'#00e5a0',fontFamily:'monospace'}}>DISPONIBLE · en stock para asignar</span>
                </div>
                <p style={{fontSize:9,color:'#3d4f73',margin:'4px 0 0'}}>Lista para asignar a una empresa o cubrir una solicitud</p>
              </div>
            )}
            {isAdmin&&(<>
              <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',fontWeight:700,letterSpacing:1.2,marginBottom:8}}>ACCIONES</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <button onClick={()=>setMAsig(termDet)}
                  style={{padding:'9px',borderRadius:8,background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',color:'#00e5a0',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  {agDet?'Reasignar agencia':'Asignar a agencia'}
                </button>
                <button onClick={()=>setMEstado(termDet)}
                  style={{padding:'9px',borderRadius:8,background:'rgba(247,147,26,0.08)',border:'1px solid rgba(247,147,26,0.25)',color:'#f7931a',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  Cambiar estado
                </button>
              </div>
            </>)}
          </div>
        )}
      </div>

      {mNueva  && <ModalNueva   agencias={agencias} onClose={()=>setMNueva(false)} onDone={reload}/>}
      {mEstado && <ModalEstado  term={mEstado}  onClose={()=>setMEstado(null)} onDone={reload}/>}
      {mAsignar&& <ModalAsignar term={mAsignar} agencias={agencias} onClose={()=>setMAsig(null)}  onDone={reload}/>}
    </div>
  )
}
