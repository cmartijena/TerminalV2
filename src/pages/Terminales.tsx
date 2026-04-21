import { useState, useMemo } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'

// ── Estilos ──────────────────────────────────────────────────────────────────
const EMP_COLS  = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']
const EST_META: Record<string, { color: string; label: string }> = {
  'ACTIVO':        { color: '#00e5a0', label: 'ACTIVO'    },
  'NO DISPONIBLE': { color: '#f72564', label: 'N/DISP'    },
  'EN PRODUCCION': { color: '#00e5a0', label: 'EN PROD'   },
  'DISPONIBLE':    { color: '#4f8ef7', label: 'DISP'      },
  'EN REPARACION': { color: '#f7931a', label: 'REPARAC'   },
  'BAJA':          { color: '#3d4f73', label: 'BAJA'      },
}

const inp: React.CSSProperties = {
  background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8,
  padding:'7px 12px', fontSize:12, color:'#e8eeff', outline:'none', fontFamily:'system-ui',
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function Terminales() {
  const user = useAuth(s => s.user)
  const { terminales, agencias, empresas, loaded } = useDB()

  const rol     = user?.rol || 'TECNICO'
  const isFranq = rol === 'FRANQUICIADO'
  const isAdmin = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const miEmp   = isFranq ? (user?.empresas?.[0] || '') : ''
  const miEmpObj = empresas.find(e => e.nombre === miEmp || e._id === miEmp)
  const miEmpNombre = miEmpObj?.nombre || miEmp

  const visibles = isFranq
    ? terminales.filter(t => t.empresa === miEmpNombre)
    : terminales

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [buscar,   setBuscar]  = useState('')
  const [filtEmp,  setFiltEmp] = useState('todas')
  const [filtEst,  setFiltEst] = useState('todos')
  const [filtDept, setFiltDept]= useState('todos')
  const [vista,    setVista]   = useState<'tabla'|'cards'>('tabla')
  const [detalle,  setDetalle] = useState<string|null>(null)
  const [pagina,   setPagina]  = useState(1)
  const POR_PAG = 50

  const emps  = useMemo(() => Array.from(new Set(visibles.map(t=>t.empresa).filter(Boolean))).sort(), [visibles])
  const depts = useMemo(() => Array.from(new Set(visibles.map(t=>t.sucursal).filter(Boolean))).sort(), [visibles])

  const filtradas = useMemo(() => {
    const q = buscar.toLowerCase()
    return visibles.filter(t => {
      if (q && !t.codigo?.toLowerCase().includes(q) &&
               !t.agencia?.toLowerCase().includes(q) &&
               !t.empresa?.toLowerCase().includes(q) &&
               !t.modelo?.toLowerCase().includes(q)) return false
      if (filtEmp  !== 'todas' && t.empresa  !== filtEmp)  return false
      if (filtEst  !== 'todos' && t.estado   !== filtEst)  return false
      if (filtDept !== 'todos' && t.sucursal !== filtDept) return false
      return true
    })
  }, [visibles, buscar, filtEmp, filtEst, filtDept])

  const pagTotal = Math.ceil(filtradas.length / POR_PAG)
  const pagItems = filtradas.slice((pagina-1)*POR_PAG, pagina*POR_PAG)

  const termDetalle  = terminales.find(t => t._id === detalle)
  const agDetalle    = termDetalle ? agencias.find(a => a.id_sub === termDetalle.id_sub) : null
  const empDetIdx    = termDetalle ? empresas.findIndex(e => e.nombre === termDetalle.empresa) : 0
  const empDetColor  = EMP_COLS[empDetIdx >= 0 ? empDetIdx % EMP_COLS.length : 0]

  // Stats
  const stats = useMemo(() => ({
    total:   visibles.length,
    activo:  visibles.filter(t=>(t.estado as string)==='ACTIVO').length,
    noDisp:  visibles.filter(t=>(t.estado as string)==='NO DISPONIBLE').length,
    otras:   visibles.filter(t=>t.estado!=='ACTIVO'&&(t.estado as string)!=='NO DISPONIBLE').length,
  }), [visibles])

  const empColor = (nombre: string) => {
    const i = empresas.findIndex(e => e.nombre === nombre)
    return EMP_COLS[i >= 0 ? i % EMP_COLS.length : 0]
  }
  const estMeta = (estado: string) => EST_META[estado] || { color:'#3d4f73', label: estado }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'20px 24px', background:'#0a0e1a', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <h1 style={{ margin:0, fontSize:19, fontWeight:700, color:'#e8eeff' }}>
            {isFranq ? `Terminales · ${miEmpNombre}` : 'Terminales'}
          </h1>
          <p style={{ margin:'3px 0 0', fontSize:10, color:'#7b8db0', fontFamily:'monospace' }}>
            {stats.total} terminales · {stats.activo} activas · {stats.noDisp} no disponibles
          </p>
        </div>
        {/* KPIs rápidos */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {[
            { l:'TOTAL',    v:stats.total,  c:'#7b8db0' },
            { l:'ACTIVAS',  v:stats.activo, c:'#00e5a0' },
            { l:'N/DISP',   v:stats.noDisp, c:'#f72564' },
          ].map((k,i) => (
            <div key={i} style={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:10, padding:'7px 14px', textAlign:'center', minWidth:75 }}>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1, marginBottom:2 }}>{k.l}</div>
              <div style={{ fontSize:20, fontWeight:800, color:k.c, lineHeight:1 }}>{k.v}</div>
            </div>
          ))}
          {/* Switch vista */}
          <div style={{ display:'flex', background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:8, overflow:'hidden' }}>
            {([['tabla','☰'],['cards','⊞']] as const).map(([v,icon]) => (
              <button key={v} onClick={()=>setVista(v)}
                style={{ padding:'7px 12px', border:'none', cursor:'pointer', fontSize:14,
                  background: vista===v ? 'rgba(79,142,247,0.15)' : 'transparent',
                  color: vista===v ? '#4f8ef7' : '#7b8db0' }}>{icon}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: detalle ? '1fr 340px' : '1fr', gap:14 }}>

        {/* ── PANEL PRINCIPAL ── */}
        <div style={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:12, padding:'16px 18px' }}>

          {/* Filtros */}
          <div style={{ display:'grid', gridTemplateColumns:`1fr${!isFranq?' auto':''} auto auto`, gap:8, marginBottom:14 }}>
            <input value={buscar} onChange={e=>{setBuscar(e.target.value);setPagina(1)}}
              placeholder="Buscar por código, agencia, empresa, modelo..."
              style={inp}/>
            {!isFranq && (
              <select value={filtEmp} onChange={e=>{setFiltEmp(e.target.value);setPagina(1)}}
                style={{ ...inp, appearance:'none' as any }}>
                <option value="todas">Todas las empresas</option>
                {emps.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            )}
            <select value={filtDept} onChange={e=>{setFiltDept(e.target.value);setPagina(1)}}
              style={{ ...inp, appearance:'none' as any }}>
              <option value="todos">Todos los dptos.</option>
              {depts.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filtEst} onChange={e=>{setFiltEst(e.target.value);setPagina(1)}}
              style={{ ...inp, appearance:'none' as any }}>
              <option value="todos">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="NO DISPONIBLE">No disponible</option>
              <option value="EN REPARACION">En reparación</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>

          {!loaded ? (
            <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'50px 0' }}>Cargando terminales...</p>
          ) : filtradas.length === 0 ? (
            <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'50px 0' }}>Sin resultados para los filtros aplicados</p>
          ) : vista === 'tabla' ? (
            <>
              {/* Header tabla */}
              <div style={{ display:'grid', gridTemplateColumns:'130px 2fr 1.5fr 1fr 90px 70px 40px', gap:8, padding:'0 10px 8px', borderBottom:'1px solid #1e2d4a', marginBottom:4 }}>
                {['CÓDIGO','AGENCIA','EMPRESA','DPTO.','ESTADO','MODELO',''].map((h,i)=>(
                  <span key={i} style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', letterSpacing:1 }}>{h}</span>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'calc(100vh - 310px)', overflowY:'auto', paddingRight:2 }}>
                {pagItems.map(t => {
                  const em = estMeta(t.estado as string)
                  const ec = empColor(t.empresa)
                  const isOpen = detalle === t._id
                  return (
                    <div key={t._id} onClick={()=>setDetalle(isOpen?null:(t._id||''))}
                      style={{ display:'grid', gridTemplateColumns:'130px 2fr 1.5fr 1fr 90px 70px 40px', gap:8,
                        padding:'8px 10px', borderRadius:8, cursor:'pointer', transition:'background .1s',
                        background: isOpen ? `${ec}08` : '#141d35',
                        border:`1px solid ${isOpen ? ec+'40' : '#1e2d4a'}` }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#e8eeff', fontFamily:'monospace', alignSelf:'center' }}>{t.codigo}</span>
                      <span style={{ fontSize:10, color:'#7b8db0', alignSelf:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.agencia||'—'}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:5, height:5, borderRadius:1, background:ec, flexShrink:0 }}/>
                        <span style={{ fontSize:10, color:'#7b8db0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.empresa||'—'}</span>
                      </div>
                      <span style={{ fontSize:9, color:'#7b8db0', fontFamily:'monospace', alignSelf:'center' }}>{t.sucursal||'—'}</span>
                      <span style={{ fontSize:8, color:em.color, background:`${em.color}12`, border:`1px solid ${em.color}30`, padding:'2px 6px', borderRadius:7, fontFamily:'monospace', alignSelf:'center', textAlign:'center' }}>
                        {em.label}
                      </span>
                      <span style={{ fontSize:9, color:'#3d4f73', fontFamily:'monospace', alignSelf:'center' }}>{t.modelo||'—'}</span>
                      <span style={{ fontSize:9, color:'#4f8ef7', alignSelf:'center', textAlign:'right' }}>›</span>
                    </div>
                  )
                })}
              </div>
              {/* Paginación */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:8, borderTop:'1px solid #1e2d4a' }}>
                <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>
                  {filtradas.length} terminales · pág {pagina} de {pagTotal}
                </span>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={()=>setPagina(Math.max(1,pagina-1))} disabled={pagina===1}
                    style={{ padding:'4px 10px', borderRadius:6, fontSize:10, cursor:pagina===1?'not-allowed':'pointer',
                      background:'#141d35', border:'1px solid #1e2d4a', color:pagina===1?'#3d4f73':'#7b8db0' }}>← Ant</button>
                  {Array.from({length:Math.min(5,pagTotal)},(_,i)=>{
                    const p = pagina<=3 ? i+1 : pagina+i-2
                    if(p<1||p>pagTotal) return null
                    return (
                      <button key={p} onClick={()=>setPagina(p)}
                        style={{ padding:'4px 10px', borderRadius:6, fontSize:10, cursor:'pointer',
                          background: p===pagina?'rgba(79,142,247,0.15)':'#141d35',
                          border:`1px solid ${p===pagina?'rgba(79,142,247,0.4)':'#1e2d4a'}`,
                          color:p===pagina?'#4f8ef7':'#7b8db0' }}>{p}</button>
                    )
                  })}
                  <button onClick={()=>setPagina(Math.min(pagTotal,pagina+1))} disabled={pagina===pagTotal}
                    style={{ padding:'4px 10px', borderRadius:6, fontSize:10, cursor:pagina===pagTotal?'not-allowed':'pointer',
                      background:'#141d35', border:'1px solid #1e2d4a', color:pagina===pagTotal?'#3d4f73':'#7b8db0' }}>Sig →</button>
                </div>
              </div>
            </>
          ) : (
            /* ── VISTA CARDS ── */
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8, maxHeight:'calc(100vh - 290px)', overflowY:'auto' }}>
              {pagItems.map(t => {
                const em = estMeta(t.estado as string)
                const ec = empColor(t.empresa)
                const isOpen = detalle === t._id
                return (
                  <div key={t._id} onClick={()=>setDetalle(isOpen?null:(t._id||''))}
                    style={{ background: isOpen?`${ec}08`:'#141d35', border:`1px solid ${isOpen?ec+'40':'#1e2d4a'}`,
                      borderRadius:10, padding:'11px 13px', cursor:'pointer', transition:'all .12s' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ width:7, height:7, borderRadius:2, background:ec, marginTop:2 }}/>
                      <span style={{ fontSize:7, color:em.color, background:`${em.color}12`, border:`1px solid ${em.color}30`, padding:'1px 6px', borderRadius:6, fontFamily:'monospace' }}>{em.label}</span>
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#e8eeff', fontFamily:'monospace', marginBottom:3 }}>{t.codigo}</div>
                    <div style={{ fontSize:9, color:'#7b8db0', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.agencia||'Sin agencia'}</div>
                    <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>{t.modelo||'—'}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── PANEL DETALLE ── */}
        {detalle && termDetalle && (
          <div style={{ background:'#0f1629', border:`1px solid ${empDetColor}30`, borderRadius:12, padding:'16px 18px', position:'sticky', top:20, alignSelf:'start' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:8, color:empDetColor, fontFamily:'monospace', fontWeight:600, marginBottom:3 }}>{termDetalle.empresa}</div>
                <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:'#e8eeff', fontFamily:'monospace' }}>{termDetalle.codigo}</h2>
                <span style={{ fontSize:8, color:estMeta(termDetalle.estado as string).color,
                  background:`${estMeta(termDetalle.estado as string).color}12`,
                  border:`1px solid ${estMeta(termDetalle.estado as string).color}30`,
                  padding:'2px 8px', borderRadius:8, fontFamily:'monospace', display:'inline-block', marginTop:4 }}>
                  {termDetalle.estado}
                </span>
              </div>
              <button onClick={()=>setDetalle(null)} style={{ background:'transparent', border:'none', color:'#3d4f73', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>

            {/* Info terminal */}
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {[
                { label:'MODELO',      value:termDetalle.modelo },
                { label:'SERIE',       value:termDetalle.serie },
                { label:'CÓDIGO',      value:termDetalle.codigo, mono:true },
                { label:'AGENCIA',     value:termDetalle.agencia },
                { label:'DEPARTAMENTO',value:termDetalle.sucursal },
                { label:'EMPRESA',     value:termDetalle.empresa, color:empDetColor },
              ].filter(f=>f.value).map((f,i) => (
                <div key={i} style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 11px' }}>
                  <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginBottom:2 }}>{f.label}</div>
                  <div style={{ fontSize:11, color:f.color||'#e8eeff', fontFamily:f.mono?'monospace':'system-ui', fontWeight:f.mono?600:400 }}>{f.value}</div>
                </div>
              ))}

              {termDetalle.observacion && (
                <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 11px' }}>
                  <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginBottom:2 }}>OBSERVACIÓN</div>
                  <div style={{ fontSize:10, color:'#7b8db0', lineHeight:1.5 }}>{termDetalle.observacion}</div>
                </div>
              )}

              {/* Info de la agencia */}
              {agDetalle && (
                <div style={{ background:'rgba(79,142,247,0.05)', border:'1px solid rgba(79,142,247,0.15)', borderRadius:8, padding:'10px 11px' }}>
                  <div style={{ fontSize:8, color:'#4f8ef7', fontFamily:'monospace', fontWeight:600, marginBottom:8, letterSpacing:1 }}>AGENCIA ASIGNADA</div>
                  {[
                    { label:'Local',     value:agDetalle.subagencia },
                    { label:'Encargado', value:agDetalle.encargado },
                    { label:'Correo',    value:agDetalle.correo, color:'#4f8ef7' },
                    { label:'Dirección', value:agDetalle.direccion },
                  ].filter(f=>f.value).map((f,i) => (
                    <div key={i} style={{ marginBottom:5 }}>
                      <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>{f.label}</div>
                      <div style={{ fontSize:10, color:f.color||'#e8eeff' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {isAdmin && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:4 }}>
                  <button style={{ padding:'8px', borderRadius:8, background:'rgba(0,229,160,0.08)', border:'1px solid rgba(0,229,160,0.25)', color:'#00e5a0', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    Editar
                  </button>
                  <button style={{ padding:'8px', borderRadius:8, background:'rgba(247,37,100,0.08)', border:'1px solid rgba(247,37,100,0.2)', color:'#f72564', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    Dar de baja
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
