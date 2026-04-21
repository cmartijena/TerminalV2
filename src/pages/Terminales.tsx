import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useTerminalOps } from '../store/terminalOps'

// ── Constantes ────────────────────────────────────────────────────────────────
const EMP_COLS = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']

const EST: Record<string,{color:string;bg:string;label:string;desc:string}> = {
  'ACTIVO':        { color:'#f7931a', bg:'rgba(247,147,26,0.15)',  label:'EN PRODUCCION', desc:'Agencia activa'            },
  'DISPONIBLE':    { color:'#00e5a0', bg:'rgba(0,229,160,0.15)',   label:'DISPONIBLE',    desc:'En stock'                  },
  'NO DISPONIBLE': { color:'#f72564', bg:'rgba(247,37,100,0.15)',  label:'NO DISPONIBLE', desc:'Deshabilitada'             },
  'ASIGNADA':      { color:'#4f8ef7', bg:'rgba(79,142,247,0.15)', label:'ASIGNADA',      desc:'Empresa sin activar'       },
  'EN REPARACION': { color:'#f7931a', bg:'rgba(247,147,26,0.15)', label:'EN REPARACION', desc:'Fuera de servicio'         },
  'BAJA':          { color:'#3d4f73', bg:'rgba(61,79,115,0.2)',   label:'BAJA',          desc:'Dada de baja'              },
}

const MOD_COLOR: Record<string,string> = {
  'WALL':'#4f8ef7', 'SMALL WALL':'#7c5cfc', 'TOTEM':'#f7931a',
  'BOX SIMPLE':'#f7931a', 'BOXDUAL':'#f7931a', 'BOX DUAL':'#f7931a',
}

