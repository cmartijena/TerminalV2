import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useTerminalOps } from '../store/terminalOps'
import { useWAMStatus as _useWAMStatus, syncWAMFromAPI } from '../store/wamStatus'

// ── Paleta ────────────────────────────────────────────────────────────────────
const EMP_COLS = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']
const MODELOS_DB = ['TOTEM','WALL','SMALL WALL','BOX SIMPLE','BOXDUAL'] as const
const TODOS_EST  = ['DISPONIBLE','ASIGNADA','ACTIVO','NO DISPONIBLE','EN REPARACION','BAJA'] as const

const EST: Record<string,{color:string;bg:string;label:string;desc:string}> = {
  'ACTIVO':        { color:'#f7931a', bg:'rgba(247,147,26,0.14)',  label:'EN PRODUCCION', desc:'Agencia activa'      },
  'DISPONIBLE':    { color:'#00e5a0', bg:'rgba(0,229,160,0.14)',   label:'DISPONIBLE',    desc:'En stock'            },
  'NO DISPONIBLE': { color:'#f72564', bg:'rgba(247,37,100,0.14)',  label:'NO DISPONIBLE', desc:'Deshabilitada'       },
  'ASIGNADA':      { color:'#4f8ef7', bg:'rgba(79,142,247,0.14)',  label:'ASIGNADA',      desc:'Sin activar aún'     },
  'EN REPARACION': { color:'#f7931a', bg:'rgba(247,147,26,0.14)',  label:'EN REPARACION', desc:'Fuera de servicio'   },
  'BAJA':          { color:'#3d4f73', bg:'rgba(61,79,115,0.2)',    label:'BAJA',          desc:'Dada de baja'        },
}
const MOD_COL: Record<string,string> = {
  'WALL':'#4f8ef7','SMALL WALL':'#7c5cfc','TOTEM':'#f7931a','BOX SIMPLE':'#f7931a','BOXDUAL':'#7c5cfc',
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(rows: any[], nombre: string) {
  const H = ['Código','Modelo','Estado','Empresa','Sucursal','Agencia','Dirección','Lat','Lng','Serie','Observación']
  const lines = rows.map(t => [
    t.codigo,t.modelo,t.estado,t.empresa||'',t.sucursal||'',t.agencia||'',
    t.direccion||'',t.lat||'',t.lng||'',t.serie||'',t.observacion||''
  ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))
  const blob = new Blob(['\ufeff'+[H.join(','),...lines].join('\n')],{type:'text/csv;charset=utf-8;'})
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = nombre; a.click()
}

// ── Styles reutilizables ──────────────────────────────────────────────────────
const inp = { background:'#141d35', border:'1px solid #1e2d4a', borderRadius:6,
  padding:'6px 10px', fontSize:11, color:'#e8eeff', outline:'none', fontFamily:'system-ui' } as React.CSSProperties
const selStyle = { ...inp, appearance:'none' as any, cursor:'pointer' }

// ════════════════════════════════════════════════════════════════════════════
// MODAL: Exportar CSV con checkboxes por estado
// ════════════════════════════════════════════════════════════════════════════
function ModalExport({ todos, onClose }: { todos:any[]; onClose:()=>void }) {
  const [sel, setSel] = useState(new Set(['todos']))
  const toggle = (k:string) => {
    if (k==='todos') { setSel(new Set(['todos'])); return }
    const n = new Set(sel); n.delete('todos')
    n.has(k) ? n.delete(k) : n.add(k)
    if (!n.size) n.add('todos')
    setSel(n)
  }
  const rows = sel.has('todos') ? todos : todos.filter(t=>sel.has(t.estado as string))
  const ts   = new Date().toISOString().slice(0,10)
  const name = `terminales_${[...sel].join('-')}_${ts}.csv`

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={onClose}>
      <div style={{background:'#0f1629',border:'1px solid #1e2d4a',borderRadius:14,padding:'22px 24px',width:420,maxWidth:'94vw'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>Exportar terminales</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
          {[['todos','Todos los estados',todos.length,'#4f8ef7'], ...TODOS_EST.map(e=>[e,EST[e]?.label||e,todos.filter(t=>t.estado===e).length,EST[e]?.color||'#7b8db0'])].map(([k,l,cnt,col])=>(
            <label key={k as string} onClick={()=>toggle(k as string)}
              style={{display:'flex',alignItems:'center',gap:9,cursor:'pointer',padding:'8px 11px',
                background:sel.has(k as string)?`${col}10`:'#141d35',border:`1px solid ${sel.has(k as string)?col+'40':'#1e2d4a'}`,borderRadius:8}}>
              <div style={{width:14,height:14,borderRadius:3,background:sel.has(k as string)?col as string:'transparent',border:`1px solid ${sel.has(k as string)?col:'#1e2d4a'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {sel.has(k as string)&&<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5"><polyline points="1.5 5 4 7.5 8.5 2"/></svg>}
              </div>
              <span style={{flex:1,fontSize:10,color:sel.has(k as string)?col as string:'#7b8db0',fontWeight:500}}>{l as string}</span>
              <span style={{fontSize:10,color:sel.has(k as string)?col as string:'#3d4f73',fontFamily:'monospace',fontWeight:700}}>{cnt as number}</span>
            </label>
          ))}
        </div>
        <div style={{padding:'8px 12px',background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,marginBottom:12,fontSize:9,color:'#7b8db0',fontFamily:'monospace'}}>{name} · {rows.length} filas</div>
        <button onClick={()=>{exportCSV(rows,name);onClose()}}
          style={{width:'100%',padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',background:'rgba(79,142,247,0.12)',border:'1px solid rgba(79,142,247,0.4)',color:'#4f8ef7'}}>
          ↓ Descargar CSV
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL: Nueva terminal
// ════════════════════════════════════════════════════════════════════════════
function ModalNueva({ agencias, onClose, onDone }: { agencias:any[]; onClose:()=>void; onDone:()=>void }) {
  const { crear, crearBatch } = useTerminalOps()
  const [modo, setModo] = useState<'uno'|'lote'>('uno')
  const [codigo,setCod]=useState(''); const [modelo,setMod]=useState('BOXDUAL'); const [serie,setSer]=useState('')
  const [agId,setAg]=useState(''); const [obs,setObs]=useState('')
  const [pref,setPref]=useState('WLLELG-E'); const [desde,setDsd]=useState(246); const [hasta,setHst]=useState(250)
  const [saving,setSav]=useState(false); const [err,setErr]=useState(''); const [ok,setOk]=useState(false)

  const doUno = async () => {
    if (!codigo.trim()) { setErr('El código es obligatorio'); return }
    setSav(true); setErr('')
    const res = await crear({codigo,modelo:modelo as any,serie,agencia_id:agId||null,estado:agId?'ASIGNADA':'DISPONIBLE',observacion:obs})
    setSav(false); if(res.ok){setOk(true);setTimeout(onDone,1200)} else setErr(res.error||'Error')
  }
  const doLote = async () => {
    const codigos = Array.from({length:hasta-desde+1},(_,i)=>`${pref}${String(desde+i).padStart(4,'0')}`)
    setSav(true); setErr('')
    const res = await crearBatch(codigos,modelo)
    setSav(false); if(res.ok){setOk(true);setTimeout(onDone,1400)} else setErr(res.error||'Error')
  }
  const prev = Array.from({length:Math.min(3,hasta-desde+1)},(_,i)=>`${pref}${String(desde+i).padStart(4,'0')}`).join(', ')+(hasta-desde+1>3?'...':'')

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={onClose}>
      <div style={{background:'#0f1629',border:'1px solid #1e2d4a',borderRadius:14,padding:'22px 24px',width:500,maxWidth:'94vw',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>Nueva terminal</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:20}}>✕</button>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:14}}>
          {(['uno','lote'] as const).map(m=>(
            <button key={m} onClick={()=>setModo(m)} style={{padding:'4px 14px',borderRadius:6,border:'1px solid',cursor:'pointer',fontSize:10,fontFamily:'monospace',fontWeight:600,background:modo===m?'rgba(0,229,160,0.1)':'transparent',borderColor:modo===m?'rgba(0,229,160,0.4)':'#1e2d4a',color:modo===m?'#00e5a0':'#7b8db0'}}>
              {m==='uno'?'Individual':'En lote'}
            </button>
          ))}
        </div>
        <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>MODELO</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginBottom:14}}>
          {MODELOS_DB.map(m=>(
            <div key={m} onClick={()=>setMod(m)} style={{padding:'8px 4px',borderRadius:7,cursor:'pointer',textAlign:'center',background:modelo===m?'rgba(247,147,26,0.12)':'#141d35',border:`1px solid ${modelo===m?'rgba(247,147,26,0.45)':'#1e2d4a'}`}}>
              <div style={{fontSize:9,fontWeight:700,color:modelo===m?'#f7931a':'#7b8db0'}}>{m}</div>
            </div>
          ))}
        </div>
        {modo==='uno'?(<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>CÓDIGO *</div><input value={codigo} onChange={e=>setCod(e.target.value.toUpperCase())} placeholder="WLLELG-E0246" style={{...inp,width:'100%'}}/></div>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>SERIE</div><input value={serie} onChange={e=>setSer(e.target.value)} placeholder="Núm. serie" style={{...inp,width:'100%'}}/></div>
          </div>
          <div style={{marginBottom:10}}><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>AGENCIA (opcional)</div>
            <select value={agId} onChange={e=>setAg(e.target.value)} style={{...selStyle,width:'100%'}}>
              <option value="">Sin asignar (DISPONIBLE)</option>
              {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
                <option key={a._id} value={a._id||a.id}>{a.subagencia} — {a.empresa}</option>
              ))}
            </select>
          </div>
          <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>OBSERVACIONES</div><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="Notas..." style={{...inp,resize:'none' as any,width:'100%'}}/></div>
        </>):(<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 80px 80px',gap:8,marginBottom:10}}>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>PREFIJO</div><input value={pref} onChange={e=>setPref(e.target.value.toUpperCase())} style={{...inp,width:'100%'}}/></div>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>DESDE</div><input type="number" value={desde} min={1} onChange={e=>setDsd(Number(e.target.value))} style={{...inp,width:'100%'}}/></div>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>HASTA</div><input type="number" value={hasta} min={desde} onChange={e=>setHst(Number(e.target.value))} style={{...inp,width:'100%'}}/></div>
          </div>
          <div style={{padding:'8px 12px',background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,marginBottom:12}}>
            <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginBottom:2}}>PREVIEW · {hasta-desde+1} terminales · estado: DISPONIBLE</div>
            <div style={{fontSize:10,color:'#7c5cfc',fontFamily:'monospace'}}>{prev}</div>
          </div>
        </>)}
        {err&&<div style={{padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564',marginBottom:10}}>{err}</div>}
        {ok
          ? <div style={{padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ {modo==='lote'?`${hasta-desde+1} terminales creadas`:'Terminal creada'}</div>
          : <button onClick={modo==='uno'?doUno:doLote} disabled={saving} style={{width:'100%',marginTop:14,padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',background:saving?'#1e2d4a':'rgba(0,229,160,0.12)',border:`1px solid ${saving?'#1e2d4a':'rgba(0,229,160,0.4)'}`,color:saving?'#3d4f73':'#00e5a0'}}>
              {saving?'Guardando...':modo==='lote'?`Crear ${hasta-desde+1} terminales`:'Crear terminal'}
            </button>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL: Acción (estado / asignar / baja / editar)
// ════════════════════════════════════════════════════════════════════════════
function ModalAccion({ term, accion, agencias, onClose, onDone }:{
  term:any; accion:'estado'|'asignar'|'baja'|'editar'; agencias:any[]; onClose:()=>void; onDone:()=>void
}) {
  const { asignar, cambiarEstado, darBaja, actualizar } = useTerminalOps()
  const [est,setEst] = useState(term.estado||'ACTIVO')
  const [agId,setAg] = useState(term.agencia_id||'')
  const [motivo,setMot] = useState('')
  const [obs,setObs] = useState(term.observacion||'')
  const [codigo,setCod] = useState(term.codigo||'')
  const [serie,setSer] = useState(term.serie||'')
  const [modelo,setMod] = useState(term.modelo||'BOXDUAL')
  const [saving,setSav] = useState(false); const [ok,setOk] = useState(false); const [err,setErr] = useState('')

  const handle = async () => {
    setSav(true); setErr(''); let res:{ok:boolean;error?:string}
    if      (accion==='asignar') res = await asignar(term._id||term.id, agId||null)
    else if (accion==='estado')  res = await cambiarEstado(term._id||term.id, est as any, obs)
    else if (accion==='baja')    res = await darBaja(term._id||term.id, motivo)
    else                         res = await actualizar(term._id||term.id, {codigo:codigo.trim().toUpperCase(),serie:serie||undefined,modelo:modelo as any,observacion:obs||undefined})
    setSav(false); if(res.ok){setOk(true);setTimeout(onDone,1100)} else setErr(res.error||'Error')
  }

  const tit   = {estado:'Cambiar estado',asignar:'Asignar agencia',baja:'Dar de baja',editar:'Editar terminal'}[accion]
  const btnC  = {estado:'#f7931a',asignar:'#00e5a0',baja:'#f72564',editar:'#7c5cfc'}[accion]
  const agSel = agencias.find((a:any)=>a._id===agId||String(a.id)===agId)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={onClose}>
      <div style={{background:'#0f1629',border:'1px solid #1e2d4a',borderRadius:14,padding:'22px 24px',width:accion==='estado'?480:420,maxWidth:'94vw',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <div><h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>{tit}</h3>
            <p style={{margin:'3px 0 0',fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>{term.codigo} · {term.modelo}</p></div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
        </div>

        {accion==='editar'&&(<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>CÓDIGO</div><input value={codigo} onChange={e=>setCod(e.target.value.toUpperCase())} style={{...inp,width:'100%'}}/></div>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>SERIE</div><input value={serie} onChange={e=>setSer(e.target.value)} style={{...inp,width:'100%'}}/></div>
          </div>
          <div style={{marginBottom:10}}><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>MODELO</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
              {MODELOS_DB.map(m=>(<div key={m} onClick={()=>setMod(m)} style={{padding:'7px 4px',borderRadius:7,cursor:'pointer',textAlign:'center',background:modelo===m?'rgba(247,147,26,0.12)':'#141d35',border:`1px solid ${modelo===m?'rgba(247,147,26,0.4)':'#1e2d4a'}`}}><div style={{fontSize:9,fontWeight:700,color:modelo===m?'#f7931a':'#7b8db0'}}>{m}</div></div>))}
            </div>
          </div>
          <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>OBSERVACIONES</div><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} style={{...inp,resize:'none' as any,width:'100%'}}/></div>
        </>)}

        {accion==='estado'&&(<>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:8}}>NUEVO ESTADO</div>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
            {TODOS_EST.map(e=>{const em=EST[e]||{color:'#3d4f73',bg:'transparent',label:e};return(
              <div key={e} onClick={()=>setEst(e)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',borderRadius:9,cursor:'pointer',background:est===e?em.bg:'#141d35',border:`1px solid ${est===e?em.color+'50':'#1e2d4a'}`}}>
                <div style={{width:9,height:9,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:est===e?em.color:'#e8eeff'}}>{e}</div><div style={{fontSize:9,color:'#3d4f73',fontFamily:'monospace'}}>{em.desc}</div></div>
                {est===e&&<div style={{width:7,height:7,borderRadius:'50%',background:em.color}}/>}
              </div>
            )})}
          </div>
          {['EN REPARACION','BAJA','NO DISPONIBLE'].includes(est)&&(<><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>OBSERVACIÓN</div><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="Motivo..." style={{...inp,resize:'none' as any,width:'100%',marginBottom:10}}/></>)}
          {['DISPONIBLE','NO DISPONIBLE','BAJA'].includes(est)&&(<div style={{padding:'7px 11px',background:'rgba(247,147,26,0.07)',border:'1px solid rgba(247,147,26,0.2)',borderRadius:8,fontSize:9,color:'#f7931a',fontFamily:'monospace',marginBottom:10}}>⚠ La agencia asignada será liberada</div>)}
        </>)}

        {accion==='asignar'&&(<>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>AGENCIA DESTINO</div>
          <select value={agId} onChange={e=>setAg(e.target.value)} style={{...selStyle,width:'100%',marginBottom:10}}>
            <option value="">Sin asignar (→ DISPONIBLE)</option>
            {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(<option key={a._id||a.id} value={a._id||a.id}>{a.subagencia} — {a.empresa} — {a.sucursal}</option>))}
          </select>
          {agSel&&(<div style={{padding:'9px 12px',background:'rgba(79,142,247,0.06)',border:'1px solid rgba(79,142,247,0.2)',borderRadius:9,marginBottom:10}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
              {[{l:'Local',v:agSel.subagencia},{l:'Empresa',v:agSel.empresa},{l:'Dpto.',v:agSel.sucursal},{l:'Estado',v:agSel.estado}].map((f,i)=>(<div key={i}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>{f.l}</div><div style={{fontSize:10,color:'#e8eeff'}}>{f.v||'—'}</div></div>))}
            </div>
          </div>)}
          <div style={{padding:'7px 11px',background:agId?'rgba(79,142,247,0.06)':'rgba(0,229,160,0.06)',border:`1px solid ${agId?'rgba(79,142,247,0.2)':'rgba(0,229,160,0.2)'}`,borderRadius:8,fontSize:9,color:agId?'#4f8ef7':'#00e5a0',fontFamily:'monospace',marginBottom:12}}>
            {agId?'Estado resultante: ASIGNADA':'Sin agencia = DISPONIBLE (stock)'}
          </div>
        </>)}

        {accion==='baja'&&(<><div style={{padding:'10px 13px',background:'rgba(247,37,100,0.06)',border:'1px solid rgba(247,37,100,0.18)',borderRadius:9,marginBottom:12}}><div style={{fontSize:11,color:'#f72564',fontWeight:600}}>Acción irreversible</div><div style={{fontSize:10,color:'#7b8db0',marginTop:3}}>La terminal quedará BAJA y se desvinculará de su agencia.</div></div>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>MOTIVO *</div><textarea value={motivo} onChange={e=>setMot(e.target.value)} rows={3} placeholder="Describe el motivo..." style={{...inp,resize:'none' as any,width:'100%',marginBottom:12}}/></>)}

        {err&&<div style={{padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564',marginBottom:10}}>{err}</div>}
        {ok
          ? <div style={{padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ Cambio aplicado</div>
          : <button onClick={handle} disabled={saving||(accion==='baja'&&!motivo.trim())} style={{width:'100%',padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',background:`${btnC}12`,border:`1px solid ${btnC}40`,color:saving?'#3d4f73':btnC,opacity:(accion==='baja'&&!motivo.trim())?.5:1}}>
              {saving?'Guardando...':tit}
            </button>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DRAWER SCI-FI  (desliza desde derecha, esquina cortada)
// ════════════════════════════════════════════════════════════════════════════
function DrawerSciFi({ term, agencias, empresas, isAdmin, onAccion, onClose }:{
  term:any; agencias:any[]; empresas:any[]; isAdmin:boolean;
  onAccion:(a:'estado'|'asignar'|'baja'|'editar')=>void; onClose:()=>void;
}) {
  const navigate = useNavigate()
  const wam      = _useWAMStatus()
  const agDet    = agencias.find(a=>a.id_sub===term.id_sub)
  const empIdx   = empresas.findIndex(e=>e.nombre===term.empresa)
  const empCol   = EMP_COLS[empIdx>=0?empIdx%EMP_COLS.length:0]
  const estDet   = EST[term.estado as string]||{color:'#3d4f73',bg:'#141d35',label:term.estado,desc:''}
  const stC      = estDet.color
  const cx       = wam.getConexion(term.codigo)
  const wSt      = wam.getStatus(term.codigo)
  const wCol     = cx===true?'#00e5a0':cx===false?'#f72564':'#3d4f73'
  const wLbl     = wSt==='active'?'Activa · WAM':wSt==='idle'?'Conectada · idle':wSt==='maintenance'?'Mantenimiento':wSt==='off'?'Desconectada':'Sin datos WAM'
  const [updatingWAM, setUpdWAM] = useState(false)
  const updateWAMFn = async (status: 'idle'|'active'|'off'|'maintenance'|null) => {
    setUpdWAM(true)
    await wam.update(term._id||term.id, term.codigo, status)
    setUpdWAM(false)
  }

  const hist = [
    { ev:'Estado cambiado',  det:estDet.label,                    c:'#00e5a0', ts:'Hoy 09:14',  by:'Admin'   },
    { ev:'Agencia asignada', det:agDet?agDet.subagencia:'Sin ag', c:'#4f8ef7', ts:'Hace 5d',    by:'Admin'   },
    { ev:'Terminal creada',  det:'Registrada en sistema',          c:'#7c5cfc', ts:'Hace 12d',   by:'Sistema' },
  ]

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(5,8,16,0.65)',zIndex:200}}/>
      <div style={{position:'fixed',top:'48px',right:0,bottom:0,width:'30%',zIndex:201,
        clipPath:'polygon(32px 0, 100% 0, 100% 100%, 0 100%, 0 32px)',
        display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Fondo */}
        <div style={{position:'absolute',inset:0,background:'#0d1120'}}/>
        {/* Bordes */}
        <div style={{position:'absolute',inset:0,pointerEvents:'none',borderLeft:`1px solid ${stC}55`,borderTop:`1px solid ${stC}55`}}/>
        {/* Línea neón superior */}
        <div style={{position:'absolute',top:0,left:32,right:0,height:1,background:`linear-gradient(90deg,${stC},${stC}44,transparent)`,zIndex:2}}/>
        {/* Esquina diagonal */}
        <svg style={{position:'absolute',top:0,left:0,width:34,height:34,zIndex:3,pointerEvents:'none'}} viewBox="0 0 34 34">
          <line x1="1" y1="33" x2="33" y2="1" stroke={stC} strokeWidth="1" opacity="0.7"/>
          <line x1="1" y1="26" x2="26" y2="1" stroke={stC} strokeWidth="0.4" opacity="0.3"/>
        </svg>

        <div style={{position:'relative',zIndex:4,display:'flex',flexDirection:'column',height:'100%'}}>
          {/* Header */}
          <div style={{padding:'14px 18px 12px 44px',borderBottom:`1px solid ${stC}18`,flexShrink:0}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:38,height:38,border:`1px solid ${stC}45`,background:`${stC}0c`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stC} strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                </div>
                <div>
                  <div style={{fontSize:8,color:stC,fontFamily:'monospace',letterSpacing:2,marginBottom:3}}>TERMINAL ///</div>
                  <div style={{fontSize:14,fontWeight:900,color:'#e8eeff',fontFamily:'monospace',letterSpacing:1,lineHeight:1}}>{term.codigo}</div>
                </div>
              </div>
              <button onClick={onClose} style={{width:26,height:26,border:`1px solid ${stC}35`,background:`${stC}08`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:stC,fontSize:14,flexShrink:0}}>✕</button>
            </div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              <span style={{fontSize:8,color:stC,background:`${stC}14`,border:`1px solid ${stC}40`,padding:'2px 9px',fontFamily:'monospace',fontWeight:700}}>● {estDet.label}</span>
              <span style={{fontSize:8,color:MOD_COL[term.modelo]||'#4f8ef7',background:`${MOD_COL[term.modelo]||'#4f8ef7'}12`,border:`1px solid ${MOD_COL[term.modelo]||'#4f8ef7'}35`,padding:'2px 9px',fontFamily:'monospace',fontWeight:700}}>{term.modelo||'—'}</span>
              {term.empresa&&<span style={{fontSize:8,color:empCol,background:`${empCol}10`,border:`1px solid ${empCol}30`,padding:'2px 9px',fontFamily:'monospace'}}>{term.empresa}</span>}
              <span style={{fontSize:8,color:wCol,background:`${wCol}10`,border:`1px solid ${wCol}35`,padding:'2px 9px',fontFamily:'monospace',display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:wCol}}/>
                {wLbl}
              </span>
            </div>
          </div>

          {/* Cuerpo */}
          <div style={{flex:1,overflowY:'auto',padding:'12px 18px',display:'flex',flexDirection:'column',gap:14}}>

            {/* DATOS */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><div style={{width:12,height:1,background:'#4f8ef7'}}/><span style={{fontSize:7,color:'#4f8ef7',fontFamily:'monospace',fontWeight:700,letterSpacing:1.5}}>DATOS DE LA TERMINAL</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5}}>
                {[{l:'MODELO',v:term.modelo||'—',c:MOD_COL[term.modelo]||'#4f8ef7'},{l:'SERIE',v:term.serie||'—',c:'#e8eeff'},{l:'ESTADO',v:estDet.label,c:stC},{l:'EMPRESA',v:term.empresa||'—',c:empCol},{l:'SUCURSAL',v:term.sucursal||'—',c:'#e8eeff'},{l:'CÓDIGO',v:term.codigo,c:'#00e5a0',mono:true}].map((f,i)=>(
                  <div key={i} style={{background:'#141d35',border:'1px solid #1e2d4a',padding:'7px 10px',borderLeft:i===2?`2px solid ${stC}`:undefined}}>
                    <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:2}}>{f.l}</div>
                    <div style={{fontSize:9,color:f.c,fontFamily:(f as any).mono?'monospace':'system-ui',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{f.v}</div>
                  </div>
                ))}
              </div>
              {term.observacion&&<div style={{marginTop:5,background:'#141d35',border:'1px solid #1e2d4a',padding:'7px 10px'}}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:2}}>OBSERVACIÓN</div><div style={{fontSize:9,color:'#7b8db0',lineHeight:1.4}}>{term.observacion}</div></div>}
            </div>

            {/* AGENCIA */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:12,height:1,background:'#7c5cfc'}}/><span style={{fontSize:7,color:'#7c5cfc',fontFamily:'monospace',fontWeight:700,letterSpacing:1.5}}>AGENCIA ASIGNADA</span></div>
                {agDet&&<button onClick={()=>navigate('/agencias')} style={{fontSize:8,color:'#7c5cfc',background:'rgba(124,92,252,0.08)',border:'1px solid rgba(124,92,252,0.3)',padding:'3px 9px',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7c5cfc" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Ver agencia
                </button>}
              </div>
              {agDet?(
                <div style={{background:'rgba(124,92,252,0.05)',border:'1px solid rgba(124,92,252,0.2)',padding:'11px 13px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom: agDet.direccion?8:0}}>
                    {[{l:'LOCAL',v:agDet.subagencia},{l:'DPTO.',v:agDet.sucursal},{l:'ENCARGADO',v:agDet.encargado||'—'},{l:'ESTADO',v:agDet.estado,c:agDet.estado==='EN PRODUCCION'?'#00e5a0':'#f7931a'}].map((f,i)=>(
                      <div key={i}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:2}}>{f.l}</div><div style={{fontSize:9,color:(f as any).c||'#e8eeff'}}>{f.v||'—'}</div></div>
                    ))}
                  </div>
                  {agDet.direccion&&<div style={{paddingTop:8,borderTop:'1px solid rgba(124,92,252,0.15)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{flex:1}}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:2}}>DIRECCIÓN</div><div style={{fontSize:9,color:'#7b8db0',lineHeight:1.4}}>{agDet.direccion}</div></div>
                    {agDet.lat&&agDet.lng&&<a href={`https://maps.google.com/?q=${agDet.lat},${agDet.lng}`} target="_blank" rel="noreferrer" style={{fontSize:8,color:'#4f8ef7',textDecoration:'none',flexShrink:0}}>📍{Number(agDet.lat).toFixed(4)},{Number(agDet.lng).toFixed(4)}</a>}
                  </div>}
                </div>
              ):(term.estado as string)==='NO DISPONIBLE'?(
                <div style={{background:'rgba(247,37,100,0.04)',border:'1px solid rgba(247,37,100,0.18)',padding:'14px',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                  <div style={{width:36,height:36,border:'1px solid rgba(247,37,100,0.3)',background:'rgba(247,37,100,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f72564" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </div>
                  <div style={{fontSize:10,color:'#f72564',fontFamily:'monospace',fontWeight:700}}>TERMINAL NO DISPONIBLE</div>
                  <div style={{fontSize:9,color:'#3d4f73',textAlign:'center'}}>Deshabilitada · sin agencia asignada</div>
                </div>
              ):(
                <div style={{background:'rgba(0,229,160,0.04)',border:'1px solid rgba(0,229,160,0.18)',padding:'14px',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                  <div style={{width:36,height:36,border:'1px solid rgba(0,229,160,0.3)',background:'rgba(0,229,160,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="1.5"><path d="M2 7l10-5 10 5M2 7v10l10 5 10-5V7"/></svg>
                  </div>
                  <div style={{fontSize:10,color:'#00e5a0',fontFamily:'monospace',fontWeight:700}}>DISPONIBLE · EN STOCK</div>
                  <div style={{fontSize:9,color:'#3d4f73',textAlign:'center'}}>Lista para asignar a una agencia</div>
                </div>
              )}
            </div>

            {/* HISTORIAL */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><div style={{width:12,height:1,background:'#f7931a'}}/><span style={{fontSize:7,color:'#f7931a',fontFamily:'monospace',fontWeight:700,letterSpacing:1.5}}>HISTORIAL DE ACTIVIDAD</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {hist.map((h,i)=>(
                  <div key={i} style={{background:'#141d35',borderLeft:`2px solid ${h.c}`,padding:'8px 11px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:2}}>
                      <div style={{fontSize:9,fontWeight:700,color:h.c}}>{h.ev}</div>
                      <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',flexShrink:0,marginLeft:8}}>{h.ts}</div>
                    </div>
                    <div style={{fontSize:9,color:'#7b8db0',marginBottom:2}}>{h.det}</div>
                    <div style={{fontSize:8,color:'#4f8ef7',fontFamily:'monospace'}}>por {h.by}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones */}
          {isAdmin&&(
            <div style={{padding:'10px 18px',borderTop:`1px solid ${stC}18`,flexShrink:0,background:'rgba(5,8,16,0.8)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><div style={{width:12,height:1,background:'#7b8db0'}}/><span style={{fontSize:7,color:'#7b8db0',fontFamily:'monospace',fontWeight:700,letterSpacing:1.5}}>ACCIONES</span></div>
              {/* Estado WAM manual */}
              <div style={{marginBottom:8,padding:'8px 10px',background:'#141d35',border:'1px solid #1e2d4a'}}>
                <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:6,letterSpacing:1}}>ESTADO WAM · actualizar manual</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                  {([['idle','Conectada · idle','#4f8ef7'],['active','Activa','#00e5a0'],['off','Desconectada','#f72564'],['maintenance','Mantenimiento','#f7931a']] as const).map(([v,l,col])=>(
                    <button key={v} onClick={()=>updateWAMFn(v)} disabled={updatingWAM||wSt===v}
                      style={{padding:'6px',background:wSt===v?`${col}20`:'transparent',border:`1px solid ${wSt===v?col+'60':'#1e2d4a'}`,color:wSt===v?col:'#7b8db0',fontSize:9,cursor:wSt===v||updatingWAM?'default':'pointer',fontFamily:'monospace',fontWeight:wSt===v?700:400}}>
                      {wSt===v?'✓ ':''}{l}
                    </button>
                  ))}
                </div>
                {cx===null&&<div style={{marginTop:5,fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>Sin datos — actualiza manualmente o agrega columna wam_status en Supabase</div>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                <button onClick={()=>onAccion('editar')} style={{padding:'8px',background:'rgba(124,92,252,0.08)',border:'1px solid rgba(124,92,252,0.3)',color:'#7c5cfc',fontSize:10,fontWeight:700,cursor:'pointer'}}>Editar</button>
                <button onClick={()=>onAccion('asignar')} style={{padding:'8px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.3)',color:'#00e5a0',fontSize:10,fontWeight:700,cursor:'pointer'}}>{agDet?'Reasignar':'Asignar'}</button>
                <button onClick={()=>onAccion('estado')} style={{padding:'8px',background:'rgba(247,147,26,0.08)',border:'1px solid rgba(247,147,26,0.3)',color:'#f7931a',fontSize:10,fontWeight:700,cursor:'pointer'}}>Cambiar estado</button>
                {(term.estado as string)!=='BAJA'&&<button onClick={()=>onAccion('baja')} style={{padding:'8px',background:'rgba(247,37,100,0.06)',border:'1px solid rgba(247,37,100,0.2)',color:'#f72564',fontSize:10,fontWeight:700,cursor:'pointer'}}>Dar de baja</button>}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function Terminales() {
  const user = useAuth(s=>s.user)
  const { terminales, agencias, empresas, loaded, loadAll } = useDB()
  const wam      = _useWAMStatus()

  const rol      = user?.rol||'TECNICO'
  const isAdmin  = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const isFranq  = rol==='FRANQUICIADO'
  const miEmpNom = isFranq?(empresas.find(e=>e.nombre===user?.empresas?.[0]||e._id===user?.empresas?.[0])?.nombre||user?.empresas?.[0]||''):''

  const visibles = useMemo(()=>isFranq?terminales.filter(t=>t.empresa===miEmpNom):terminales,[terminales,isFranq,miEmpNom])

  // ── WAM fetch ──────────────────────────────────────────────────────────────
  const fetchWAMFn = wam.fetch
  const updateWAM  = wam.update
  useEffect(()=>{
    // Leer de Supabase
    fetchWAMFn()
    // Intentar sincronizar desde WAM API real (por si el endpoint aparece)
    syncWAMFromAPI().then(map=>{
      if(Object.keys(map).length>0) {
        // Si el WAM API tiene datos, actualizar Supabase masivamente
        Object.entries(map).forEach(([codigo,status])=>{
          const t = terminales.find(t=>t.codigo?.toUpperCase()===codigo)
          if(t?._id) updateWAM(t._id, codigo, status)
        })
        fetchWAMFn() // Refrescar desde Supabase
      }
    })
    const id = setInterval(()=>{
      fetchWAMFn()
      syncWAMFromAPI().then(map=>{
        if(Object.keys(map).length>0){
          Object.entries(map).forEach(([codigo,status])=>{
            const t = terminales.find(t=>t.codigo?.toUpperCase()===codigo)
            if(t?._id) updateWAM(t._id,codigo,status)
          })
          fetchWAMFn()
        }
      })
    }, 60_000)
    return ()=>clearInterval(id)
  },[fetchWAMFn, updateWAM, terminales])
  // conexion: true=conectada, false=desconectada, null=sin datos WAM
  const getConexion = useCallback((t:any) => wam.getConexion(t.codigo), [wam])
  const isOnline    = useCallback((t:any) => getConexion(t) === true, [getConexion])

  // ── Estado UI ──────────────────────────────────────────────────────────────
  const [filtEmp,  setFiltEmp]  = useState<string|null>(isFranq?miEmpNom:null) // null = todas
  const [buscar,   setBuscar]   = useState('')
  const [filtEst,  setFiltEst]  = useState<string|null>(null)
  const [filtMod,  setFiltMod]  = useState<string|null>(null)
  const [filtWAM,  setFiltWAM]  = useState<'todos'|'on'|'off'>('todos')
  const [pagina,   setPagina]   = useState(1)
  const [openId,   setOpenId]   = useState<string|null>(null)
  const [mNueva,   setMNueva]   = useState(false)
  const [mExport,  setMExport]  = useState(false)
  const [mAccion,  setMAcc]     = useState<{a:'estado'|'asignar'|'baja'|'editar';term:any}|null>(null)
  const POR_PAG = 50

  const reload = useCallback(async()=>{ await loadAll(); setMAcc(null); setMNueva(false) },[loadAll])

  // ── Stats globales ─────────────────────────────────────────────────────────
  const empStats = useMemo(()=>{
    const map: Record<string,{total:number;activo:number;conn:number;mods:Record<string,number>;locales:number}> = {}
    empresas.forEach(emp=>{
      const ts = terminales.filter(t=>t.empresa===emp.nombre)
      const mods: Record<string,number>={}
      ts.forEach(t=>{ if(t.modelo) mods[t.modelo]=(mods[t.modelo]||0)+1 })
      const agSet = new Set(ts.map(t=>t.agencia).filter(Boolean))
      map[emp.nombre]={total:ts.length,activo:ts.filter(t=>(t.estado as string)==='ACTIVO').length,conn:ts.filter(t=>isOnline(t)).length,mods,locales:agSet.size}
    })
    return map
  },[terminales,empresas,isOnline])

  // ── Terminales filtradas ───────────────────────────────────────────────────
  const base = useMemo(()=>filtEmp?visibles.filter(t=>t.empresa===filtEmp):visibles,[visibles,filtEmp])

  const filtradas = useMemo(()=>{
    const q = buscar.toLowerCase()
    return base.filter(t=>{
      if(q&&!t.codigo?.toLowerCase().includes(q)&&!t.agencia?.toLowerCase().includes(q)&&!t.empresa?.toLowerCase().includes(q)&&!t.modelo?.toLowerCase().includes(q)) return false
      if(filtEst&&(t.estado as string)!==filtEst) return false
      if(filtMod&&t.modelo!==filtMod) return false
      if(filtWAM==='on'&&getConexion(t)!==true) return false
      if(filtWAM==='off'&&getConexion(t)!==false) return false
      return true
    })
  },[base,buscar,filtEst,filtMod,filtWAM,isOnline])

  const pagTotal = Math.max(1,Math.ceil(filtradas.length/POR_PAG))
  const pagItems = filtradas.slice((pagina-1)*POR_PAG,pagina*POR_PAG)

  // ── KPIs de la empresa/contexto activo ────────────────────────────────────
  const kpis = useMemo(()=>{
    const src = filtEmp?base:visibles
    const activo=src.filter(t=>(t.estado as string)==='ACTIVO').length
    const conn=src.filter(t=>getConexion(t)===true).length
    const desconn=src.filter(t=>(t.estado as string)==='ACTIVO').length-conn
    const mods:Record<string,number>={}
    src.forEach(t=>{if(t.modelo)mods[t.modelo]=(mods[t.modelo]||0)+1})
    return {activo,conn,desconn,mods,total:src.length}
  },[base,visibles,filtEmp,isOnline])

  const empColorFn = (n:string)=>{ const i=empresas.findIndex(e=>e.nombre===n); return EMP_COLS[i>=0?i%EMP_COLS.length:0] }
  const termOpen   = terminales.find(t=>t._id===openId)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',background:'#0a0e1a',minHeight:'100vh',color:'#e8eeff'}}>

      {/* ══ PANEL LATERAL EMPRESAS ══ */}
      <div style={{width:176,flexShrink:0,background:'#0f1629',borderRight:'1px solid #1e2d4a',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{padding:'10px 12px 6px',fontSize:7,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1.5}}>EMPRESAS</div>

        {/* Opción "Todas" */}
        <div onClick={()=>{setFiltEmp(null);setPagina(1);setOpenId(null)}}
          style={{margin:'0 8px 6px',padding:'8px 10px',cursor:'pointer',borderRadius:4,transition:'background .1s',
            background:!filtEmp?'rgba(79,142,247,0.1)':'transparent',
            border:`1px solid ${!filtEmp?'rgba(79,142,247,0.35)':'#1e2d4a'}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
            <span style={{fontSize:10,fontWeight:600,color:!filtEmp?'#4f8ef7':'#7b8db0'}}>Todas</span>
            <span style={{fontSize:14,fontWeight:900,color:!filtEmp?'#4f8ef7':'#7b8db0',fontFamily:'monospace'}}>{visibles.length}</span>
          </div>
          <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>{empresas.length} empresas · {visibles.filter(t=>(t.estado as string)==='ACTIVO').length} activas</div>
        </div>

        {/* Una card por empresa */}
        {empresas.map((emp,i)=>{
          const col   = EMP_COLS[i%EMP_COLS.length]
          const st    = empStats[emp.nombre]||{total:0,activo:0,conn:0,mods:{},locales:0}
          const isSel = filtEmp===emp.nombre
          return (
            <div key={emp._id} onClick={()=>{setFiltEmp(emp.nombre);setPagina(1);setOpenId(null)}}
              style={{margin:'0 8px 6px',padding:'9px 10px',cursor:'pointer',borderRadius:4,transition:'background .1s',
                background:isSel?`${col}10`:'#141d35',
                border:`1px solid ${isSel?col+'45':'#1e2d4a'}`,
                borderLeft:isSel?`3px solid ${col}`:'1px solid #1e2d4a'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:10,fontWeight:600,color:isSel?col:'#e8eeff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{emp.nombre}</span>
                <span style={{fontSize:16,fontWeight:900,color:isSel?col:'#7b8db0',fontFamily:'monospace',marginLeft:6,flexShrink:0}}>{st.total}</span>
              </div>
              {/* Barra de actividad */}
              <div style={{height:3,background:'#1e2d4a',borderRadius:2,overflow:'hidden',marginBottom:5}}>
                <div style={{height:'100%',width:st.total>0?`${(st.activo/st.total*100).toFixed(0)}%`:'0%',background:col,borderRadius:2,transition:'width .4s'}}/>
              </div>
              <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',marginBottom:3}}>{st.locales} locales · {st.activo} activas</div>
              {/* Desglose modelos */}
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {Object.entries(st.mods).filter(([,v])=>v>0).slice(0,3).map(([m,v])=>(
                  <span key={m} style={{fontSize:7,color:MOD_COL[m]||'#7b8db0',background:`${MOD_COL[m]||'#7b8db0'}12`,border:`1px solid ${MOD_COL[m]||'#7b8db0'}30`,padding:'1px 5px',fontFamily:'monospace'}}>
                    {m.replace('BOX ','').replace('SMALL ','S.')} {v}
                  </span>
                ))}
              </div>
              {/* WAM conectadas */}
              {isSel&&<div style={{display:'flex',alignItems:'center',gap:4,marginTop:5,paddingTop:5,borderTop:`1px solid ${col}20`}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:'#00e5a0'}}/>
                <span style={{fontSize:7,color:'#00e5a0',fontFamily:'monospace'}}>{st.conn} conectadas</span>
              </div>}
            </div>
          )
        })}

        {/* Botones abajo */}
        <div style={{marginTop:'auto',padding:'8px'}}>
          <button onClick={()=>setMExport(true)}
            style={{width:'100%',padding:'8px',marginBottom:5,background:'rgba(79,142,247,0.1)',border:'1px solid rgba(79,142,247,0.3)',color:'#4f8ef7',fontSize:10,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
            Exportar CSV
          </button>
          {isAdmin&&<button onClick={()=>setMNueva(true)}
            style={{width:'100%',padding:'8px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',color:'#00e5a0',fontSize:10,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva terminal
          </button>}
        </div>
      </div>

      {/* ══ CONTENIDO PRINCIPAL ══ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* KPIs empresa/contexto activo */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:1,flexShrink:0}}>
          <div style={{background:'#0f1629',borderBottom:'3px solid #f7931a',padding:'12px 18px',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:18,color:'#f7931a',lineHeight:1}}>⚡</span>
            <div><div style={{fontSize:30,fontWeight:900,color:'#f7931a',fontFamily:'monospace',lineHeight:1}}>{loaded?kpis.activo:'—'}</div><div style={{fontSize:7,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.5,marginTop:3}}>EN PRODUCCIÓN</div></div>
          </div>
          <div style={{background:'#0f1629',borderBottom:'3px solid #00e5a0',padding:'12px 18px',display:'flex',alignItems:'center',gap:12}}>
            <div style={{position:'relative',width:20,height:20,flexShrink:0}}>
              <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(0,229,160,0.25)',animation:'pulse 2s infinite'}}/>
              <div style={{position:'absolute',inset:4,borderRadius:'50%',background:'#00e5a0'}}/>
              <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.6);opacity:0}}`}</style>
            </div>
            <div><div style={{fontSize:30,fontWeight:900,color:'#00e5a0',fontFamily:'monospace',lineHeight:1}}>{loaded?kpis.conn:'—'}</div><div style={{fontSize:7,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.5,marginTop:3}}>CONECTADAS WAM</div></div>
          </div>
          <div style={{background:'#0f1629',borderBottom:'3px solid #3d4f73',padding:'12px 18px',display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:'#1e2d4a',border:'2px solid #3d4f73',flexShrink:0}}/>
            <div><div style={{fontSize:30,fontWeight:900,color:'#3d4f73',fontFamily:'monospace',lineHeight:1}}>{loaded?kpis.desconn:'—'}</div><div style={{fontSize:7,color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.5,marginTop:3}}>DESCONECTADAS</div></div>
          </div>
          {/* Chips de modelos */}
          <div style={{background:'#0f1629',borderBottom:'3px solid #1e2d4a',padding:'10px 14px',display:'flex',flexDirection:'column',justifyContent:'center',gap:4,minWidth:180}}>
            <div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1,marginBottom:2}}>{filtEmp||'FLOTA TOTAL'} · MODELOS</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {Object.entries(kpis.mods).filter(([,v])=>v>0).map(([m,v])=>(
                <span key={m} onClick={()=>{setFiltMod(filtMod===m?null:m);setPagina(1)}}
                  style={{fontSize:8,color:MOD_COL[m]||'#7b8db0',background:`${MOD_COL[m]||'#7b8db0'}14`,border:`1px solid ${(filtMod===m?MOD_COL[m]||'#7b8db0':MOD_COL[m]||'#7b8db0')+'50'}`,padding:'2px 8px',cursor:'pointer',fontFamily:'monospace',fontWeight:700,outline:filtMod===m?`1px solid ${MOD_COL[m]||'#7b8db0'}`:'none'}}>
                  {m.replace('BOX ','').replace('SMALL ','S.')} {v}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{display:'flex',gap:7,padding:'8px 12px',background:'#0f1629',borderBottom:'1px solid #1e2d4a',alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:160,position:'relative'}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3d4f73" strokeWidth="2" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={buscar} onChange={e=>{setBuscar(e.target.value);setPagina(1);setOpenId(null)}} placeholder="Buscar código, agencia, empresa..." style={{...inp,width:'100%',paddingLeft:27}}/>
          </div>
          {/* Dropdowns */}
          {[
            {label:'Estado',val:filtEst||'',opts:[['','Todos los estados'],...TODOS_EST.map(e=>[e,EST[e]?.label||e])],set:(v:string)=>{setFiltEst(v||null);setPagina(1);setOpenId(null)}},
            {label:'Modelo',val:filtMod||'',opts:[['','Todos'],...MODELOS_DB.map(m=>[m,m])],set:(v:string)=>{setFiltMod(v||null);setPagina(1);setOpenId(null)}},
            {label:'Conexión',val:filtWAM,opts:[['todos','Todas'],['on','Conectadas'],['off','Desconect.']],set:(v:string)=>{setFiltWAM(v as any);setPagina(1);setOpenId(null)}},
          ].map(f=>(
            <div key={f.label} style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1}}>{f.label.toUpperCase()}</span>
              <select value={f.val} onChange={e=>f.set(e.target.value)} style={{...selStyle,maxWidth:130,fontSize:10,padding:'5px 8px'}}>
                {f.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          {(buscar||filtEst||filtMod||filtWAM!=='todos')&&(
            <button onClick={()=>{setBuscar('');setFiltEst(null);setFiltMod(null);setFiltWAM('todos');setPagina(1);setOpenId(null)}}
              style={{padding:'5px 10px',background:'transparent',border:'1px solid rgba(247,37,100,0.3)',color:'#f72564',fontSize:10,cursor:'pointer'}}>
              ✕ Limpiar
            </button>
          )}
          <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginLeft:'auto'}}>{filtradas.length}/{visibles.length} terminales</span>
        </div>

        {/* Tabla */}
        <div style={{flex:1,overflowY:'auto'}}>
          {/* Header tabla */}
          <div style={{display:'grid',gridTemplateColumns:'160px 110px 145px 1fr minmax(180px,1.5fr) 90px 110px',padding:'6px 14px',background:'#050810',borderBottom:'1px solid #1e2d4a',position:'sticky',top:0,zIndex:10}}>
            {['CÓDIGO','MODELO','ESTADO','EMPRESA · SUCURSAL','AGENCIA · DIRECCIÓN','WAM','ACCIONES'].map((h,i)=>(
              <span key={i} style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1.2}}>{h}</span>
            ))}
          </div>

          {!loaded?(
            <div style={{padding:'50px',textAlign:'center',fontSize:11,color:'#3d4f73',fontFamily:'monospace'}}>Cargando terminales...</div>
          ):filtradas.length===0?(
            <div style={{padding:'50px',textAlign:'center'}}>
              <p style={{fontSize:11,color:'#3d4f73',fontFamily:'monospace',marginBottom:10}}>Sin resultados</p>
              <button onClick={()=>{setBuscar('');setFiltEst(null);setFiltMod(null);setFiltWAM('todos');setPagina(1)}} style={{padding:'5px 14px',background:'transparent',border:'1px solid #1e2d4a',color:'#7b8db0',fontSize:10,cursor:'pointer'}}>Limpiar filtros</button>
            </div>
          ):pagItems.map(t=>{
            const em    = EST[t.estado as string]||{color:'#3d4f73',bg:'rgba(61,79,115,0.2)',label:t.estado}
            const ec    = empColorFn(t.empresa)
            const mc    = MOD_COL[t.modelo]||'#4f8ef7'

            const isSel = openId===t._id
            const agRow = agencias.find((a:any)=>a._id===t.agencia_id||a.id_sub===t.id_sub)

            return (
              <div key={t._id} onClick={()=>setOpenId(prev=>prev===t._id?null:(t._id||''))}
                style={{display:'grid',gridTemplateColumns:'160px 110px 145px 1fr minmax(180px,1.5fr) 90px 110px',
                  padding:'8px 14px',borderBottom:`1px solid ${isSel?'rgba(79,142,247,0.2)':'#141d35'}`,
                  borderLeft:isSel?'3px solid #4f8ef7':'3px solid transparent',
                  background:isSel?'rgba(79,142,247,0.05)':'transparent',
                  cursor:'pointer',transition:'background .08s',alignItems:'center'}}
                onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.02)'}}
                onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.background='transparent'}}>

                {/* Código */}
                <div style={{display:'flex',alignItems:'center',gap:6,overflow:'hidden'}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                  <span style={{fontSize:10,fontWeight:700,color:isSel?'#4f8ef7':'#00e5a0',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.codigo}</span>
                </div>

                {/* Modelo */}
                <span style={{fontSize:9,fontWeight:700,color:mc,fontFamily:'monospace'}}>{t.modelo||'—'}</span>

                {/* Estado badge */}
                <span style={{fontSize:8,color:em.color,background:em.bg,padding:'2px 8px',fontFamily:'monospace',fontWeight:700,whiteSpace:'nowrap'}}>{em.label}</span>

                {/* Empresa · Sucursal */}
                <div style={{display:'flex',alignItems:'center',gap:5,overflow:'hidden'}}>
                  <div style={{width:5,height:5,borderRadius:1,background:ec,flexShrink:0}}/>
                  <span style={{fontSize:9,color:'#e8eeff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.empresa||'—'}</span>
                  {t.sucursal&&<span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',flexShrink:0}}>/ {t.sucursal}</span>}
                </div>

                {/* Agencia · Dirección */}
                <div style={{overflow:'hidden'}}>
                  {t.agencia?(
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:9,color:'#7b8db0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{t.agencia}</span>
                    </div>
                  ):<span style={{fontSize:9,color:'#3d4f73',fontStyle:'italic'}}>Sin agencia</span>}
                  {agRow?.direccion&&<span style={{fontSize:8,color:'#3d4f73',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={agRow.direccion}>{agRow.direccion}</span>}
                </div>

                {/* WAM */}
                {(() => {
                  const cx = getConexion(t)
                  const wc2 = cx===true?'#00e5a0':cx===false?'#f72564':'#3d4f73'
                  const wl2 = cx===true?'Conectada':cx===false?'Desconectada':'Sin datos'
                  return (
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:wc2,flexShrink:0}}/>
                      <span style={{fontSize:8,color:wc2,fontFamily:'monospace',fontWeight:600,whiteSpace:'nowrap'}}>{wl2}</span>
                    </div>
                  )
                })()}

                {/* Acciones */}
                {isAdmin&&(
                  <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                    <button title="Editar" onClick={()=>setMAcc({a:'editar',term:t})} style={{width:24,height:24,background:'rgba(124,92,252,0.12)',border:'1px solid rgba(124,92,252,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#7c5cfc'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button title="Asignar" onClick={()=>setMAcc({a:'asignar',term:t})} style={{width:24,height:24,background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#00e5a0'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                    </button>
                    <button title="Estado" onClick={()=>setMAcc({a:'estado',term:t})} style={{width:24,height:24,background:'rgba(247,147,26,0.1)',border:'1px solid rgba(247,147,26,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#f7931a'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    </button>
                    {(t.estado as string)!=='BAJA'&&<button title="Baja" onClick={()=>setMAcc({a:'baja',term:t})} style={{width:24,height:24,background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#f72564'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Paginación */}
        {filtradas.length>0&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',borderTop:'1px solid #141d35',background:'#050810',flexShrink:0}}>
            <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>{filtradas.length} resultado{filtradas.length!==1?'s':''} · pág {pagina}/{pagTotal}</span>
            <div style={{display:'flex',gap:4}}>
              {[['«',()=>setPagina(1)],['‹',()=>setPagina(p=>Math.max(1,p-1))],...Array.from({length:Math.min(5,pagTotal)},(_,i)=>{let p=pagina<=3?i+1:pagTotal-pagina<2?pagTotal-4+i:pagina-2+i;return p<1||p>pagTotal?null:[String(p),()=>setPagina(p)]}).filter(Boolean),['›',()=>setPagina(p=>Math.min(pagTotal,p+1))],['»',()=>setPagina(pagTotal)]].map((item,i)=>{
                if(!item) return null
                const [label,fn] = item as [string,()=>void]
                const isNum = !isNaN(Number(label))
                const isCurr = isNum && Number(label)===pagina
                return <button key={i} onClick={fn} style={{padding:'3px 8px',background:isCurr?'rgba(79,142,247,0.15)':'transparent',border:`1px solid ${isCurr?'rgba(79,142,247,0.4)':'#1e2d4a'}`,color:isCurr?'#4f8ef7':'#7b8db0',fontSize:9,cursor:'pointer',fontFamily:'monospace'}}>{label}</button>
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ DRAWER ══ */}
      {openId&&termOpen&&(
        <DrawerSciFi term={termOpen} agencias={agencias} empresas={empresas} isAdmin={isAdmin}
          onAccion={a=>setMAcc({a,term:termOpen})} onClose={()=>setOpenId(null)}/>
      )}

      {/* ══ MODALES ══ */}
      {mNueva  && <ModalNueva  agencias={agencias} onClose={()=>setMNueva(false)} onDone={reload}/>}
      {mExport && <ModalExport todos={filtradas}   onClose={()=>setMExport(false)}/>}
      {mAccion && <ModalAccion term={mAccion.term} accion={mAccion.a} agencias={agencias} onClose={()=>setMAcc(null)} onDone={reload}/>}
    </div>
  )
}
