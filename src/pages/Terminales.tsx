import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useTerminalOps } from '../store/terminalOps'

// ── Constantes ────────────────────────────────────────────────────────────────
const EMP_COLS = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']
const EST: Record<string,{color:string;bg:string;label:string}> = {
  'ACTIVO':        { color:'#f7931a', bg:'rgba(247,147,26,0.15)',  label:'EN PRODUCCION' },
  'DISPONIBLE':    { color:'#00e5a0', bg:'rgba(0,229,160,0.15)',   label:'DISPONIBLE'    },
  'NO DISPONIBLE': { color:'#f72564', bg:'rgba(247,37,100,0.15)',  label:'NO DISPONIBLE' },
  'ASIGNADA':      { color:'#4f8ef7', bg:'rgba(79,142,247,0.15)',  label:'ASIGNADA'      },
  'EN REPARACION': { color:'#f7931a', bg:'rgba(247,147,26,0.15)',  label:'EN REPARACION' },
  'BAJA':          { color:'#3d4f73', bg:'rgba(61,79,115,0.2)',    label:'BAJA'          },
}
const MOD_COLOR: Record<string,string> = {
  'WALL':'#4f8ef7','SMALL WALL':'#7c5cfc','TOTEM':'#f7931a',
  'BOX SIMPLE':'#f7931a','BOXDUAL':'#f7931a','BOX DUAL':'#f7931a',
}
const ESTADO_ROWS = [
  { key:'ACTIVO',        label:'EN PRODUCCIÓN', ico:'⚡', color:'#f7931a' },
  { key:'DISPONIBLE',    label:'DISPONIBLES',   ico:'✓',  color:'#00e5a0' },
  { key:'NO DISPONIBLE', label:'NO DISPONIBLE', ico:'⚠',  color:'#f72564' },
  { key:'ASIGNADA',      label:'EN ALMACÉN',    ico:'📦', color:'#4f8ef7' },
  { key:'EN REPARACION', label:'EN REPARACIÓN', ico:'🔧', color:'#f7931a' },
  { key:'BAJA',          label:'BAJA',          ico:'✕',  color:'#3d4f73' },
]
const MODELOS_DB = ['TOTEM','WALL','SMALL WALL','BOX SIMPLE','BOXDUAL']
const TODOS_EST  = ['DISPONIBLE','ASIGNADA','ACTIVO','NO DISPONIBLE','EN REPARACION','BAJA'] as const

const S = {
  page: { padding:'0', background:'#0a0e1a', minHeight:'100vh', color:'#e8eeff' } as React.CSSProperties,
  inp:  { background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8,
          padding:'8px 12px', fontSize:12, color:'#e8eeff', outline:'none',
          fontFamily:'system-ui' } as React.CSSProperties,
  chip: (on:boolean, c='#4f8ef7') => ({
    padding:'3px 10px', borderRadius:6, fontSize:8, fontFamily:'monospace',
    cursor:'pointer', border:'1px solid', fontWeight:600, transition:'all .12s',
    background: on?`${c}18`:'transparent', borderColor:on?`${c}50`:'#1e2d4a', color:on?c:'#7b8db0',
  } as React.CSSProperties),
  modal: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.85)',
           display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
  mbox: (w=480) => ({ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:14,
    padding:'22px 24px', width:w, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto' as const }),
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV(rows: any[], filename: string) {
  const H = ['Código','Modelo','Estado','Empresa','Sucursal','Agencia','Serie','Observación']
  const lines = rows.map(t=>[t.codigo,t.modelo,t.estado,t.empresa||'',t.sucursal||'',t.agencia||'',t.serie||'',t.observacion||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))
  const csv  = [H.join(','),...lines].join('\n')
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Modal Exportar ────────────────────────────────────────────────────────────
function ModalExport({ todos, onClose }: { todos:any[]; onClose:()=>void }) {
  const [sel, setSel] = useState<Set<string>>(new Set(['todos']))
  const toggle = (k:string) => {
    if (k==='todos') { setSel(new Set(['todos'])); return }
    const n = new Set(sel)
    n.delete('todos')
    n.has(k) ? n.delete(k) : n.add(k)
    if (n.size===0) n.add('todos')
    setSel(n)
  }
  const rows = sel.has('todos') ? todos : todos.filter(t=>sel.has(t.estado as string))
  const ts   = new Date().toISOString().slice(0,10)
  const name = `terminales_${sel.has('todos')?'todas':[...sel].join('-')}_${ts}.csv`
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(420)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>Exportar terminales</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
        </div>
        <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:10}}>SELECCIONAR ESTADOS A EXPORTAR</div>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:16}}>
          <label style={{display:'flex',alignItems:'center',gap:9,cursor:'pointer',padding:'8px 11px',background:sel.has('todos')?'rgba(79,142,247,0.08)':'#141d35',border:`1px solid ${sel.has('todos')?'rgba(79,142,247,0.35)':'#1e2d4a'}`,borderRadius:8}} onClick={()=>toggle('todos')}>
            <div style={{width:14,height:14,borderRadius:3,background:sel.has('todos')?'#4f8ef7':'transparent',border:`1px solid ${sel.has('todos')?'#4f8ef7':'#1e2d4a'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {sel.has('todos')&&<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5"><polyline points="1.5 5 4 7.5 8.5 2"/></svg>}
            </div>
            <span style={{fontSize:10,color:sel.has('todos')?'#e8eeff':'#7b8db0',fontWeight:600}}>Todos los estados</span>
            <span style={{marginLeft:'auto',fontSize:10,color:'#4f8ef7',fontFamily:'monospace',fontWeight:700}}>{todos.length}</span>
          </label>
          {TODOS_EST.map(e=>{
            const em  = EST[e]||{color:'#3d4f73',label:e}
            const cnt = todos.filter(t=>(t.estado as string)===e).length
            const on  = sel.has(e)
            return (
              <label key={e} style={{display:'flex',alignItems:'center',gap:9,cursor:'pointer',padding:'8px 11px',background:on?`${em.color}10`:'#141d35',border:`1px solid ${on?em.color+'40':'#1e2d4a'}`,borderRadius:8}} onClick={()=>toggle(e)}>
                <div style={{width:14,height:14,borderRadius:3,background:on?em.color:'transparent',border:`1px solid ${on?em.color:'#1e2d4a'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {on&&<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5"><polyline points="1.5 5 4 7.5 8.5 2"/></svg>}
                </div>
                <div style={{width:7,height:7,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                <span style={{fontSize:10,color:on?em.color:'#7b8db0',fontWeight:600}}>{em.label}</span>
                <span style={{marginLeft:'auto',fontSize:10,color:on?em.color:'#3d4f73',fontFamily:'monospace',fontWeight:700}}>{cnt}</span>
              </label>
            )
          })}
        </div>
        <div style={{padding:'9px 12px',background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,marginBottom:14}}>
          <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginBottom:2}}>ARCHIVO</div>
          <div style={{fontSize:10,color:'#4f8ef7',fontFamily:'monospace',wordBreak:'break-all'}}>{name}</div>
          <div style={{fontSize:9,color:'#7b8db0',marginTop:3}}>{rows.length} terminales a exportar</div>
        </div>
        <button onClick={()=>{ exportCSV(rows, name); onClose() }}
          style={{width:'100%',padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',
            background:'rgba(79,142,247,0.12)',border:'1px solid rgba(79,142,247,0.4)',color:'#4f8ef7'}}>
          ↓ Descargar CSV
        </button>
      </div>
    </div>
  )
}