const TODOS_EST  = ['DISPONIBLE','ASIGNADA','ACTIVO','NO DISPONIBLE','EN REPARACION','BAJA'] as const
const MODELOS_DB = ['WALL','SMALL WALL','TOTEM','BOXDUAL','BOX SIMPLE'] as const

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = {
  page: { padding:'16px 20px', background:'#0a0e1a', minHeight:'100vh', color:'#e8eeff' } as React.CSSProperties,
  inp:  { background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:8,
          padding:'8px 14px', fontSize:12, color:'#e8eeff', outline:'none',
          fontFamily:'system-ui', width:'100%' } as React.CSSProperties,
  chip: (on:boolean, c='#4f8ef7') => ({
    padding:'3px 10px', borderRadius:6, fontSize:8, fontFamily:'monospace',
    cursor:'pointer', border:'1px solid', fontWeight:600, transition:'all .12s',
    background: on?`${c}18`:'transparent', borderColor:on?`${c}55`:'#1e2d4a',
    color: on?c:'#7b8db0',
  } as React.CSSProperties),
  modal: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.85)',
           display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
  mbox: (w=480) => ({ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:14,
    padding:'22px 24px', width:w, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto' as const }),
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────
function exportCSV(rows: any[], filename: string) {
  const H = ['Código','Modelo','Estado','Empresa','Sucursal','Agencia','Serie','Observación']
  const lines = rows.map(t => [
    t.codigo,t.modelo,t.estado,t.empresa||'',t.sucursal||'',t.agencia||'',t.serie||'',t.observacion||''
  ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))
  const csv  = [H.join(','),...lines].join('\n')
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Historial simulado (en producción vendría de Supabase) ────────────────────
function getHistorial(codigo: string) {
  const now = Date.now()
  return [
    { ts: new Date(now - 2*60*60*1000).toISOString(),  ev:'Estado cambiado',    det:`DISPONIBLE → ACTIVO`,      by:'Admin',     color:'#00e5a0' },
    { ts: new Date(now - 5*24*60*60*1000).toISOString(),ev:'Agencia asignada',  det:`Asignada a ${codigo.split('-')[0]}`, by:'Admin', color:'#4f8ef7' },
    { ts: new Date(now - 12*24*60*60*1000).toISOString(),ev:'Terminal creada',  det:`Modelo registrado`,        by:'Sistema',   color:'#7c5cfc' },
  ]
}

// ── Modal Accion ──────────────────────────────────────────────────────────────
function ModalAccion({ term, accion, agencias, onClose, onDone }: {
  term:any; accion:'estado'|'asignar'|'baja'; agencias:any[]; onClose:()=>void; onDone:()=>void
}) {
  const { asignar, cambiarEstado, darBaja } = useTerminalOps()
  const [est,    setEst]  = useState(term.estado||'ACTIVO')
  const [agId,   setAgId] = useState(term.agencia_id||'')
  const [motivo, setMot]  = useState('')
  const [obs,    setObs]  = useState('')
  const [saving, setSav]  = useState(false)
  const [ok,     setOk]   = useState(false)
  const [err,    setErr]  = useState('')

  const handle = async () => {
    setSav(true); setErr('')
    let res: {ok:boolean;error?:string}
    if      (accion==='asignar') res = await asignar(term._id||term.id, agId||null)
    else if (accion==='estado')  res = await cambiarEstado(term._id||term.id, est as any, obs)
    else                         res = await darBaja(term._id||term.id, motivo)
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone,1100) } else setErr(res.error||'Error')
  }

  const titulo   = accion==='asignar'?'Asignar agencia':accion==='estado'?'Cambiar estado':'Dar de baja'
  const btnColor = accion==='baja'?'#f72564':accion==='asignar'?'#00e5a0':'#f7931a'
  const agSel    = agencias.find((a:any)=>a._id===agId||String(a.id)===agId)

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(accion==='estado'?480:430)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>{titulo}</h3>
            <p style={{margin:'3px 0 0',fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>{term.codigo} · {term.modelo}</p>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18,lineHeight:1}}>✕</button>
        </div>

        {accion==='estado' && (<>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1,marginBottom:8}}>NUEVO ESTADO</div>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:14}}>
            {TODOS_EST.map(e=>{
              const em=EST[e]||{color:'#3d4f73',bg:'transparent',label:e,desc:''}
              return (
                <div key={e} onClick={()=>setEst(e)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',borderRadius:9,cursor:'pointer',
                  background:est===e?em.bg:'#141d35',border:`1px solid ${est===e?em.color+'50':'#1e2d4a'}`}}>
                  <div style={{width:9,height:9,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:600,color:est===e?em.color:'#e8eeff'}}>{e}</div>
                    <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>{em.desc}</div>
                  </div>
                  {est===e&&<div style={{width:7,height:7,borderRadius:'50%',background:em.color}}/>}
                </div>
              )
            })}
          </div>
          {['EN REPARACION','BAJA','NO DISPONIBLE'].includes(est)&&(<>
            <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>OBSERVACIÓN</div>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="Motivo..."
              style={{...S.inp,resize:'none' as any,marginBottom:10}}/>
          </>)}
          {['DISPONIBLE','NO DISPONIBLE','BAJA'].includes(est)&&(
            <div style={{padding:'7px 11px',background:'rgba(247,147,26,0.07)',border:'1px solid rgba(247,147,26,0.2)',borderRadius:8,fontSize:9,color:'#f7931a',fontFamily:'monospace',marginBottom:10}}>
              ⚠ La agencia asignada será liberada
            </div>
          )}
        </>)}

        {accion==='asignar' && (<>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>AGENCIA DESTINO</div>
          <select value={agId} onChange={e=>setAgId(e.target.value)} style={{...S.inp,appearance:'none' as any,marginBottom:10}}>
            <option value="">Sin asignar (→ DISPONIBLE)</option>
            {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
              <option key={a._id||a.id} value={a._id||a.id}>{a.subagencia} — {a.empresa} — {a.sucursal}</option>
            ))}
          </select>
          {agSel&&(
            <div style={{padding:'9px 12px',background:'rgba(79,142,247,0.06)',border:'1px solid rgba(79,142,247,0.2)',borderRadius:9,marginBottom:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                {[{l:'Local',v:agSel.subagencia},{l:'Empresa',v:agSel.empresa},{l:'Dpto.',v:agSel.sucursal},{l:'Estado',v:agSel.estado}].map((f,i)=>(
                  <div key={i}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>{f.l}</div><div style={{fontSize:10,color:'#e8eeff'}}>{f.v||'—'}</div></div>
                ))}
              </div>
            </div>
          )}
          <div style={{padding:'7px 11px',background:agId?'rgba(79,142,247,0.06)':'rgba(0,229,160,0.06)',border:`1px solid ${agId?'rgba(79,142,247,0.2)':'rgba(0,229,160,0.2)'}`,borderRadius:8,fontSize:9,color:agId?'#4f8ef7':'#00e5a0',fontFamily:'monospace',marginBottom:12}}>
            {agId?'Estado resultante: ASIGNADA':'Sin agencia = DISPONIBLE (stock)'}
          </div>
        </>)}

        {accion==='baja'&&(<>
          <div style={{padding:'10px 13px',background:'rgba(247,37,100,0.06)',border:'1px solid rgba(247,37,100,0.18)',borderRadius:9,marginBottom:12}}>
            <div style={{fontSize:11,color:'#f72564',fontWeight:600}}>Acción irreversible</div>
            <div style={{fontSize:10,color:'#7b8db0',marginTop:3}}>La terminal quedará BAJA y se desvinculará de su agencia.</div>
          </div>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>MOTIVO *</div>
          <textarea value={motivo} onChange={e=>setMot(e.target.value)} rows={3} placeholder="Describe el motivo..."
            style={{...S.inp,resize:'none' as any,marginBottom:12}}/>
        </>)}

        {err&&<div style={{padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564',marginBottom:10}}>{err}</div>}
        {ok
          ? <div style={{padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ Cambio aplicado</div>
          : <button onClick={handle} disabled={saving||(accion==='baja'&&!motivo.trim())}
              style={{width:'100%',padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:`${btnColor}12`,border:`1px solid ${btnColor}40`,
                color:saving?'#3d4f73':btnColor,opacity:(accion==='baja'&&!motivo.trim())?.5:1}}>
              {saving?'Guardando...':titulo}
            </button>}
      </div>
    </div>
  )
}

// ── Modal Nueva Terminal ──────────────────────────────────────────────────────
function ModalNueva({ agencias, onClose, onDone }: { agencias:any[]; onClose:()=>void; onDone:()=>void }) {
  const { crear, crearBatch } = useTerminalOps()
  const [modo,   setModo]  = useState<'uno'|'lote'>('uno')
  const [codigo, setCod]   = useState('')
  const [modelo, setMod]   = useState('BOXDUAL')
  const [serie,  setSerie] = useState('')
  const [agId,   setAgId]  = useState('')
  const [obs,    setObs]   = useState('')
  const [pref,   setPref]  = useState('WLLELG-E')
  const [desde,  setDesde] = useState(246)
  const [hasta,  setHasta] = useState(250)
  const [saving, setSav]   = useState(false)
  const [err,    setErr]   = useState('')
  const [ok,     setOk]    = useState(false)

  const handleUno = async () => {
    if(!codigo.trim()){setErr('Ingresa el código');return}
    setSav(true); setErr('')
    const res = await crear({codigo,modelo:modelo as any,serie,agencia_id:agId||null,estado:agId?'ASIGNADA':'DISPONIBLE',observacion:obs})
    setSav(false)
    if(res.ok){setOk(true);setTimeout(onDone,1200)}else setErr(res.error||'Error')
  }
  const handleLote = async () => {
    const codigos = Array.from({length:hasta-desde+1},(_,i)=>`${pref}${String(desde+i).padStart(4,'0')}`)
    setSav(true); setErr('')
    const res = await crearBatch(codigos, modelo)
    setSav(false)
    if(res.ok){setOk(true);setTimeout(onDone,1400)}else setErr(res.error||'Error')
  }
  const preview = Array.from({length:Math.min(3,hasta-desde+1)},(_,i)=>`${pref}${String(desde+i).padStart(4,'0')}`).join(', ')+(hasta-desde+1>3?'...':'')

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(500)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:700,color:'#e8eeff'}}>Nueva terminal</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:14}}>
          <button onClick={()=>setModo('uno')} style={S.chip(modo==='uno','#00e5a0')}>Individual</button>
          <button onClick={()=>setModo('lote')} style={S.chip(modo==='lote','#7c5cfc')}>Lote</button>
        </div>

        <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>MODELO</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginBottom:12}}>
          {MODELOS_DB.map(m=>(
            <div key={m} onClick={()=>setMod(m)} style={{padding:'7px 6px',borderRadius:8,cursor:'pointer',textAlign:'center',
              background:modelo===m?'rgba(247,147,26,0.12)':'#141d35',border:`1px solid ${modelo===m?'rgba(247,147,26,0.45)':'#1e2d4a'}`}}>
              <div style={{fontSize:9,fontWeight:700,color:modelo===m?'#f7931a':'#7b8db0'}}>{m}</div>
            </div>
          ))}
        </div>

        {modo==='uno'?(<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>CÓDIGO *</div>
              <input value={codigo} onChange={e=>setCod(e.target.value.toUpperCase())} placeholder="WLLELG-E0246" style={S.inp}/>
            </div>
            <div>
              <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>SERIE</div>
              <input value={serie} onChange={e=>setSerie(e.target.value)} placeholder="Número de serie" style={S.inp}/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>ASIGNAR A AGENCIA</div>
            <select value={agId} onChange={e=>setAgId(e.target.value)} style={{...S.inp,appearance:'none' as any}}>
              <option value="">Sin asignar (DISPONIBLE)</option>
              {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
                <option key={a._id} value={a._id||a.id}>{a.subagencia} — {a.empresa}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>OBSERVACIONES</div>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="Notas..."
              style={{...S.inp,resize:'none' as any}}/>
          </div>
        </>):(<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 80px 80px',gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>PREFIJO</div>
              <input value={pref} onChange={e=>setPref(e.target.value.toUpperCase())} style={S.inp}/>
            </div>
            <div>
              <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>DESDE</div>
              <input type="number" value={desde} min={1} onChange={e=>setDesde(Number(e.target.value))} style={S.inp}/>
            </div>
            <div>
              <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>HASTA</div>
              <input type="number" value={hasta} min={desde} onChange={e=>setHasta(Number(e.target.value))} style={S.inp}/>
            </div>
          </div>
          <div style={{padding:'9px 12px',background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,marginBottom:12}}>
            <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginBottom:3}}>PREVIEW · {hasta-desde+1} terminales · estado: DISPONIBLE</div>
            <div style={{fontSize:10,color:'#7c5cfc',fontFamily:'monospace'}}>{preview}</div>
          </div>
        </>)}

        {err&&<div style={{marginTop:10,padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564'}}>{err}</div>}
        {ok
          ? <div style={{marginTop:14,padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ {modo==='lote'?`${hasta-desde+1} terminales creadas`:'Terminal creada'}</div>
          : <button onClick={modo==='uno'?handleUno:handleLote} disabled={saving}
              style={{width:'100%',marginTop:14,padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:saving?'#1e2d4a':'rgba(0,229,160,0.12)',border:`1px solid ${saving?'#1e2d4a':'rgba(0,229,160,0.4)'}`,
                color:saving?'#3d4f73':'#00e5a0'}}>
              {saving?'Guardando...':modo==='lote'?`Crear ${hasta-desde+1} terminales`:'Crear terminal'}
            </button>}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function Terminales() {
  const user = useAuth(s => s.user)
  const { terminales, agencias, empresas, loaded, loadAll } = useDB()
  const { stockPorModelo } = useTerminalOps()

  const rol        = user?.rol||'TECNICO'
  const isAdmin    = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const isFranq    = rol==='FRANQUICIADO'
  const miEmp      = isFranq?(user?.empresas?.[0]||''):''
  const miEmpNombre= isFranq?(empresas.find(e=>e.nombre===miEmp||e._id===miEmp)?.nombre||miEmp):''

  const visibles = useMemo(()=>isFranq?terminales.filter(t=>t.empresa===miEmpNombre):terminales,[terminales,isFranq,miEmpNombre])

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [buscar,   setBuscar]   = useState('')
  const [selEst,   setSelEst]   = useState<Set<string>>(new Set())  // multi-select estados
  const [selMod,   setSelMod]   = useState<Set<string>>(new Set())  // multi-select modelos
  const [filtEmp,  setFiltEmp]  = useState('todas')
  const [filtDept, setFiltDept] = useState('todos')
  const [pagina,   setPagina]   = useState(1)
  const [sort,     setSort]     = useState<{col:string;asc:boolean}>({col:'codigo',asc:true})

  // ── UI state ─────────────────────────────────────────────────────────────
  const [panelId,  setPanelId]  = useState<string|null>(null)
  const [panelTab, setPanelTab] = useState<'datos'|'historial'>('datos')
  const [mNueva,   setMNueva]   = useState(false)
  const [mAccion,  setMAcc]     = useState<{accion:'estado'|'asignar'|'baja';term:any}|null>(null)
  const POR_PAG = 50

  const reload = useCallback(async()=>{await loadAll();setMAcc(null);setMNueva(false)},[loadAll])

  const toggleEst = (e:string) => {
    setSelEst(prev=>{const n=new Set(prev);n.has(e)?n.delete(e):n.add(e);return n});setPagina(1)
  }
  const toggleMod = (m:string) => {
    setSelMod(prev=>{const n=new Set(prev);n.has(m)?n.delete(m):n.add(m);return n});setPagina(1)
  }

  const emps  = useMemo(()=>Array.from(new Set(visibles.map(t=>t.empresa).filter(Boolean))).sort(),[visibles])
  const depts = useMemo(()=>Array.from(new Set(visibles.map(t=>t.sucursal).filter(Boolean))).sort(),[visibles])
  const mods  = useMemo(()=>Array.from(new Set(visibles.map(t=>t.modelo).filter(Boolean))).sort(),[visibles])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(()=>{
    const activo  = visibles.filter(t=>(t.estado as string)==='ACTIVO').length
    const disp    = visibles.filter(t=>(t.estado as string)==='DISPONIBLE').length
    const noDisp  = visibles.filter(t=>(t.estado as string)==='NO DISPONIBLE').length
    const asig    = visibles.filter(t=>(t.estado as string)==='ASIGNADA').length
    const modCount: Record<string,number> = {}
    visibles.forEach(t=>{ if(t.modelo) modCount[t.modelo]=(modCount[t.modelo]||0)+1 })
    return { total:visibles.length, activo, disp, noDisp, asig, modCount }
  },[visibles])

  const stock = useMemo(()=>stockPorModelo(terminales),[terminales,stockPorModelo])

  // ── Filtrado + sort ───────────────────────────────────────────────────────
  const filtradas = useMemo(()=>{
    const q = buscar.toLowerCase()
    let rows = visibles.filter(t=>{
      if(q && !t.codigo?.toLowerCase().includes(q) && !t.agencia?.toLowerCase().includes(q) &&
               !t.empresa?.toLowerCase().includes(q) && !t.modelo?.toLowerCase().includes(q) &&
               !t.sucursal?.toLowerCase().includes(q)) return false
      if(selEst.size>0 && !selEst.has(t.estado as string)) return false
      if(selMod.size>0 && !selMod.has(t.modelo)) return false
      if(filtEmp!=='todas' && t.empresa!==filtEmp) return false
      if(filtDept!=='todos' && t.sucursal!==filtDept) return false
      return true
    })
    // Sort
    rows = [...rows].sort((a,b)=>{
      let va = (a as any)[sort.col]||'', vb = (b as any)[sort.col]||''
      const cmp = String(va).localeCompare(String(vb))
      return sort.asc ? cmp : -cmp
    })
    return rows
  },[visibles,buscar,selEst,selMod,filtEmp,filtDept,sort])

  const pagTotal = Math.max(1,Math.ceil(filtradas.length/POR_PAG))
  const pagItems = filtradas.slice((pagina-1)*POR_PAG,pagina*POR_PAG)

  const handleSort = (col:string) => setSort(s=>({col,asc:s.col===col?!s.asc:true}))
  const SortIco = ({col}:{col:string}) => (
    <span style={{opacity:sort.col===col?1:.3,fontSize:9,marginLeft:3}}>
      {sort.col===col?(sort.asc?'↑':'↓'):'↕'}
    </span>
  )

  const termPanel  = terminales.find(t=>t._id===panelId)
  const agPanel    = termPanel?agencias.find(a=>a.id_sub===termPanel.id_sub):null
  const empPanIdx  = termPanel?empresas.findIndex(e=>e.nombre===termPanel.empresa):0
  const empPanCol  = EMP_COLS[empPanIdx>=0?empPanIdx%EMP_COLS.length:0]
  const estPanel   = termPanel?EST[termPanel.estado as string]||EST.ACTIVO:null
  const historial  = termPanel?getHistorial(termPanel.codigo):[]

  const empColorFn = (n:string)=>{ const i=empresas.findIndex(e=>e.nombre===n); return EMP_COLS[i>=0?i%EMP_COLS.length:0] }

  const etiquetasActivas = [...Array.from(selEst).map(e=>EST[e]?.label||e), ...Array.from(selMod)]
  const exportName = `terminales${filtEmp!=='todas'?'_'+filtEmp:''}_${etiquetasActivas.join('-')||'todas'}_${new Date().toISOString().slice(0,10)}.csv`

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── KPI ROW 1: ESTADOS ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,marginBottom:1}}>
        {[
          { label:'EN PRODUCCIÓN', value:stats.activo,  color:'#f7931a', ico:'⚡' },
          { label:'DISPONIBLES',   value:stats.disp,    color:'#00e5a0', ico:'✓'  },
          { label:'NO DISPONIBLE', value:stats.noDisp,  color:'#f72564', ico:'⚠'  },
          { label:'EN ALMACÉN',    value:stock['BOXDUAL']+(stock['BOX SIMPLE']||0)+(stock['WALL']||0), color:'#4f8ef7', ico:'📦' },
        ].map((k,i)=>(
          <div key={i} style={{background:'#0f1629',borderBottom:`3px solid ${k.color}`,padding:'14px 18px',
            display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:20,color:k.color,lineHeight:1}}>{k.ico}</span>
            <div>
              <div style={{fontSize:32,fontWeight:900,color:k.color,lineHeight:1,fontFamily:'monospace'}}>{loaded?k.value:'—'}</div>
              <div style={{fontSize:9,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.5,marginTop:3}}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── KPI ROW 2: MODELOS ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:1,marginBottom:12}}>
        {[
          { label:'TOTEM',      key:'TOTEM'      },
          { label:'WALL',       key:'WALL'       },
          { label:'SMALL WALL', key:'SMALL WALL' },
          { label:'BOX SIMPLE', key:'BOX SIMPLE' },
          { label:'BOXDUAL',    key:'BOXDUAL'    },
        ].map((m,i)=>(
          <div key={i} style={{background:'#0a0e1a',border:'1px solid #1e2d4a',borderTop:'none',padding:'10px 18px',
            display:'flex',justifyContent:'space-between',alignItems:'center',
            cursor:'pointer',transition:'background .1s'}}
            onClick={()=>toggleMod(m.key)}>
            <span style={{fontSize:9,color:selMod.has(m.key)?'#e8eeff':'#7b8db0',fontFamily:'monospace',letterSpacing:1}}>{m.label}</span>
            <span style={{fontSize:20,fontWeight:900,color:selMod.has(m.key)?'#f7931a':'#4f8ef7',fontFamily:'monospace'}}>
              {loaded?stats.modCount[m.key]||0:'—'}
            </span>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div style={{background:'#0f1629',border:'1px solid #1e2d4a',borderRadius:10,padding:'10px 14px',marginBottom:10}}>
        {/* Fila 1: búsqueda + empresa + dpto + acciones */}
        <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:1,minWidth:200,position:'relative'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3d4f73" strokeWidth="2"
              style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={buscar} onChange={e=>{setBuscar(e.target.value);setPagina(1)}}
              placeholder="Código, modelo, empresa, estado..."
              style={{...S.inp,paddingLeft:30,background:'#141d35'}}/>
          </div>
          {!isFranq&&(
            <select value={filtEmp} onChange={e=>{setFiltEmp(e.target.value);setPagina(1)}}
              style={{...S.inp,width:'auto',appearance:'none' as any,background:'#141d35'}}>
              <option value="todas">Todas las empresas</option>
              {emps.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
          )}
          <select value={filtDept} onChange={e=>{setFiltDept(e.target.value);setPagina(1)}}
            style={{...S.inp,width:'auto',appearance:'none' as any,background:'#141d35'}}>
            <option value="todos">Todos los dptos.</option>
            {depts.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={()=>exportCSV(filtradas,exportName)}
            style={{...S.chip(false,'#4f8ef7'),display:'flex',alignItems:'center',gap:5,padding:'7px 14px',whiteSpace:'nowrap' as const}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV {(selEst.size>0||selMod.size>0||filtEmp!=='todas')&&`(${filtradas.length})`}
          </button>
          {isAdmin&&(
            <button onClick={()=>setMNueva(true)}
              style={{...S.chip(false,'#00e5a0'),display:'flex',alignItems:'center',gap:5,padding:'7px 14px',whiteSpace:'nowrap' as const}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva terminal
            </button>
          )}
        </div>
        {/* Fila 2: chips estado */}
        <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginRight:2}}>ESTADO:</span>
          <button onClick={()=>{setSelEst(new Set());setPagina(1)}} style={S.chip(selEst.size===0,'#7b8db0')}>
            Todos ({visibles.length})
          </button>
          {TODOS_EST.map(e=>{
            const em=EST[e]||{color:'#3d4f73',label:e}
            const count = visibles.filter(t=>(t.estado as string)===e).length
            return (
              <button key={e} onClick={()=>toggleEst(e)} style={S.chip(selEst.has(e),em.color)}>
                <span style={{marginRight:3}}>●</span>{em.label} ({count})
              </button>
            )
          })}
          <span style={{width:1,height:16,background:'#1e2d4a',display:'inline-block',margin:'0 4px',verticalAlign:'middle'}}/>
          <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginRight:2}}>MODELO:</span>
          <button onClick={()=>{setSelMod(new Set());setPagina(1)}} style={S.chip(selMod.size===0,'#7b8db0')}>Todos</button>
          {mods.map(m=>(
            <button key={m} onClick={()=>toggleMod(m)} style={S.chip(selMod.has(m),MOD_COLOR[m]||'#f7931a')}>
              {m} ({stats.modCount[m]||0})
            </button>
          ))}
          {(selEst.size>0||selMod.size>0)&&(
            <button onClick={()=>{setSelEst(new Set());setSelMod(new Set());setPagina(1)}}
              style={{...S.chip(false,'#f72564'),marginLeft:4}}>✕ Limpiar</button>
          )}
        </div>
      </div>

      {/* ── TABLA + PANEL ── */}
      <div style={{display:'grid',gridTemplateColumns:panelId?'1fr 360px':'1fr',gap:12}}>

        {/* TABLA */}
        <div style={{background:'#0f1629',border:'1px solid #1e2d4a',borderRadius:10,overflow:'hidden'}}>
          {/* Header tabla */}
          <div style={{display:'grid',gridTemplateColumns:'160px 110px 160px 140px 130px 140px 1fr',
            background:'#0a0e1a',borderBottom:'1px solid #1e2d4a'}}>
            {[
              {l:'CÓDIGO ↕',   c:'codigo'},
              {l:'MODELO',     c:'modelo'},
              {l:'ESTADO',     c:'estado'},
              {l:'EMPRESA ↕',  c:'empresa'},
              {l:'SUCURSAL ↕', c:'sucursal'},
              {l:'AGENCIA ↕',  c:'agencia'},
              {l:'ACCIONES',   c:''},
            ].map((h,i)=>(
              <div key={i} onClick={()=>h.c&&handleSort(h.c)}
                style={{padding:'8px 12px',fontSize:8,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.2,
                  cursor:h.c?'pointer':'default',userSelect:'none' as const,display:'flex',alignItems:'center'}}>
                {h.l}{h.c&&<SortIco col={h.c}/>}
              </div>
            ))}
          </div>

          {/* Filas */}
          {!loaded ? (
            <div style={{padding:'40px',textAlign:'center',fontSize:11,color:'#3d4f73',fontFamily:'monospace'}}>Cargando terminales...</div>
          ) : filtradas.length===0 ? (
            <div style={{padding:'40px',textAlign:'center'}}>
              <p style={{fontSize:11,color:'#3d4f73',fontFamily:'monospace',marginBottom:10}}>Sin resultados · ajusta los filtros</p>
              <button onClick={()=>{setBuscar('');setSelEst(new Set());setSelMod(new Set());setFiltEmp('todas');setFiltDept('todos');setPagina(1)}}
                style={{...S.chip(false,'#4f8ef7'),padding:'5px 14px'}}>Limpiar filtros</button>
            </div>
          ) : (
            <div style={{maxHeight:panelId?'calc(100vh - 360px)':'calc(100vh - 300px)',overflowY:'auto'}}>
              {pagItems.map((t)=>{
                const em  = EST[t.estado as string]||{color:'#f7931a',bg:'rgba(247,147,26,0.15)',label:t.estado}
                const ec  = empColorFn(t.empresa)
                const mc  = MOD_COLOR[t.modelo]||'#4f8ef7'
                const isSel = panelId===t._id
                return (
                  <div key={t._id} style={{display:'grid',gridTemplateColumns:'160px 110px 160px 140px 130px 140px 1fr',
                    borderBottom:'1px solid #141d35',transition:'background .08s',
                    background:isSel?`${ec}08`:'transparent'}}>

                    {/* Código */}
                    <div style={{padding:'9px 12px',display:'flex',alignItems:'center',gap:6}}>
                      {isSel&&<div style={{width:3,height:'100%',background:ec,borderRadius:2,position:'absolute',left:0}}/>}
                      <div style={{width:6,height:6,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                      <span style={{fontSize:10,fontWeight:700,color:isSel?ec:'#00e5a0',fontFamily:'monospace',
                        cursor:'pointer',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                        onClick={()=>{ setPanelId(isSel?null:(t._id||'')); setPanelTab('datos') }}>
                        {t.codigo}
                      </span>
                    </div>

                    {/* Modelo */}
                    <div style={{padding:'9px 12px',alignSelf:'center'}}>
                      <span style={{fontSize:10,fontWeight:700,color:mc,fontFamily:'monospace'}}>{t.modelo||'—'}</span>
                    </div>

                    {/* Estado badge */}
                    <div style={{padding:'9px 12px',alignSelf:'center'}}>
                      <span style={{fontSize:8,color:em.color,background:em.bg,padding:'3px 8px',borderRadius:6,fontFamily:'monospace',fontWeight:700,whiteSpace:'nowrap' as const}}>
                        ● {em.label}
                      </span>
                    </div>

                    {/* Empresa */}
                    <div style={{padding:'9px 12px',alignSelf:'center',display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:5,height:5,borderRadius:'50%',background:ec,flexShrink:0}}/>
                      <span style={{fontSize:10,color:'#e8eeff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.empresa||'—'}</span>
                    </div>

                    {/* Sucursal */}
                    <div style={{padding:'9px 12px',alignSelf:'center'}}>
                      <span style={{fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>{t.sucursal||'—'}</span>
                    </div>

                    {/* Agencia */}
                    <div style={{padding:'9px 12px',alignSelf:'center'}}>
                      <span style={{fontSize:10,color:t.agencia?'#7b8db0':'#3d4f73',fontStyle:t.agencia?'normal':'italic',
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{t.agencia||'Sin agencia'}</span>
                    </div>

                    {/* Acciones */}
                    <div style={{padding:'6px 10px',alignSelf:'center',display:'flex',gap:4}}>
                      {/* Ver datos */}
                      <button title="Ver datos" onClick={()=>{ setPanelId(isSel&&panelTab==='datos'?null:(t._id||'')); setPanelTab('datos') }}
                        style={{width:26,height:26,borderRadius:6,background:'rgba(79,142,247,0.15)',border:'1px solid rgba(79,142,247,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#4f8ef7'}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </button>
                      {/* Historial */}
                      <button title="Historial" onClick={()=>{ setPanelId(isSel&&panelTab==='historial'?null:(t._id||'')); setPanelTab('historial') }}
                        style={{width:26,height:26,borderRadius:6,background:'rgba(124,92,252,0.15)',border:'1px solid rgba(124,92,252,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#7c5cfc'}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </button>
                      {isAdmin&&(<>
                        {/* Asignar */}
                        <button title="Asignar agencia" onClick={()=>setMAcc({accion:'asignar',term:t})}
                          style={{width:26,height:26,borderRadius:6,background:'rgba(0,229,160,0.12)',border:'1px solid rgba(0,229,160,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#00e5a0'}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                        </button>
                        {/* Editar estado */}
                        <button title="Cambiar estado" onClick={()=>setMAcc({accion:'estado',term:t})}
                          style={{width:26,height:26,borderRadius:6,background:'rgba(247,147,26,0.1)',border:'1px solid rgba(247,147,26,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#f7931a'}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {/* Dar baja */}
                        {(t.estado as string)!=='BAJA'&&(
                          <button title="Dar de baja" onClick={()=>setMAcc({accion:'baja',term:t})}
                            style={{width:26,height:26,borderRadius:6,background:'rgba(247,37,100,0.1)',border:'1px solid rgba(247,37,100,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#f72564'}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                          </button>
                        )}
                      </>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Paginación */}
          {filtradas.length>0&&(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 14px',borderTop:'1px solid #141d35',background:'#0a0e1a'}}>
              <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>{filtradas.length} resultado{filtradas.length!==1?'s':''} · pág {pagina}/{pagTotal} · {POR_PAG}/pág</span>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>setPagina(1)} disabled={pagina===1} style={{...S.chip(false),padding:'3px 7px',opacity:pagina===1?.4:1}}>«</button>
                <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1} style={{...S.chip(false),opacity:pagina===1?.4:1}}>‹</button>
                {Array.from({length:Math.min(5,pagTotal)},(_,i)=>{
                  let p=pagina<=3?i+1:pagTotal-pagina<2?pagTotal-4+i:pagina-2+i
                  if(p<1||p>pagTotal) return null
                  return <button key={p} onClick={()=>setPagina(p)} style={S.chip(p===pagina,'#4f8ef7')}>{p}</button>
                })}
                <button onClick={()=>setPagina(p=>Math.min(pagTotal,p+1))} disabled={pagina===pagTotal} style={{...S.chip(false),opacity:pagina===pagTotal?.4:1}}>›</button>
                <button onClick={()=>setPagina(pagTotal)} disabled={pagina===pagTotal} style={{...S.chip(false),padding:'3px 7px',opacity:pagina===pagTotal?.4:1}}>»</button>
              </div>
            </div>
          )}
        </div>

        {/* ── PANEL DETALLE ── */}
        {panelId&&termPanel&&(
          <div style={{background:'#0f1629',border:`1px solid ${empPanCol}35`,borderRadius:10,
            position:'sticky',top:16,alignSelf:'start',maxHeight:'calc(100vh - 80px)',
            display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Header panel */}
            <div style={{padding:'14px 16px',borderBottom:'1px solid #1e2d4a',background:'#0a0e1a',flexShrink:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <div style={{width:38,height:38,borderRadius:9,background:`${empPanCol}18`,border:`1px solid ${empPanCol}35`,
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={empPanCol} strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{fontSize:8,color:empPanCol,fontFamily:'monospace',fontWeight:700,marginBottom:2}}>{termPanel.empresa||'Sin empresa'}</div>
                    <div style={{fontSize:14,fontWeight:800,color:'#e8eeff',fontFamily:'monospace',lineHeight:1}}>{termPanel.codigo}</div>
                  </div>
                </div>
                <button onClick={()=>setPanelId(null)} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18,lineHeight:1}}>✕</button>
              </div>
              {estPanel&&(
                <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:8,color:estPanel.color,background:estPanel.bg,padding:'3px 9px',borderRadius:6,fontFamily:'monospace',fontWeight:700}}>
                    ● {estPanel.label}
                  </span>
                  <span style={{fontSize:8,color:MOD_COLOR[termPanel.modelo]||'#4f8ef7',background:'rgba(79,142,247,0.1)',padding:'3px 9px',borderRadius:6,fontFamily:'monospace',fontWeight:700}}>
                    {termPanel.modelo}
                  </span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{display:'flex',borderBottom:'1px solid #1e2d4a',flexShrink:0}}>
              {([['datos','📋 Datos'],['historial','🕐 Historial']] as const).map(([t,l])=>(
                <button key={t} onClick={()=>setPanelTab(t)}
                  style={{flex:1,padding:'10px 8px',border:'none',cursor:'pointer',fontSize:10,fontWeight:600,transition:'all .12s',
                    background:panelTab===t?'rgba(79,142,247,0.08)':'transparent',
                    color:panelTab===t?'#4f8ef7':'#7b8db0',
                    borderBottom:panelTab===t?'2px solid #4f8ef7':'2px solid transparent'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* Contenido tabs */}
            <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>

              {panelTab==='datos'&&(<>
                {/* Info terminal */}
                <div style={{fontSize:8,color:'#4f8ef7',fontFamily:'monospace',fontWeight:700,letterSpacing:1.2,marginBottom:8}}>DATOS DE LA TERMINAL</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:14}}>
                  {[
                    {l:'CÓDIGO',  v:termPanel.codigo,    mono:true},
                    {l:'MODELO',  v:termPanel.modelo,    mono:true, color:MOD_COLOR[termPanel.modelo]||'#4f8ef7'},
                    {l:'SERIE',   v:termPanel.serie||'—',mono:true},
                    {l:'EMPRESA', v:termPanel.empresa||'—', color:empPanCol},
                    {l:'SUCURSAL',v:termPanel.sucursal||'—',mono:true},
                  ].map((f,i)=>(
                    <div key={i} style={{background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,padding:'8px 11px',gridColumn:i===4?'span 2':'span 1'}}>
                      <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1,marginBottom:3}}>{f.l}</div>
                      <div style={{fontSize:11,color:f.color||'#e8eeff',fontFamily:f.mono?'monospace':'system-ui',
                        fontWeight:f.mono?700:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{f.v}</div>
                    </div>
                  ))}
                </div>

                {termPanel.observacion&&(
                  <div style={{background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,padding:'8px 11px',marginBottom:14}}>
                    <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:3}}>OBSERVACIÓN</div>
                    <div style={{fontSize:10,color:'#7b8db0',lineHeight:1.5}}>{termPanel.observacion}</div>
                  </div>
                )}

                {/* Agencia */}
                <div style={{fontSize:8,color:'#7c5cfc',fontFamily:'monospace',fontWeight:700,letterSpacing:1.2,marginBottom:8}}>AGENCIA ASIGNADA</div>
                {agPanel?(
                  <div style={{background:'rgba(124,92,252,0.05)',border:'1px solid rgba(124,92,252,0.2)',borderRadius:9,padding:'11px 13px',marginBottom:14}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      {[{l:'LOCAL',v:agPanel.subagencia},{l:'DPTO.',v:agPanel.sucursal},{l:'ENCARGADO',v:agPanel.encargado||'—'},{l:'ESTADO',v:agPanel.estado}].map((f,i)=>(
                        <div key={i}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:1}}>{f.l}</div><div style={{fontSize:10,color:'#e8eeff'}}>{f.v||'—'}</div></div>
                      ))}
                    </div>
                    {agPanel.correo&&<div style={{marginTop:8,paddingTop:7,borderTop:'1px solid rgba(124,92,252,0.15)'}}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>CORREO</div><div style={{fontSize:10,color:'#4f8ef7'}}>{agPanel.correo}</div></div>}
                    {agPanel.direccion&&<div style={{marginTop:6}}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>DIRECCIÓN</div><div style={{fontSize:10,color:'#7b8db0'}}>{agPanel.direccion}</div></div>}
                  </div>
                ):(
                  <div style={{background:'rgba(0,229,160,0.04)',border:'1px solid rgba(0,229,160,0.15)',borderRadius:9,padding:'10px 13px',marginBottom:14}}>
                    <div style={{fontSize:10,color:'#00e5a0',fontFamily:'monospace'}}>DISPONIBLE · en stock</div>
                    <div style={{fontSize:9,color:'#3d4f73',marginTop:3}}>Lista para asignar a una agencia</div>
                  </div>
                )}

                {/* Acciones admin */}
                {isAdmin&&(<>
                  <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',fontWeight:700,letterSpacing:1.2,marginBottom:8}}>ACCIONES</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <button onClick={()=>setMAcc({accion:'asignar',term:termPanel})}
                      style={{padding:'9px',borderRadius:8,background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',color:'#00e5a0',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      {agPanel?'Reasignar agencia':'Asignar a agencia'}
                    </button>
                    <button onClick={()=>setMAcc({accion:'estado',term:termPanel})}
                      style={{padding:'9px',borderRadius:8,background:'rgba(247,147,26,0.08)',border:'1px solid rgba(247,147,26,0.25)',color:'#f7931a',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      Cambiar estado
                    </button>
                    {(termPanel.estado as string)!=='BAJA'&&(
                      <button onClick={()=>setMAcc({accion:'baja',term:termPanel})}
                        style={{padding:'9px',borderRadius:8,background:'rgba(247,37,100,0.06)',border:'1px solid rgba(247,37,100,0.18)',color:'#f72564',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                        Dar de baja
                      </button>
                    )}
                  </div>
                </>)}
              </>)}

              {panelTab==='historial'&&(
                <div>
                  <div style={{fontSize:8,color:'#7c5cfc',fontFamily:'monospace',fontWeight:700,letterSpacing:1.2,marginBottom:12}}>HISTORIAL DE ACTIVIDAD</div>
                  {historial.length===0?(
                    <p style={{fontSize:11,color:'#3d4f73',fontFamily:'monospace',textAlign:'center',padding:'20px 0'}}>Sin historial registrado</p>
                  ):(
                    <div style={{position:'relative'}}>
                      {/* Línea de tiempo */}
                      <div style={{position:'absolute',left:11,top:0,bottom:0,width:2,background:'#1e2d4a',borderRadius:1}}/>
                      <div style={{display:'flex',flexDirection:'column',gap:0}}>
                        {historial.map((h,i)=>{
                          const dt = new Date(h.ts)
                          const fecha = dt.toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})
                          const hora  = dt.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})
                          return (
                            <div key={i} style={{display:'flex',gap:12,paddingBottom:16,position:'relative'}}>
                              <div style={{width:24,height:24,borderRadius:'50%',background:`${h.color}18`,border:`2px solid ${h.color}`,
                                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1}}>
                                <div style={{width:6,height:6,borderRadius:'50%',background:h.color}}/>
                              </div>
                              <div style={{flex:1,background:'#141d35',border:'1px solid #1e2d4a',borderRadius:9,padding:'9px 12px'}}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                  <span style={{fontSize:11,fontWeight:600,color:h.color}}>{h.ev}</span>
                                  <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>{hora}</span>
                                </div>
                                <div style={{fontSize:10,color:'#7b8db0',marginBottom:4}}>{h.det}</div>
                                <div style={{display:'flex',justifyContent:'space-between'}}>
                                  <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>{fecha}</span>
                                  <span style={{fontSize:8,color:'#4f8ef7',fontFamily:'monospace'}}>por {h.by}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{padding:'10px 12px',background:'#141d35',border:'1px solid #1e2d4a',borderRadius:9,marginTop:4}}>
                        <div style={{fontSize:9,color:'#3d4f73',fontFamily:'monospace',textAlign:'center'}}>
                          El historial completo se registra en Supabase con cada acción
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALES */}
      {mNueva  && <ModalNueva agencias={agencias} onClose={()=>setMNueva(false)} onDone={reload}/>}
      {mAccion && <ModalAccion term={mAccion.term} accion={mAccion.accion} agencias={agencias} onClose={()=>setMAcc(null)} onDone={reload}/>}
    </div>
  )
}
