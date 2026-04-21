import { useState, useMemo } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'

// ── Paleta empresa ────────────────────────────────────────────────────────────
const EMP_COLS = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']

// ── Estado meta ───────────────────────────────────────────────────────────────
const EST: Record<string,{color:string;label:string}> = {
  'ACTIVO':        { color:'#00e5a0', label:'ACTIVO'  },
  'NO DISPONIBLE': { color:'#f72564', label:'N/DISP'  },
  'EN PRODUCCION': { color:'#00e5a0', label:'EN PROD' },
  'DISPONIBLE':    { color:'#4f8ef7', label:'DISP'    },
  'EN REPARACION': { color:'#f7931a', label:'REPARA'  },
  'BAJA':          { color:'#3d4f73', label:'BAJA'    },
}

// ── Modelo meta ───────────────────────────────────────────────────────────────
const MOD: Record<string,{color:string;short:string}> = {
  'BOXDUAL':    { color:'#7c5cfc', short:'DUAL'  },
  'BOX SIMPLE': { color:'#4f8ef7', short:'SIMPLE'},
  'WALL':       { color:'#f7931a', short:'WALL'  },
}

// ── CSS base ──────────────────────────────────────────────────────────────────
const S = {
  page:  { padding:'20px 24px', background:'#0a0e1a', minHeight:'100vh' } as React.CSSProperties,
  card:  { background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:12 } as React.CSSProperties,
  inp:   { background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8,
           padding:'7px 12px', fontSize:12, color:'#e8eeff', outline:'none',
           fontFamily:'system-ui', width:'100%' } as React.CSSProperties,
  chip:  (active:boolean, color='#4f8ef7') => ({
    padding:'3px 11px', borderRadius:7, fontSize:9, fontFamily:'monospace',
    cursor:'pointer', border:'1px solid', fontWeight:500,
    background: active ? `${color}14` : 'transparent',
    borderColor: active ? `${color}50` : '#1e2d4a',
    color: active ? color : '#7b8db0',
    transition:'all .12s',
  } as React.CSSProperties),
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const IcoTerminal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
)