// ── Modal Acción ──────────────────────────────────────────────────────────────
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
  const agSel = agencias.find((a:any)=>a._id===agId||String(a.id)===agId)

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

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(accion==='estado'?480:420)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <div><h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>{titulo}</h3>
            <p style={{margin:'3px 0 0',fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>{term.codigo} · {term.modelo}</p></div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
        </div>

        {accion==='estado' && (<>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:8}}>NUEVO ESTADO</div>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
            {TODOS_EST.map(e=>{
              const em=EST[e]||{color:'#3d4f73',bg:'transparent',label:e}
              return (
                <div key={e} onClick={()=>setEst(e)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',borderRadius:9,cursor:'pointer',
                  background:est===e?em.bg:'#141d35',border:`1px solid ${est===e?em.color+'50':'#1e2d4a'}`}}>
                  <div style={{width:9,height:9,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                  <span style={{fontSize:11,fontWeight:600,color:est===e?em.color:'#e8eeff'}}>{e}</span>
                  {est===e&&<div style={{marginLeft:'auto',width:7,height:7,borderRadius:'50%',background:em.color}}/>}
                </div>
              )
            })}
          </div>
          {['EN REPARACION','BAJA','NO DISPONIBLE'].includes(est)&&(<>
            <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>OBSERVACIÓN</div>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="Motivo..."
              style={{...S.inp,resize:'none' as any,width:'100%',marginBottom:10}}/>
          </>)}
          {['DISPONIBLE','NO DISPONIBLE','BAJA'].includes(est)&&(
            <div style={{padding:'7px 11px',background:'rgba(247,147,26,0.07)',border:'1px solid rgba(247,147,26,0.2)',borderRadius:8,fontSize:9,color:'#f7931a',fontFamily:'monospace',marginBottom:10}}>
              ⚠ La agencia asignada será liberada
            </div>
          )}
        </>)}

        {accion==='asignar' && (<>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>AGENCIA DESTINO</div>
          <select value={agId} onChange={e=>setAgId(e.target.value)} style={{...S.inp,appearance:'none' as any,width:'100%',marginBottom:10}}>
            <option value="">Sin asignar (→ DISPONIBLE)</option>
            {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
              <option key={a._id||a.id} value={a._id||a.id}>{a.subagencia} — {a.empresa} — {a.sucursal}</option>
            ))}
          </select>
          {agSel && (
            <div style={{padding:'9px 12px',background:'rgba(79,142,247,0.06)',border:'1px solid rgba(79,142,247,0.2)',borderRadius:9,marginBottom:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                {[{l:'Local',v:agSel.subagencia},{l:'Empresa',v:agSel.empresa},{l:'Dpto.',v:agSel.sucursal},{l:'Estado',v:agSel.estado}].map((f,i)=>(
                  <div key={i}><div style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace'}}>{f.l}</div><div style={{fontSize:10,color:'#e8eeff'}}>{f.v||'—'}</div></div>
                ))}
              </div>
            </div>
          )}
          <div style={{padding:'7px 11px',background:agId?'rgba(79,142,247,0.06)':'rgba(0,229,160,0.06)',
            border:`1px solid ${agId?'rgba(79,142,247,0.2)':'rgba(0,229,160,0.2)'}`,borderRadius:8,
            fontSize:9,color:agId?'#4f8ef7':'#00e5a0',fontFamily:'monospace',marginBottom:12}}>
            {agId?'Estado resultante: ASIGNADA':'Sin agencia = DISPONIBLE (stock)'}
          </div>
        </>)}

        {accion==='baja' && (<>
          <div style={{padding:'10px 13px',background:'rgba(247,37,100,0.06)',border:'1px solid rgba(247,37,100,0.18)',borderRadius:9,marginBottom:12}}>
            <div style={{fontSize:11,color:'#f72564',fontWeight:600}}>Acción irreversible</div>
            <div style={{fontSize:10,color:'#7b8db0',marginTop:3}}>La terminal quedará BAJA y se desvinculará de su agencia.</div>
          </div>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>MOTIVO *</div>
          <textarea value={motivo} onChange={e=>setMot(e.target.value)} rows={3} placeholder="Describe el motivo..."
            style={{...S.inp,resize:'none' as any,width:'100%',marginBottom:12}}/>
        </>)}

        {err&&<div style={{padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564',marginBottom:10}}>{err}</div>}
        {ok
          ? <div style={{padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ Cambio aplicado</div>
          : <button onClick={handle} disabled={saving||(accion==='baja'&&!motivo.trim())}
              style={{width:'100%',padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:`${btnColor}12`,border:`1px solid ${btnColor}40`,color:saving?'#3d4f73':btnColor,
                opacity:(accion==='baja'&&!motivo.trim())?.5:1}}>
              {saving?'Guardando...':titulo}
            </button>}
      </div>
    </div>
  )
}

// ── Modal Nueva ───────────────────────────────────────────────────────────────
function ModalNueva({ agencias, onClose, onDone }: { agencias:any[]; onClose:()=>void; onDone:()=>void }) {
  const { crear, crearBatch } = useTerminalOps()
  const [modo,   setModo] = useState<'uno'|'lote'>('uno')
  const [codigo, setCod]  = useState('')
  const [modelo, setMod]  = useState('BOXDUAL')
  const [serie,  setSer]  = useState('')
  const [agId,   setAg]   = useState('')
  const [obs,    setObs]  = useState('')
  const [pref,   setPref] = useState('WLLELG-E')
  const [desde,  setDsd]  = useState(246)
  const [hasta,  setHst]  = useState(250)
  const [saving, setSav]  = useState(false)
  const [err,    setErr]  = useState('')
  const [ok,     setOk]   = useState(false)

  const handleUno = async () => {
    if(!codigo.trim()){setErr('Ingresa el código');return}
    setSav(true); setErr('')
    const res = await crear({codigo,modelo:modelo as any,serie:serie,agencia_id:agId||null,estado:agId?'ASIGNADA':'DISPONIBLE',observacion:obs})
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
  const prev = Array.from({length:Math.min(3,hasta-desde+1)},(_,i)=>`${pref}${String(desde+i).padStart(4,'0')}`).join(', ')+(hasta-desde+1>3?'...':'')

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
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>CÓDIGO *</div>
              <input value={codigo} onChange={e=>setCod(e.target.value.toUpperCase())} placeholder="WLLELG-E0246" style={{...S.inp,width:'100%'}}/></div>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>SERIE</div>
              <input value={serie} onChange={e=>setSer(e.target.value)} placeholder="Núm. serie" style={{...S.inp,width:'100%'}}/></div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>AGENCIA (opcional)</div>
            <select value={agId} onChange={e=>setAg(e.target.value)} style={{...S.inp,appearance:'none' as any,width:'100%'}}>
              <option value="">Sin asignar (DISPONIBLE)</option>
              {agencias.filter((a:any)=>a.estado==='EN PRODUCCION').map((a:any)=>(
                <option key={a._id} value={a._id||a.id}>{a.subagencia} — {a.empresa}</option>
              ))}
            </select>
          </div>
          <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>OBSERVACIONES</div>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="Notas..." style={{...S.inp,resize:'none' as any,width:'100%'}}/></div>
        </>):(<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 80px 80px',gap:8,marginBottom:10}}>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>PREFIJO</div>
              <input value={pref} onChange={e=>setPref(e.target.value.toUpperCase())} style={{...S.inp,width:'100%'}}/></div>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>DESDE</div>
              <input type="number" value={desde} min={1} onChange={e=>setDsd(Number(e.target.value))} style={{...S.inp,width:'100%'}}/></div>
            <div><div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>HASTA</div>
              <input type="number" value={hasta} min={desde} onChange={e=>setHst(Number(e.target.value))} style={{...S.inp,width:'100%'}}/></div>
          </div>
          <div style={{padding:'9px 12px',background:'#141d35',border:'1px solid #1e2d4a',borderRadius:8,marginBottom:12}}>
            <div style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace',marginBottom:3}}>PREVIEW · {hasta-desde+1} terminales · estado: DISPONIBLE</div>
            <div style={{fontSize:10,color:'#7c5cfc',fontFamily:'monospace'}}>{prev}</div>
          </div>
        </>)}
        {err&&<div style={{marginTop:10,padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564'}}>{err}</div>}
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

// ── Detalle inline expandido ──────────────────────────────────────────────────
// ── Modal Editar Terminal ────────────────────────────────────────────────────
function ModalEditar({ term, onClose, onDone }: { term:any; onClose:()=>void; onDone:()=>void }) {
  const { actualizar } = useTerminalOps()
  const [codigo,  setCod]  = useState(term.codigo||'')
  const [serie,   setSer]  = useState(term.serie||'')
  const [obs,     setObs]  = useState(term.observacion||'')
  const [modelo,  setMod]  = useState(term.modelo||'BOXDUAL')
  const [saving,  setSav]  = useState(false)
  const [ok,      setOk]   = useState(false)
  const [err,     setErr]  = useState('')

  const handle = async () => {
    if (!codigo.trim()) { setErr('El código es obligatorio'); return }
    setSav(true); setErr('')
    const res = await actualizar(term._id||term.id, {
      codigo:      codigo.trim().toUpperCase(),
      serie:       serie.trim()||undefined,
      observacion: obs.trim()||undefined,
      modelo:      modelo as any,
    })
    setSav(false)
    if (res.ok) { setOk(true); setTimeout(onDone, 1200) } else setErr(res.error||'Error al guardar')
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.mbox(460)} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#e8eeff'}}>Editar terminal</h3>
            <p style={{margin:'3px 0 0',fontSize:10,color:'#7b8db0',fontFamily:'monospace'}}>{term.codigo}</p>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3d4f73',cursor:'pointer',fontSize:18}}>✕</button>
        </div>

        {/* Modelo */}
        <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:6}}>MODELO</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginBottom:14}}>
          {MODELOS_DB.map(m=>(
            <div key={m} onClick={()=>setMod(m)} style={{padding:'7px 6px',borderRadius:8,cursor:'pointer',textAlign:'center',
              background:modelo===m?'rgba(247,147,26,0.12)':'#141d35',
              border:`1px solid ${modelo===m?'rgba(247,147,26,0.45)':'#1e2d4a'}`}}>
              <div style={{fontSize:9,fontWeight:700,color:modelo===m?'#f7931a':'#7b8db0'}}>{m}</div>
            </div>
          ))}
        </div>

        {/* Código */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>CÓDIGO *</div>
          <input value={codigo} onChange={e=>setCod(e.target.value.toUpperCase())}
            placeholder="WLLELG-E0001" style={{...S.inp,width:'100%'}}/>
        </div>

        {/* Serie */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>NÚMERO DE SERIE</div>
          <input value={serie} onChange={e=>setSer(e.target.value)}
            placeholder="Número de serie del equipo..." style={{...S.inp,width:'100%'}}/>
        </div>

        {/* Observaciones */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,color:'#7b8db0',fontFamily:'monospace',marginBottom:5}}>OBSERVACIONES</div>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3}
            placeholder="Notas adicionales sobre la terminal..."
            style={{...S.inp,width:'100%',resize:'none' as any}}/>
        </div>

        {err && <div style={{padding:'8px 12px',background:'rgba(247,37,100,0.08)',border:'1px solid rgba(247,37,100,0.2)',borderRadius:8,fontSize:11,color:'#f72564',marginBottom:12}}>{err}</div>}

        {ok
          ? <div style={{padding:'10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:9,textAlign:'center',fontSize:12,color:'#00e5a0'}}>✓ Terminal actualizada correctamente</div>
          : <button onClick={handle} disabled={saving}
              style={{width:'100%',padding:'11px',borderRadius:9,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:saving?'#1e2d4a':'rgba(247,147,26,0.12)',border:`1px solid ${saving?'#1e2d4a':'rgba(247,147,26,0.4)'}`,
                color:saving?'#3d4f73':'#f7931a'}}>
              {saving?'Guardando...':'Guardar cambios'}
            </button>}
      </div>
    </div>
  )
}

// ── Sección label con línea decorativa ───────────────────────────────────────
function SecLabel({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
      <div style={{ width:14, height:1, background:color, flexShrink:0 }}/>
      <span style={{ fontSize:8, color, fontFamily:'monospace', fontWeight:700, letterSpacing:1.8 }}>{label}</span>
    </div>
  )
}

// ── Drawer sci-fi ─────────────────────────────────────────────────────────────
function DrawerSciFi({ term, agencias, empresas, isAdmin, onAccion, onClose }: {
  term: any; agencias: any[]; empresas: any[]; isAdmin: boolean;
  onAccion: (accion:'estado'|'asignar'|'baja'|'editar', term:any) => void;
  onClose: () => void;
}) {
  const agDet    = agencias.find(a => a.id_sub === term.id_sub)
  const empIdx   = empresas.findIndex(e => e.nombre === term.empresa)
  const empCol   = EMP_COLS[empIdx >= 0 ? empIdx % EMP_COLS.length : 0]
  const estDet   = EST[term.estado as string] || { color:'#00e5a0', bg:'rgba(0,229,160,0.1)', label: term.estado }
  const modCol   = MOD_COLOR[term.modelo] || '#4f8ef7'
  const stColor  = estDet.color

  const historial = [
    { ev:'Estado cambiado',  det: estDet.label,                              color:'#00e5a0', ts:'Hoy 09:14',  by:'Admin'   },
    { ev:'Agencia asignada', det: agDet ? agDet.subagencia : 'Sin agencia', color:'#4f8ef7', ts:'Hace 5d',    by:'Admin'   },
    { ev:'Terminal creada',  det: 'Registrada en sistema',                  color:'#7c5cfc', ts:'Hace 12d',   by:'Sistema' },
  ]

  return (
    <>
      {/* Overlay oscuro sobre la tabla */}
      <div onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(5,8,16,0.68)', zIndex:200,
          animation:'fadeIn .18s ease' }}/>

      {/* Drawer */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'30%', zIndex:201,
        clipPath:'polygon(32px 0, 100% 0, 100% 100%, 0 100%, 0 32px)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        animation:'slideIn .22s cubic-bezier(.16,1,.3,1)',
      }}>
        {/* Fondo sólido */}
        <div style={{ position:'absolute', inset:0, background:'#0d1120' }}/>

        {/* Borde izquierdo + superior con color del estado */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          borderLeft:`1px solid ${stColor}55`, borderTop:`1px solid ${stColor}55` }}/>

        {/* Esquina diagonal SVG decorativa */}
        <svg style={{ position:'absolute', top:0, left:0, width:34, height:34, zIndex:2, pointerEvents:'none' }}
          viewBox="0 0 34 34">
          <line x1="1" y1="33" x2="33" y2="1" stroke={stColor} strokeWidth="1" opacity="0.7"/>
          <line x1="1" y1="26" x2="26" y2="1" stroke={stColor} strokeWidth="0.4" opacity="0.3"/>
        </svg>

        {/* Línea de neón superior */}
        <div style={{ position:'absolute', top:0, left:32, right:0, height:1,
          background:`linear-gradient(90deg,${stColor},${stColor}66,transparent)`, zIndex:2 }}/>

        {/* Contenido */}
        <div style={{ position:'relative', zIndex:3, display:'flex', flexDirection:'column', height:'100%' }}>

          {/* ── HEADER ── */}
          <div style={{ padding:'12px 18px 10px 40px', borderBottom:`1px solid ${stColor}18`, flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>

              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                {/* Ícono de terminal en box cuadrado */}
                <div style={{ width:38, height:38, border:`1px solid ${stColor}45`,
                  background:`${stColor}0c`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stColor} strokeWidth="1.5" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:8, color:stColor, fontFamily:'monospace', letterSpacing:2, marginBottom:4 }}>
                    TERMINAL ///
                  </div>
                  <div style={{ fontSize:15, fontWeight:900, color:'#e8eeff', fontFamily:'monospace',
                    letterSpacing:1, lineHeight:1 }}>
                    {term.codigo}
                  </div>
                </div>
              </div>

              {/* Cerrar */}
              <button onClick={onClose}
                style={{ width:28, height:28, border:`1px solid ${stColor}35`,
                  background:`${stColor}08`, display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', color:stColor, fontSize:14, flexShrink:0 }}>
                ✕
              </button>
            </div>

            {/* Badges */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:8, color:stColor, background:`${stColor}14`,
                border:`1px solid ${stColor}40`, padding:'3px 10px',
                fontFamily:'monospace', fontWeight:700 }}>
                ● {estDet.label}
              </span>
              <span style={{ fontSize:8, color:modCol, background:`${modCol}12`,
                border:`1px solid ${modCol}35`, padding:'3px 10px',
                fontFamily:'monospace', fontWeight:700 }}>
                {term.modelo || '—'}
              </span>
              {term.empresa && (
                <span style={{ fontSize:8, color:empCol, background:`${empCol}10`,
                  border:`1px solid ${empCol}30`, padding:'3px 10px',
                  fontFamily:'monospace' }}>
                  {term.empresa}
                </span>
              )}
            </div>
          </div>

          {/* ── CUERPO scrollable ── */}
          <div style={{ flex:1, overflowY:'auto', padding:'10px 18px', display:'flex', flexDirection:'column', gap:12 }}>

            {/* DATOS */}
            <div>
              <SecLabel label="DATOS DE LA TERMINAL" color="#4f8ef7"/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {[
                  { l:'MODELO',  v:term.modelo||'—',   c:modCol   },
                  { l:'SERIE',   v:term.serie||'—',     c:'#e8eeff'},
                  { l:'ESTADO',  v:estDet.label,        c:stColor  },
                  { l:'EMPRESA', v:term.empresa||'—',   c:empCol   },
                  { l:'SUCURSAL',v:term.sucursal||'—',  c:'#e8eeff'},
                  { l:'CÓDIGO',  v:term.codigo,         c:'#00e5a0', mono:true },
                ].map((f,i) => (
                  <div key={i} style={{ background:'#141d35', border:'1px solid #1e2d4a', padding:'8px 11px',
                    borderLeft:i===2?`2px solid ${stColor}`:undefined }}>
                    <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:3 }}>{f.l}</div>
                    <div style={{ fontSize:10, color:f.c, fontFamily:f.mono?'monospace':'system-ui',
                      fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                      {f.v}
                    </div>
                  </div>
                ))}
              </div>
              {term.observacion && (
                <div style={{ marginTop:6, background:'#141d35', border:'1px solid #1e2d4a', padding:'8px 11px' }}>
                  <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:2 }}>OBSERVACIÓN</div>
                  <div style={{ fontSize:10, color:'#7b8db0', lineHeight:1.5 }}>{term.observacion}</div>
                </div>
              )}
            </div>

            {/* AGENCIA */}
            <div>
              <SecLabel label="AGENCIA ASIGNADA" color="#7c5cfc"/>
              {agDet ? (
                <div style={{ background:'rgba(124,92,252,0.05)', border:'1px solid rgba(124,92,252,0.2)', padding:'12px 14px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    {[
                      { l:'LOCAL',      v:agDet.subagencia },
                      { l:'DEPARTAMENTO',v:agDet.sucursal  },
                      { l:'ENCARGADO',  v:agDet.encargado||'—' },
                      { l:'ESTADO',     v:agDet.estado, color: agDet.estado==='EN PRODUCCION'?'#00e5a0':'#f7931a' },
                    ].map((f,i) => (
                      <div key={i}>
                        <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:2 }}>{f.l}</div>
                        <div style={{ fontSize:10, color:(f as any).color||'#e8eeff' }}>{f.v||'—'}</div>
                      </div>
                    ))}
                  </div>
                  {agDet.correo && (
                    <div style={{ paddingTop:8, borderTop:'1px solid rgba(124,92,252,0.15)' }}>
                      <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:2 }}>CORREO</div>
                      <div style={{ fontSize:10, color:'#4f8ef7' }}>{agDet.correo}</div>
                    </div>
                  )}
                  {agDet.direccion && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:2 }}>DIRECCIÓN</div>
                      <div style={{ fontSize:10, color:'#7b8db0', lineHeight:1.4 }}>{agDet.direccion}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background:'rgba(0,229,160,0.04)', border:'1px solid rgba(0,229,160,0.18)',
                  padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <div style={{ width:40, height:40, border:'1px solid rgba(0,229,160,0.3)',
                    background:'rgba(0,229,160,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="1.5">
                      <path d="M2 7l10-5 10 5M2 7v10l10 5 10-5V7"/>
                    </svg>
                  </div>
                  <div style={{ fontSize:10, color:'#00e5a0', fontFamily:'monospace', fontWeight:700 }}>DISPONIBLE · EN STOCK</div>
                  <div style={{ fontSize:9, color:'#3d4f73', textAlign:'center' }}>Lista para asignar a una agencia</div>
                </div>
              )}
            </div>

            {/* HISTORIAL */}
            <div>
              <SecLabel label="HISTORIAL DE ACTIVIDAD" color="#f7931a"/>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {historial.map((h, i) => (
                  <div key={i} style={{ background:'#141d35',
                    borderLeft:`2px solid ${h.color}`, padding:'9px 12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:h.color }}>{h.ev}</div>
                      <div style={{ textAlign:'right', flexShrink:0, marginLeft:10 }}>
                        <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>{h.ts}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:9, color:'#7b8db0', marginBottom:3 }}>{h.det}</div>
                    <div style={{ fontSize:8, color:'#4f8ef7', fontFamily:'monospace' }}>por {h.by}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── ACCIONES fijas al fondo ── */}
          {isAdmin && (
            <div style={{ padding:'9px 18px', borderTop:`1px solid ${stColor}18`,
              flexShrink:0, background:'rgba(5,8,16,0.8)' }}>
              <SecLabel label="ACCIONES" color="#7b8db0"/>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <button onClick={() => onAccion('editar', term)}
                  style={{ padding:'9px', background:'rgba(124,92,252,0.08)', border:'1px solid rgba(124,92,252,0.3)',
                    color:'#7c5cfc', fontSize:10, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                  Editar terminal
                </button>
                <button onClick={() => onAccion('asignar', term)}
                  style={{ padding:'9px', background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.3)',
                    color:'#00e5a0', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                  {agDet ? 'Reasignar agencia' : 'Asignar agencia'}
                </button>
                <button onClick={() => onAccion('estado', term)}
                  style={{ padding:'9px', background:'rgba(247,147,26,0.08)', border:'1px solid rgba(247,147,26,0.3)',
                    color:'#f7931a', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                  Cambiar estado
                </button>
              </div>
                {(term.estado as string) !== 'BAJA' && (
                  <button onClick={() => onAccion('baja', term)}
                    style={{ width:'100%', padding:'9px', background:'rgba(247,37,100,0.06)',
                      border:'1px solid rgba(247,37,100,0.22)', color:'#f72564',
                      fontSize:10, fontWeight:700, cursor:'pointer' }}>
                    Dar de baja terminal
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes slideIn { from { transform:translateX(100%); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function Terminales() {
  const user = useAuth(s => s.user)
  const { terminales, agencias, empresas, loaded, loadAll } = useDB()

  const rol        = user?.rol||'TECNICO'
  const isAdmin    = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const isFranq    = rol==='FRANQUICIADO'
  const miEmpNombre = isFranq?(empresas.find(e=>e.nombre===user?.empresas?.[0]||e._id===user?.empresas?.[0])?.nombre||user?.empresas?.[0]||''):''

  const visibles = useMemo(()=>isFranq?terminales.filter(t=>t.empresa===miEmpNombre):terminales,[terminales,isFranq,miEmpNombre])

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [buscar,   setBuscar]  = useState('')
  const [filtEst,  setFiltEst] = useState<string|null>(null)   // null = todos
  const [filtMod,  setFiltMod] = useState<string|null>(null)   // null = todos
  const [filtEmp,  setFiltEmp] = useState('todas')
  const [filtDept, setFiltDept]= useState('todos')
  const [pagina,   setPagina]  = useState(1)
  const [sort,     setSort]    = useState<{col:string;asc:boolean}>({col:'codigo',asc:true})

  // ── UI ────────────────────────────────────────────────────────────────────
  const [openId,   setOpenId]  = useState<string|null>(null)
  const [mNueva,   setMNueva]  = useState(false)
  const [mExport,  setMExport] = useState(false)
  const [mAccion,  setMAcc]    = useState<{accion:'estado'|'asignar'|'baja';term:any}|null>(null)
  const [mEditar,  setMEdit]   = useState<any|null>(null)
  const rowRefs = useRef<Record<string,HTMLDivElement|null>>({})
  const POR_PAG = 50

  const reload = useCallback(async()=>{ await loadAll(); setMAcc(null); setMNueva(false); setMEdit(null) },[loadAll])

  // Auto-scroll al expandir
  useEffect(()=>{
    if (!openId) return
    const el = rowRefs.current[openId]
    if (el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'nearest'}),50)
  },[openId])

  const emps  = useMemo(()=>Array.from(new Set(visibles.map(t=>t.empresa).filter(Boolean))).sort(),[visibles])
  const depts = useMemo(()=>Array.from(new Set(visibles.map(t=>t.sucursal).filter(Boolean))).sort(),[visibles])

  const stats = useMemo(()=>{
    const r: Record<string,number> = {}
    ESTADO_ROWS.forEach(e=>{ r[e.key]=visibles.filter(t=>(t.estado as string)===e.key).length })
    const modCount: Record<string,number> = {}
    visibles.forEach(t=>{ if(t.modelo) modCount[t.modelo]=(modCount[t.modelo]||0)+1 })
    return { est:r, modCount, total:visibles.length }
  },[visibles])

  const filtradas = useMemo(()=>{
    const q = buscar.toLowerCase()
    let rows = visibles.filter(t=>{
      if(q && !t.codigo?.toLowerCase().includes(q) && !t.agencia?.toLowerCase().includes(q) &&
               !t.empresa?.toLowerCase().includes(q) && !t.modelo?.toLowerCase().includes(q) &&
               !t.sucursal?.toLowerCase().includes(q)) return false
      if(filtEst && (t.estado as string)!==filtEst) return false
      if(filtMod && t.modelo!==filtMod) return false
      if(filtEmp!=='todas' && t.empresa!==filtEmp) return false
      if(filtDept!=='todos' && t.sucursal!==filtDept) return false
      return true
    })
    return [...rows].sort((a,b)=>{
      const va=(a as any)[sort.col]||'', vb=(b as any)[sort.col]||''
      return sort.asc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va))
    })
  },[visibles,buscar,filtEst,filtMod,filtEmp,filtDept,sort])

  const pagTotal = Math.max(1,Math.ceil(filtradas.length/POR_PAG))
  const pagItems = filtradas.slice((pagina-1)*POR_PAG,pagina*POR_PAG)

  const handleSort = (col:string)=>setSort(s=>({col,asc:s.col===col?!s.asc:true}))
  const handleCardEst = (key:string)=>{ setFiltEst(filtEst===key?null:key); setFiltMod(null); setPagina(1); setOpenId(null) }
  const handleCardMod = (m:string) =>{ setFiltMod(filtMod===m?null:m); setPagina(1); setOpenId(null) }
  const handleDetalle = (id:string)=>{ setOpenId(openId===id?null:id) }

  const empColorFn = (n:string)=>{ const i=empresas.findIndex(e=>e.nombre===n); return EMP_COLS[i>=0?i%EMP_COLS.length:0] }

  return (
    <div style={S.page}>

      {/* ══ FILA 1: ESTADOS ══════════════════════════════════════════════ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1}}>
        {ESTADO_ROWS.slice(0,4).map(e=>(
          <div key={e.key} onClick={()=>handleCardEst(e.key)}
            style={{background:filtEst===e.key?`${e.color}12`:'#0f1629',borderBottom:`3px solid ${e.color}`,
              padding:'14px 20px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,
              transition:'background .15s',userSelect:'none' as const}}>
            <span style={{fontSize:22,color:e.color,lineHeight:1}}>{e.ico}</span>
            <div>
              <div style={{fontSize:32,fontWeight:900,color:e.color,fontFamily:'monospace',lineHeight:1}}>{loaded?stats.est[e.key]||0:'—'}</div>
              <div style={{fontSize:8,color:filtEst===e.key?e.color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.5,marginTop:3}}>{e.label}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Estados secundarios */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1}}>
        {ESTADO_ROWS.slice(4).map(e=>(
          <div key={e.key} onClick={()=>handleCardEst(e.key)}
            style={{background:filtEst===e.key?`${e.color}10`:'#0a0e1a',borderBottom:`2px solid ${e.color}`,
              padding:'8px 20px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'background .15s',userSelect:'none' as const}}>
            <span style={{fontSize:14,color:e.color}}>{e.ico}</span>
            <div style={{fontSize:18,fontWeight:900,color:e.color,fontFamily:'monospace',lineHeight:1}}>{loaded?stats.est[e.key]||0:'—'}</div>
            <div style={{fontSize:7,color:filtEst===e.key?e.color:'#7b8db0',fontFamily:'monospace',letterSpacing:1.5}}>{e.label}</div>
          </div>
        ))}
      </div>

      {/* ══ FILA 2: MODELOS ═════════════════════════════════════════════ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:1}}>
        {MODELOS_DB.map(m=>(
          <div key={m} onClick={()=>handleCardMod(m)}
            style={{background:filtMod===m?'rgba(247,147,26,0.08)':'#0a0e1a',
              border:'1px solid #1e2d4a',borderTop:'none',padding:'9px 20px',cursor:'pointer',
              display:'flex',justifyContent:'space-between',alignItems:'center',
              transition:'background .15s',userSelect:'none' as const}}>
            <span style={{fontSize:8,color:filtMod===m?'#f7931a':'#7b8db0',fontFamily:'monospace',letterSpacing:1}}>{m}</span>
            <span style={{fontSize:20,fontWeight:900,color:filtMod===m?'#f7931a':'#4f8ef7',fontFamily:'monospace'}}>
              {loaded?stats.modCount[m]||0:'—'}
            </span>
          </div>
        ))}
      </div>

      {/* ══ TOOLBAR ══════════════════════════════════════════════════════ */}
      <div style={{display:'flex',gap:8,padding:'10px 16px',background:'#0f1629',borderBottom:'1px solid #1e2d4a',alignItems:'center',flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:180,position:'relative'}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3d4f73" strokeWidth="2"
            style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={buscar} onChange={e=>{setBuscar(e.target.value);setPagina(1);setOpenId(null)}}
            placeholder="Código, modelo, empresa, agencia..." style={{...S.inp,width:'100%',paddingLeft:30}}/>
        </div>
        {!isFranq&&(
          <select value={filtEmp} onChange={e=>{setFiltEmp(e.target.value);setPagina(1);setOpenId(null)}}
            style={{...S.inp,width:'auto',appearance:'none' as any}}>
            <option value="todas">Todas las empresas</option>
            {emps.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <select value={filtDept} onChange={e=>{setFiltDept(e.target.value);setPagina(1);setOpenId(null)}}
          style={{...S.inp,width:'auto',appearance:'none' as any}}>
          <option value="todos">Todos los dptos.</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        {(filtEst||filtMod||filtEmp!=='todas'||filtDept!=='todos'||buscar)&&(
          <button onClick={()=>{setBuscar('');setFiltEst(null);setFiltMod(null);setFiltEmp('todas');setFiltDept('todos');setPagina(1);setOpenId(null)}}
            style={{...S.chip(false,'#f72564'),padding:'7px 12px'}}>✕ Limpiar</button>
        )}
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          <button onClick={()=>setMExport(true)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,
              background:'rgba(79,142,247,0.1)',border:'1px solid rgba(79,142,247,0.3)',
              color:'#4f8ef7',fontSize:11,fontWeight:600,cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar CSV
          </button>
          {isAdmin&&(
            <button onClick={()=>setMNueva(true)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,
                background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',
                color:'#00e5a0',fontSize:11,fontWeight:600,cursor:'pointer'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva terminal
            </button>
          )}
        </div>
      </div>

      {/* ══ TABLA FULL WIDTH ═════════════════════════════════════════════ */}
      <div style={{overflowX:'auto'}}>
        {/* Header */}
        <div style={{display:'grid',gridTemplateColumns:'145px 90px 145px 130px 95px 1fr 100px',
          background:'#050810',padding:'6px 14px',borderBottom:'1px solid #1e2d4a',minWidth:700,position:'sticky',top:0,zIndex:10}}>
          {[{l:'CÓDIGO',c:'codigo'},{l:'MODELO',c:'modelo'},{l:'ESTADO',c:'estado'},
            {l:'EMPRESA',c:'empresa'},{l:'SUCURSAL',c:'sucursal'},{l:'AGENCIA',c:'agencia'},{l:'ACCIONES',c:''}
          ].map((h,i)=>(
            <div key={i} onClick={()=>h.c&&handleSort(h.c)}
              style={{fontSize:7,color:'#3d4f73',fontFamily:'monospace',letterSpacing:1.2,
                cursor:h.c?'pointer':'default',userSelect:'none' as const,display:'flex',alignItems:'center',gap:3}}>
              {h.l}
              {h.c&&<span style={{opacity:sort.col===h.c?1:.3}}>{sort.col===h.c?(sort.asc?'↑':'↓'):'↕'}</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{minWidth:700}}>
          {!loaded ? (
            <div style={{padding:'50px',textAlign:'center',fontSize:11,color:'#3d4f73',fontFamily:'monospace'}}>Cargando terminales...</div>
          ) : filtradas.length===0 ? (
            <div style={{padding:'50px',textAlign:'center'}}>
              <p style={{fontSize:11,color:'#3d4f73',fontFamily:'monospace',marginBottom:10}}>Sin resultados</p>
              <button onClick={()=>{setBuscar('');setFiltEst(null);setFiltMod(null);setFiltEmp('todas');setFiltDept('todos');setPagina(1)}}
                style={{...S.chip(false,'#4f8ef7'),padding:'5px 14px'}}>Limpiar filtros</button>
            </div>
          ) : (
            pagItems.map(t=>{
              const em    = EST[t.estado as string]||{color:'#f7931a',bg:'rgba(247,147,26,0.15)',label:t.estado}
              const ec    = empColorFn(t.empresa)
              const mc    = MOD_COLOR[t.modelo]||'#4f8ef7'
              const isOpen= openId===t._id
              return (
                <div key={t._id} ref={el=>{ rowRefs.current[t._id||''] = el }}>
                  {/* Fila principal */}
                  <div style={{display:'grid',gridTemplateColumns:'145px 90px 145px 130px 95px 1fr 100px',
                    padding:'7px 14px',borderBottom:`1px solid ${isOpen?'rgba(79,142,247,0.2)':'#141d35'}`,
                    borderLeft:isOpen?`3px solid #4f8ef7`:'3px solid transparent',
                    background:isOpen?'rgba(79,142,247,0.05)':'transparent',
                    transition:'all .1s',cursor:'pointer'}}
                    onMouseEnter={e=>{if(!isOpen)(e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.02)'}}
                    onMouseLeave={e=>{if(!isOpen)(e.currentTarget as HTMLDivElement).style.background='transparent'}}>

                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:em.color,flexShrink:0}}/>
                      <span onClick={e=>{e.stopPropagation();handleDetalle(t._id||'')}}
                        style={{fontSize:10,fontWeight:700,color:isOpen?'#4f8ef7':'#00e5a0',fontFamily:'monospace',
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,
                        cursor:'pointer',textDecoration:isOpen?'underline':'none',
                        textDecorationColor:'#4f8ef750'}}>{t.codigo}</span>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,color:mc,fontFamily:'monospace',alignSelf:'center'}}>{t.modelo||'—'}</span>
                    <div style={{alignSelf:'center'}}>
                      <span style={{fontSize:8,color:em.color,background:em.bg,padding:'3px 8px',borderRadius:6,fontFamily:'monospace',fontWeight:700,whiteSpace:'nowrap' as const}}>● {em.label}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5,alignSelf:'center'}}>
                      <div style={{width:5,height:5,borderRadius:1,background:ec,flexShrink:0}}/>
                      <span style={{fontSize:10,color:'#e8eeff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{t.empresa||'—'}</span>
                    </div>
                    <span style={{fontSize:10,color:'#7b8db0',fontFamily:'monospace',alignSelf:'center'}}>{t.sucursal||'—'}</span>
                    <span style={{fontSize:10,color:t.agencia?'#7b8db0':'#3d4f73',fontStyle:t.agencia?'normal':'italic',alignSelf:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,display:'block'}}>{t.agencia||'Sin agencia'}</span>

                    {/* Acciones */}
                    <div style={{display:'flex',gap:4,alignSelf:'center'}}>

                      {isAdmin&&(<>
                        <button title="Editar terminal" onClick={e=>{e.stopPropagation();setMEdit(t)}}
                          style={{width:26,height:26,borderRadius:5,background:'rgba(124,92,252,0.1)',border:'1px solid rgba(124,92,252,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#7c5cfc'}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                        </button>
                        <button title="Asignar" onClick={e=>{e.stopPropagation();setMAcc({accion:'asignar',term:t})}}
                          style={{width:26,height:26,borderRadius:5,background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#00e5a0'}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                        </button>
                        <button title="Cambiar estado" onClick={e=>{e.stopPropagation();setMAcc({accion:'estado',term:t})}}
                          style={{width:26,height:26,borderRadius:5,background:'rgba(247,147,26,0.1)',border:'1px solid rgba(247,147,26,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#f7931a'}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                        </button>
                        {(t.estado as string)!=='BAJA'&&(
                          <button title="Dar baja" onClick={e=>{e.stopPropagation();setMAcc({accion:'baja',term:t})}}
                            style={{width:26,height:26,borderRadius:5,background:'rgba(247,37,100,0.1)',border:'1px solid rgba(247,37,100,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#f72564'}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        )}
                      </>)}
                    </div>
                  </div>


                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Paginación */}
      {filtradas.length>0&&(
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'10px 20px',borderTop:'1px solid #141d35',background:'#050810'}}>
          <span style={{fontSize:8,color:'#3d4f73',fontFamily:'monospace'}}>
            {filtradas.length} resultado{filtradas.length!==1?'s':''} · pág {pagina}/{pagTotal} · {POR_PAG}/pág
            {filtEst&&` · ${EST[filtEst]?.label||filtEst}`}
            {filtMod&&` · ${filtMod}`}
          </span>
          <div style={{display:'flex',gap:4}}>
            <button onClick={()=>setPagina(1)} disabled={pagina===1} style={{...S.chip(false),padding:'3px 8px',opacity:pagina===1?.4:1}}>«</button>
            <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1} style={{...S.chip(false),opacity:pagina===1?.4:1}}>‹</button>
            {Array.from({length:Math.min(5,pagTotal)},(_,i)=>{
              let p=pagina<=3?i+1:pagTotal-pagina<2?pagTotal-4+i:pagina-2+i
              if(p<1||p>pagTotal) return null
              return <button key={p} onClick={()=>{setPagina(p);setOpenId(null)}} style={S.chip(p===pagina,'#4f8ef7')}>{p}</button>
            })}
            <button onClick={()=>setPagina(p=>Math.min(pagTotal,p+1))} disabled={pagina===pagTotal} style={{...S.chip(false),opacity:pagina===pagTotal?.4:1}}>›</button>
            <button onClick={()=>setPagina(pagTotal)} disabled={pagina===pagTotal} style={{...S.chip(false),padding:'3px 8px',opacity:pagina===pagTotal?.4:1}}>»</button>
          </div>
        </div>
      )}

      {/* DRAWER SCI-FI */}
      {openId && terminales.find(t=>t._id===openId) && (
        <DrawerSciFi
          term={terminales.find(t=>t._id===openId)!}
          agencias={agencias} empresas={empresas}
          isAdmin={isAdmin}
          onAccion={(accion,term)=>{ accion==='editar'?setMEdit(term):setMAcc({accion:accion as any,term}) }}
          onClose={()=>setOpenId(null)}
        />
      )}

      {/* MODALES */}
      {mNueva  && <ModalNueva  agencias={agencias} onClose={()=>setMNueva(false)} onDone={reload}/>}
      {mExport && <ModalExport todos={filtradas}   onClose={()=>setMExport(false)}/>}
      {mEditar && <ModalEditar term={mEditar} onClose={()=>setMEdit(null)} onDone={reload}/> }
      {mAccion && <ModalAccion term={mAccion.term} accion={mAccion.accion} agencias={agencias} onClose={()=>setMAcc(null)} onDone={reload}/>}
    </div>
  )
}
