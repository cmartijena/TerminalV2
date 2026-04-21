import { useState } from 'react'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'

const EST_COLOR: Record<string, string> = {
  'EN PRODUCCION': '#00e5a0',
  'PENDIENTE':     '#f7931a',
  'DADA DE BAJA':  '#f72564',
  'INACTIVA':      '#3d4f73',
}
const EMP_COLS = ['#00e5a0','#4f8ef7','#7c5cfc','#f7931a','#00d4ff']

const inp: React.CSSProperties = {
  background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8,
  padding:'8px 12px', fontSize:12, color:'#e8eeff', outline:'none', fontFamily:'system-ui', width:'100%',
}

export default function Agencias() {
  const user = useAuth(s => s.user)
  const { agencias, empresas, terminales, loaded } = useDB()

  const rol     = user?.rol || 'TECNICO'
  const isFranq = rol === 'FRANQUICIADO'
  const miEmp   = isFranq ? (user?.empresas?.[0] || '') : ''
  const miEmpObj = empresas.find(e => e.nombre === miEmp || e._id === miEmp)
  const miEmpNombre = miEmpObj?.nombre || miEmp

  // Filtrar según rol
  const visibles = isFranq
    ? agencias.filter(a => a.empresa === miEmpNombre)
    : agencias

  // Filtros UI
  const [buscar,    setBuscar]  = useState('')
  const [filtEmp,   setFiltEmp] = useState('todas')
  const [filtDept,  setFiltDept]= useState('todos')
  const [filtEst,   setFiltEst] = useState('todos')
  const [detalle,   setDetalle] = useState<string|null>(null)

  const depts   = Array.from(new Set(visibles.map(a => a.sucursal).filter(Boolean))).sort()
  const emps    = Array.from(new Set(visibles.map(a => a.empresa).filter(Boolean))).sort()

  const filtradas = visibles.filter(a => {
    const q = buscar.toLowerCase()
    if (q && !a.subagencia?.toLowerCase().includes(q) && !a.empresa?.toLowerCase().includes(q) && !a.direccion?.toLowerCase().includes(q)) return false
    if (filtEmp  !== 'todas' && a.empresa  !== filtEmp)  return false
    if (filtDept !== 'todos' && a.sucursal !== filtDept) return false
    if (filtEst  !== 'todos' && a.estado   !== filtEst)  return false
    return true
  })

  const agDetalle = agencias.find(a => a._id === detalle)
  const agTerms   = agDetalle ? terminales.filter(t => t.id_sub === agDetalle.id_sub) : []
  const agActivas = agTerms.filter(t => (t.estado as string) === 'ACTIVO').length
  const empIdx    = agDetalle ? empresas.findIndex(e => e.nombre === agDetalle.empresa) : 0
  const empColor  = EMP_COLS[empIdx >= 0 ? empIdx % EMP_COLS.length : 0]

  const statCounts = {
    total:    visibles.length,
    prod:     visibles.filter(a => a.estado === 'EN PRODUCCION').length,
    pend:     visibles.filter(a => a.estado === 'PENDIENTE').length,
    baja:     visibles.filter(a => a.estado === 'DADA DE BAJA' || a.estado === 'INACTIVA').length,
  }

  return (
    <div style={{ padding:'20px 24px', background:'#0a0e1a', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <h1 style={{ margin:0, fontSize:19, fontWeight:700, color:'#e8eeff' }}>
            {isFranq ? `Agencias · ${miEmpNombre}` : 'Agencias'}
          </h1>
          <p style={{ margin:'3px 0 0', fontSize:10, color:'#7b8db0', fontFamily:'monospace' }}>
            {statCounts.total} locales · {statCounts.prod} en producción · {statCounts.pend} pendientes
          </p>
        </div>
        {/* KPIs rápidos */}
        <div style={{ display:'flex', gap:8 }}>
          {[
            { label:'TOTAL',        value:statCounts.total, color:'#7b8db0' },
            { label:'EN PRODUCCIÓN',value:statCounts.prod,  color:'#00e5a0' },
            { label:'PENDIENTES',   value:statCounts.pend,  color:'#f7931a' },
            { label:'INACTIVAS',    value:statCounts.baja,  color:'#f72564' },
          ].map((k,i) => (
            <div key={i} style={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:10, padding:'8px 14px', textAlign:'center', minWidth:80 }}>
              <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>{k.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: detalle ? '1fr 360px' : '1fr', gap:14 }}>

        {/* ── LISTA ── */}
        <div style={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:12, padding:'16px 18px' }}>

          {/* Filtros */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:8, marginBottom:14 }}>
            <input value={buscar} onChange={e=>setBuscar(e.target.value)}
              placeholder="Buscar por nombre, empresa, dirección..."
              style={{ ...inp, padding:'7px 12px' }}/>
            {!isFranq && (
              <select value={filtEmp} onChange={e=>setFiltEmp(e.target.value)}
                style={{ ...inp, width:'auto', appearance:'none' as any }}>
                <option value="todas">Todas las empresas</option>
                {emps.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            )}
            <select value={filtDept} onChange={e=>setFiltDept(e.target.value)}
              style={{ ...inp, width:'auto', appearance:'none' as any }}>
              <option value="todos">Todos los dptos.</option>
              {depts.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filtEst} onChange={e=>setFiltEst(e.target.value)}
              style={{ ...inp, width:'auto', appearance:'none' as any }}>
              <option value="todos">Todos los estados</option>
              <option value="EN PRODUCCION">En producción</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="DADA DE BAJA">Dada de baja</option>
            </select>
          </div>

          {/* Tabla */}
          {!loaded ? (
            <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'40px 0' }}>Cargando agencias...</p>
          ) : filtradas.length === 0 ? (
            <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'40px 0' }}>Sin resultados para los filtros aplicados</p>
          ) : (
            <>
              {/* Header tabla */}
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 80px 80px 60px', gap:8, padding:'0 10px 8px', borderBottom:'1px solid #1e2d4a', marginBottom:6 }}>
                {['AGENCIA','EMPRESA','DPTO.','ESTADO','TERM.',''].map((h,i) => (
                  <span key={i} style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', letterSpacing:1 }}>{h}</span>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'calc(100vh - 280px)', overflowY:'auto' }}>
                {filtradas.map(ag => {
                  const terms  = terminales.filter(t => t.id_sub === ag.id_sub)
                  const activ  = terms.filter(t => (t.estado as string) === 'ACTIVO').length
                  const ei     = empresas.findIndex(e => e.nombre === ag.empresa)
                  const color  = EMP_COLS[ei >= 0 ? ei % EMP_COLS.length : 0]
                  const estCol = EST_COLOR[ag.estado] || '#3d4f73'
                  const isOpen = detalle === ag._id
                  return (
                    <div key={ag._id} onClick={() => setDetalle(isOpen ? null : (ag._id||''))}
                      style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 80px 80px 60px', gap:8,
                        padding:'9px 10px', borderRadius:8, cursor:'pointer', transition:'all .12s',
                        background: isOpen ? `${color}08` : '#141d35',
                        border: `1px solid ${isOpen ? color+'40' : '#1e2d4a'}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:estCol, flexShrink:0 }}/>
                        <span style={{ fontSize:11, fontWeight:600, color:'#e8eeff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.subagencia}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:5, height:5, borderRadius:1, background:color, flexShrink:0 }}/>
                        <span style={{ fontSize:10, color:'#7b8db0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.empresa}</span>
                      </div>
                      <span style={{ fontSize:10, color:'#7b8db0', fontFamily:'monospace', alignSelf:'center' }}>{ag.sucursal}</span>
                      <span style={{ fontSize:8, color:estCol, background:`${estCol}12`, border:`1px solid ${estCol}30`, padding:'2px 6px', borderRadius:7, fontFamily:'monospace', alignSelf:'center', textAlign:'center' }}>
                        {ag.estado === 'EN PRODUCCION' ? 'PROD' : ag.estado === 'PENDIENTE' ? 'PEND' : 'BAJA'}
                      </span>
                      <div style={{ alignSelf:'center', textAlign:'center' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:activ>0?'#00e5a0':'#3d4f73' }}>{activ}</span>
                        <span style={{ fontSize:9, color:'#3d4f73', fontFamily:'monospace' }}>/{terms.length}</span>
                      </div>
                      <span style={{ fontSize:9, color:'#4f8ef7', alignSelf:'center', textAlign:'right' }}>
                        {isOpen ? '◀ cerrar' : 'ver →'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #1e2d4a', fontSize:8, color:'#3d4f73', fontFamily:'monospace' }}>
                {filtradas.length} de {visibles.length} agencias · Supabase en tiempo real
              </div>
            </>
          )}
        </div>

        {/* ── PANEL DETALLE ── */}
        {detalle && agDetalle && (
          <div style={{ background:'#0f1629', border:`1px solid ${empColor}30`, borderRadius:12, padding:'16px 18px', position:'sticky', top:20, alignSelf:'start' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:8, color:empColor, fontFamily:'monospace', fontWeight:600, marginBottom:3 }}>{agDetalle.empresa}</div>
                <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:'#e8eeff' }}>{agDetalle.subagencia}</h2>
                <span style={{ fontSize:8, color:EST_COLOR[agDetalle.estado]||'#3d4f73', background:`${EST_COLOR[agDetalle.estado]||'#3d4f73'}12`, border:`1px solid ${EST_COLOR[agDetalle.estado]||'#3d4f73'}30`, padding:'2px 8px', borderRadius:8, fontFamily:'monospace', display:'inline-block', marginTop:4 }}>
                  {agDetalle.estado}
                </span>
              </div>
              <button onClick={()=>setDetalle(null)} style={{ background:'transparent', border:'none', color:'#3d4f73', cursor:'pointer', fontSize:18, lineHeight:1 }}>✕</button>
            </div>

            {/* Stats terminales */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:14 }}>
              {[
                { l:'TOTAL',    v:agTerms.length,                      c:'#7b8db0' },
                { l:'ACTIVAS',  v:agActivas,                           c:'#00e5a0' },
                { l:'N/D',      v:agTerms.length-agActivas,            c:'#f72564'  },
              ].map((s,i) => (
                <div key={i} style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:7, color:'#7b8db0', fontFamily:'monospace', marginBottom:3 }}>{s.l}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Info */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
              {[
                { label:'DEPARTAMENTO', value:agDetalle.sucursal },
                { label:'ENCARGADO',    value:agDetalle.encargado },
                { label:'CORREO',       value:agDetalle.correo, color:'#4f8ef7' },
                { label:'DIRECCIÓN',    value:agDetalle.direccion },
              ].filter(f=>f.value).map((f,i) => (
                <div key={i} style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 11px' }}>
                  <div style={{ fontSize:8, color:'#3d4f73', fontFamily:'monospace', marginBottom:2 }}>{f.label}</div>
                  <div style={{ fontSize:11, color:f.color||'#e8eeff' }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Terminales de esta agencia */}
            {agTerms.length > 0 && (
              <div>
                <div style={{ fontSize:9, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1, marginBottom:7 }}>TERMINALES ASIGNADAS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:200, overflowY:'auto' }}>
                  {agTerms.map(t => {
                    const isAct = (t.estado as string) === 'ACTIVO'
                    return (
                      <div key={t._id} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 8px', background:'#141d35', border:'1px solid #1e2d4a', borderRadius:7 }}>
                        <div style={{ width:5, height:5, borderRadius:'50%', background:isAct?'#00e5a0':'#f72564', flexShrink:0 }}/>
                        <span style={{ fontSize:10, fontWeight:600, color:'#e8eeff', fontFamily:'monospace', flex:1 }}>{t.codigo}</span>
                        <span style={{ fontSize:8, color:isAct?'#00e5a0':'#f72564', fontFamily:'monospace' }}>{isAct?'ACT':'N/D'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