// ── Componente principal ──────────────────────────────────────────────────────
export default function Terminales() {
  const user = useAuth(s => s.user)
  const { terminales, agencias, empresas, loaded } = useDB()

  const rol     = user?.rol || 'TECNICO'
  const isFranq = rol === 'FRANQUICIADO'
  const isAdmin = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)
  const miEmp   = isFranq ? (user?.empresas?.[0] || '') : ''
  const miEmpObj = empresas.find(e => e.nombre === miEmp || e._id === miEmp)
  const miEmpNombre = miEmpObj?.nombre || miEmp

  const visibles = useMemo(() =>
    isFranq ? terminales.filter(t => t.empresa === miEmpNombre) : terminales,
  [terminales, isFranq, miEmpNombre])

  // ── Estado filtros ────────────────────────────────────────────────────────
  const [buscar,   setBuscar]  = useState('')
  const [filtEst,  setFiltEst] = useState('todos')
  const [filtEmp,  setFiltEmp] = useState('todas')
  const [filtMod,  setFiltMod] = useState('todos')
  const [pagina,   setPagina]  = useState(1)
  const [detalle,  setDetalle] = useState<string|null>(null)
  const POR_PAG = 50

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = visibles.length
    const activo  = visibles.filter(t => (t.estado as string) === 'ACTIVO').length
    const noDisp  = visibles.filter(t => (t.estado as string) === 'NO DISPONIBLE').length
    const boxdual = visibles.filter(t => t.modelo === 'BOXDUAL').length
    const wall    = visibles.filter(t => t.modelo === 'WALL').length
    const simple  = visibles.filter(t => t.modelo === 'BOX SIMPLE').length
    return { total, activo, noDisp, boxdual, wall, simple }
  }, [visibles])

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = buscar.toLowerCase()
    return visibles.filter(t => {
      if (q && !t.codigo?.toLowerCase().includes(q) &&
               !t.agencia?.toLowerCase().includes(q) &&
               !t.empresa?.toLowerCase().includes(q) &&
               !t.modelo?.toLowerCase().includes(q)) return false
      if (filtEst !== 'todos' && (t.estado as string) !== filtEst) return false
      if (filtEmp !== 'todas' && t.empresa !== filtEmp) return false
      if (filtMod !== 'todos' && t.modelo  !== filtMod) return false
      return true
    })
  }, [visibles, buscar, filtEst, filtEmp, filtMod])

  const pagTotal = Math.max(1, Math.ceil(filtradas.length / POR_PAG))
  const pagItems = filtradas.slice((pagina-1)*POR_PAG, pagina*POR_PAG)

  const resetPag = () => setPagina(1)

  // ── Detalle ───────────────────────────────────────────────────────────────
  const termDet = terminales.find(t => t._id === detalle)
  const agDet   = termDet ? agencias.find(a => a.id_sub === termDet.id_sub) : null
  const empDetIdx = termDet ? empresas.findIndex(e => e.nombre === termDet.empresa) : 0
  const empDetCol = EMP_COLS[empDetIdx >= 0 ? empDetIdx % EMP_COLS.length : 0]
  const estDet    = termDet ? (EST[termDet.estado as string] || {color:'#3d4f73',label:termDet.estado}) : null
  const modDet    = termDet ? (MOD[termDet.modelo] || {color:'#3d4f73',short:termDet.modelo}) : null

  const empColor = (nombre:string) => {
    const i = empresas.findIndex(e => e.nombre === nombre)
    return EMP_COLS[i >= 0 ? i % EMP_COLS.length : 0]
  }
  const emps = useMemo(() => Array.from(new Set(visibles.map(t=>t.empresa).filter(Boolean))).sort(), [visibles])

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:19, fontWeight:700, color:'#e8eeff' }}>
            {isFranq ? `Terminales · ${miEmpNombre}` : 'Terminales'}
          </h1>
          <p style={{ margin:'3px 0 0', fontSize:10, color:'#7b8db0', fontFamily:'monospace' }}>
            {loaded ? `${stats.total} terminales en flota · ${stats.activo} activas · ${stats.noDisp} sin asignar` : 'Cargando...'}
          </p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'TOTAL',      value:stats.total,   color:'#4f8ef7', sub:'terminales en flota',
            icon:<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></> },
          { label:'ACTIVAS',    value:stats.activo,  color:'#00e5a0', sub:`${stats.total>0?Math.round(stats.activo/stats.total*100):0}% de la flota`,
            icon:<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
          { label:'NO DISP.',   value:stats.noDisp,  color:'#f72564', sub:'sin agencia asignada',
            icon:<><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></> },
          { label:'BOX DUAL',   value:stats.boxdual, color:'#7c5cfc', sub:`${stats.simple} box simple`,
            icon:<><rect x="1" y="4" width="9" height="16" rx="1"/><rect x="14" y="4" width="9" height="16" rx="1"/></> },
          { label:'WALL',       value:stats.wall,    color:'#f7931a', sub:'montaje en pared',
            icon:<><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></> },
        ].map((k,i) => (
          <div key={i} style={{ ...S.card, padding:'13px 15px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <span style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1.5 }}>{k.label}</span>
              <div style={{ width:26, height:26, borderRadius:7, background:`${k.color}15`, border:`1px solid ${k.color}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2" strokeLinecap="round">{k.icon}</svg>
              </div>
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1, marginBottom:4 }}>{loaded?k.value:'—'}</div>
            <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── BARRA DISTRIBUCIÓN MODELOS ── */}
      <div style={{ ...S.card, padding:'11px 15px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
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
          {loaded && stats.total > 0 && [
            { w:stats.boxdual/stats.total*100, c:'#7c5cfc', l:`DUAL ${stats.boxdual}` },
            { w:stats.wall/stats.total*100,    c:'#f7931a', l:`WALL ${stats.wall}` },
            { w:stats.simple/stats.total*100,  c:'#4f8ef7', l:`SIMPLE ${stats.simple}` },
          ].map((seg,i) => seg.w > 0 && (
            <div key={i} style={{ width:`${seg.w}%`, background:seg.c, display:'flex', alignItems:'center', justifyContent:'center', transition:'width .5s' }}>
              {seg.w > 8 && <span style={{ fontSize:8, color:'#fff', fontFamily:'monospace', fontWeight:700, userSelect:'none' }}>{seg.l}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div style={{ display:'grid', gridTemplateColumns:detalle?'1fr 360px':'1fr', gap:14 }}>

        {/* ── PANEL LISTA ── */}
        <div style={{ ...S.card, padding:'15px 17px' }}>

          {/* Búsqueda + filtros */}
          <div style={{ display:'flex', gap:8, marginBottom:11, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200, position:'relative' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3d4f73" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={buscar} onChange={e=>{setBuscar(e.target.value);resetPag()}}
                placeholder="Buscar por código, agencia, empresa, modelo..."
                style={{ ...S.inp, paddingLeft:30 }}/>
            </div>
            {!isFranq && (
              <select value={filtEmp} onChange={e=>{setFiltEmp(e.target.value);resetPag()}}
                style={{ ...S.inp, width:'auto', appearance:'none' as any }}>
                <option value="todas">Todas las empresas</option>
                {emps.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            )}
          </div>

          {/* Chips estado + modelo */}
          <div style={{ display:'flex', gap:5, marginBottom:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', alignSelf:'center', marginRight:2 }}>ESTADO:</span>
            {[
              ['todos','Todas','#4f8ef7'],
              ['ACTIVO','Activas','#00e5a0'],
              ['NO DISPONIBLE','No disp.','#f72564'],
              ['EN REPARACION','Reparación','#f7931a'],
              ['BAJA','Baja','#3d4f73'],
            ].map(([v,l,c])=>(
              <button key={v} onClick={()=>{setFiltEst(v);resetPag()}} style={S.chip(filtEst===v, c)}>{l}</button>
            ))}
            <div style={{ width:1, height:20, background:'#1e2d4a', alignSelf:'center', margin:'0 4px' }}/>
            <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', alignSelf:'center', marginRight:2 }}>MODELO:</span>
            {[
              ['todos','Todos','#7b8db0'],
              ['BOXDUAL','Box Dual','#7c5cfc'],
              ['WALL','Wall','#f7931a'],
              ['BOX SIMPLE','Box Simple','#4f8ef7'],
            ].map(([v,l,c])=>(
              <button key={v} onClick={()=>{setFiltMod(v);resetPag()}} style={S.chip(filtMod===v, c)}>{l}</button>
            ))}
          </div>

          {/* Tabla */}
          {!loaded ? (
            <div style={{ textAlign:'center', padding:'50px 0' }}>
              <div style={{ width:36, height:36, borderRadius:9, background:'#141d35', border:'1px solid #1e2d4a', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                <IcoTerminal/>
              </div>
              <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace' }}>Cargando terminales...</p>
            </div>
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign:'center', padding:'50px 0' }}>
              <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace' }}>Sin resultados · ajusta los filtros</p>
              <button onClick={()=>{setBuscar('');setFiltEst('todos');setFiltEmp('todas');setFiltMod('todos');resetPag()}}
                style={{ marginTop:8, padding:'5px 14px', borderRadius:7, background:'transparent', border:'1px solid #1e2d4a', color:'#7b8db0', fontSize:10, cursor:'pointer' }}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 1.2fr 90px 80px 28px', gap:8,
                padding:'5px 10px 7px', borderBottom:'1px solid #1e2d4a', marginBottom:4 }}>
                {['CÓDIGO','AGENCIA','EMPRESA','MODELO','ESTADO',''].map((h,i)=>(
                  <span key={i} style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', letterSpacing:1.2 }}>{h}</span>
                ))}
              </div>

              {/* Filas */}
              <div style={{ display:'flex', flexDirection:'column', gap:3,
                maxHeight: detalle ? 'calc(100vh - 400px)' : 'calc(100vh - 360px)', overflowY:'auto', paddingRight:2 }}>
                {pagItems.map(t => {
                  const em  = EST[t.estado as string] || { color:'#3d4f73', label:t.estado }
                  const mo  = MOD[t.modelo]           || { color:'#3d4f73', short:t.modelo }
                  const ec  = empColor(t.empresa)
                  const isSel = detalle === t._id
                  return (
                    <div key={t._id} onClick={()=>setDetalle(isSel?null:(t._id||''))}
                      style={{ display:'grid', gridTemplateColumns:'140px 1fr 1.2fr 90px 80px 28px', gap:8,
                        padding:'8px 10px', borderRadius:8, cursor:'pointer', transition:'all .1s',
                        background: isSel ? `${ec}08` : '#141d35',
                        border:`1px solid ${isSel ? ec+'45' : '#1e2d4a'}` }}>

                      {/* Código */}
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:5, height:5, borderRadius:'50%', background:em.color, flexShrink:0 }}/>
                        <span style={{ fontSize:10, fontWeight:700, color:'#e8eeff', fontFamily:'monospace',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.codigo}</span>
                      </div>

                      {/* Agencia */}
                      <span style={{ fontSize:10, color: t.agencia?'#7b8db0':'#3d4f73', alignSelf:'center',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        fontStyle: t.agencia?'normal':'italic' }}>{t.agencia||'Sin agencia'}</span>

                      {/* Empresa */}
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:5, height:5, borderRadius:1, background:ec, flexShrink:0 }}/>
                        <span style={{ fontSize:10, color:t.empresa?'#7b8db0':'#3d4f73', overflow:'hidden',
                          textOverflow:'ellipsis', whiteSpace:'nowrap', fontStyle:t.empresa?'normal':'italic' }}>
                          {t.empresa||'—'}
                        </span>
                      </div>

                      {/* Modelo */}
                      <span style={{ fontSize:8, color:mo.color, background:`${mo.color}12`,
                        border:`1px solid ${mo.color}30`, padding:'2px 7px', borderRadius:6,
                        fontFamily:'monospace', alignSelf:'center', textAlign:'center', whiteSpace:'nowrap' }}>
                        {mo.short}
                      </span>

                      {/* Estado */}
                      <span style={{ fontSize:8, color:em.color, background:`${em.color}12`,
                        border:`1px solid ${em.color}30`, padding:'2px 6px', borderRadius:6,
                        fontFamily:'monospace', alignSelf:'center', textAlign:'center' }}>
                        {em.label}
                      </span>

                      {/* Chevron */}
                      <span style={{ color:'#4f8ef7', alignSelf:'center', textAlign:'right', fontSize:13,
                        transform: isSel?'rotate(90deg)':'rotate(0)', display:'inline-block', transition:'transform .15s' }}>›</span>
                    </div>
                  )
                })}
              </div>

              {/* Paginación */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                marginTop:10, paddingTop:9, borderTop:'1px solid #1e2d4a' }}>
                <span style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>
                  {filtradas.length} resultado{filtradas.length!==1?'s':''} · pág {pagina} de {pagTotal} · {POR_PAG}/pág
                </span>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={()=>setPagina(1)} disabled={pagina===1}
                    style={{ ...S.chip(false), padding:'3px 8px', opacity:pagina===1?.4:1 }}>«</button>
                  <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1}
                    style={{ ...S.chip(false), opacity:pagina===1?.4:1 }}>‹ Ant</button>
                  {Array.from({length:Math.min(5,pagTotal)},(_,i)=>{
                    let p = pagina<=3 ? i+1 : pagTotal-pagina<2 ? pagTotal-4+i : pagina-2+i
                    if(p<1||p>pagTotal) return null
                    return (
                      <button key={p} onClick={()=>setPagina(p)}
                        style={S.chip(p===pagina,'#4f8ef7')}>{p}</button>
                    )
                  })}
                  <button onClick={()=>setPagina(p=>Math.min(pagTotal,p+1))} disabled={pagina===pagTotal}
                    style={{ ...S.chip(false), opacity:pagina===pagTotal?.4:1 }}>Sig ›</button>
                  <button onClick={()=>setPagina(pagTotal)} disabled={pagina===pagTotal}
                    style={{ ...S.chip(false), padding:'3px 8px', opacity:pagina===pagTotal?.4:1 }}>»</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── PANEL DETALLE ── */}
        {detalle && termDet && (
          <div style={{ ...S.card, borderColor:`${empDetCol}30`, padding:'16px 18px',
            position:'sticky', top:20, alignSelf:'start', maxHeight:'calc(100vh - 60px)', overflowY:'auto' }}>

            {/* Header detalle */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div style={{ display:'flex', gap:11, alignItems:'center' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${empDetCol}15`,
                  border:`1px solid ${empDetCol}35`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={empDetCol} strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:8, color:empDetCol, fontFamily:'monospace', fontWeight:600, marginBottom:2 }}>
                    {termDet.empresa||'Sin empresa'}
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#e8eeff', fontFamily:'monospace', lineHeight:1 }}>
                    {termDet.codigo}
                  </div>
                </div>
              </div>
              <button onClick={()=>setDetalle(null)}
                style={{ background:'transparent', border:'none', color:'#3d4f73', cursor:'pointer', fontSize:18, lineHeight:1, padding:2 }}>✕</button>
            </div>

            {/* Badges modelo + estado */}
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {modDet && (
                <span style={{ fontSize:9, color:modDet.color, background:`${modDet.color}14`,
                  border:`1px solid ${modDet.color}35`, padding:'3px 10px', borderRadius:7, fontFamily:'monospace', fontWeight:600 }}>
                  {termDet.modelo}
                </span>
              )}
              {estDet && (
                <span style={{ fontSize:9, color:estDet.color, background:`${estDet.color}14`,
                  border:`1px solid ${estDet.color}35`, padding:'3px 10px', borderRadius:7, fontFamily:'monospace', fontWeight:600 }}>
                  {termDet.estado}
                </span>
              )}
            </div>

            {/* Info terminal */}
            <div style={{ fontSize:8, color:'#4f8ef7', fontFamily:'monospace', fontWeight:600, letterSpacing:1.2, marginBottom:8 }}>
              DATOS DE LA TERMINAL
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
              {[
                { l:'CÓDIGO',  v:termDet.codigo,  mono:true },
                { l:'MODELO',  v:termDet.modelo,  mono:true },
                { l:'SERIE',   v:termDet.serie||'—', mono:true },
                { l:'EMPRESA', v:termDet.empresa||'—', color:empDetCol },
              ].map((f,i)=>(
                <div key={i} style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 11px' }}>
                  <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>{f.l}</div>
                  <div style={{ fontSize:11, color:f.color||'#e8eeff', fontFamily:f.mono?'monospace':'system-ui',
                    fontWeight:f.mono?700:400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.v}</div>
                </div>
              ))}
            </div>

            {termDet.observacion && (
              <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 11px', marginBottom:14 }}>
                <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>OBSERVACIÓN</div>
                <div style={{ fontSize:10, color:'#7b8db0', lineHeight:1.5 }}>{termDet.observacion}</div>
              </div>
            )}

            {/* Agencia asignada */}
            <div style={{ fontSize:8, color:'#7c5cfc', fontFamily:'monospace', fontWeight:600, letterSpacing:1.2, marginBottom:8 }}>
              AGENCIA ASIGNADA
            </div>
            {agDet ? (
              <div style={{ background:'rgba(124,92,252,0.05)', border:'1px solid rgba(124,92,252,0.18)', borderRadius:9, padding:'11px 13px', marginBottom:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {[
                    { l:'LOCAL',      v:agDet.subagencia },
                    { l:'DPTO.',      v:agDet.sucursal },
                    { l:'ENCARGADO',  v:agDet.encargado||'—' },
                    { l:'ESTADO',     v:agDet.estado },
                  ].map((f,i)=>(
                    <div key={i}>
                      <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:1 }}>{f.l}</div>
                      <div style={{ fontSize:10, color:'#e8eeff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.v||'—'}</div>
                    </div>
                  ))}
                </div>
                {agDet.correo && (
                  <div style={{ marginTop:8, paddingTop:7, borderTop:'1px solid rgba(124,92,252,0.15)' }}>
                    <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:1 }}>CORREO</div>
                    <div style={{ fontSize:10, color:'#4f8ef7' }}>{agDet.correo}</div>
                  </div>
                )}
                {agDet.direccion && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:7, color:'#3d4f73', fontFamily:'monospace', marginBottom:1 }}>DIRECCIÓN</div>
                    <div style={{ fontSize:10, color:'#7b8db0', lineHeight:1.4 }}>{agDet.direccion}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background:'rgba(247,37,100,0.05)', border:'1px solid rgba(247,37,100,0.15)', borderRadius:9, padding:'10px 13px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#f72564', flexShrink:0 }}/>
                  <span style={{ fontSize:10, color:'#f72564', fontFamily:'monospace' }}>Terminal sin agencia asignada</span>
                </div>
                <p style={{ fontSize:9, color:'#3d4f73', margin:'5px 0 0', fontFamily:'monospace' }}>
                  Esta terminal está en stock disponible para asignación
                </p>
              </div>
            )}

            {/* Acciones admin */}
            {isAdmin && (
              <>
                <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', fontWeight:600, letterSpacing:1.2, marginBottom:8 }}>
                  ACCIONES
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <button style={{ padding:'9px', borderRadius:8, background:'rgba(79,142,247,0.1)',
                      border:'1px solid rgba(79,142,247,0.3)', color:'#4f8ef7', fontSize:11,
                      fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Editar
                    </button>
                    <button style={{ padding:'9px', borderRadius:8, background:'rgba(247,147,26,0.08)',
                      border:'1px solid rgba(247,147,26,0.25)', color:'#f7931a', fontSize:11,
                      fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                      </svg>
                      Cambiar estado
                    </button>
                  </div>
                  {!agDet && (
                    <button style={{ padding:'9px', borderRadius:8, background:'rgba(0,229,160,0.08)',
                      border:'1px solid rgba(0,229,160,0.25)', color:'#00e5a0', fontSize:11,
                      fontWeight:600, cursor:'pointer' }}>
                      Asignar a agencia
                    </button>
                  )}
                  <button style={{ padding:'9px', borderRadius:8, background:'rgba(247,37,100,0.06)',
                    border:'1px solid rgba(247,37,100,0.18)', color:'#f72564', fontSize:11,
                    fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                    Dar de baja terminal
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
