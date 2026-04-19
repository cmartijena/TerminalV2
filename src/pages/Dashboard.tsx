import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useNotifs } from '../store/notifs'
import { WAM_API_URL, WAM_API_SECRET } from '../lib/config'
import type { Notificacion } from '../types'

const AREA_DATA = [
  { day:'Lun', in:32400, out:28100 },
  { day:'Mar', in:41200, out:35600 },
  { day:'Mié', in:38900, out:33200 },
  { day:'Jue', in:45600, out:38900 },
  { day:'Vie', in:52100, out:44300 },
  { day:'Sáb', in:48300, out:41200 },
  { day:'Dom', in:25700, out:21800 },
]
const HOURLY = [
  {h:'00',v:1200},{h:'02',v:800},{h:'04',v:400},{h:'06',v:900},
  {h:'08',v:3200},{h:'10',v:5800},{h:'12',v:7200},{h:'14',v:6800},
  {h:'16',v:8100},{h:'18',v:9200},{h:'20',v:7600},{h:'22',v:4300},
]
const PIE_COLORS = ['#4f8ef7','#7c5cfc','#00e5a0','#f7931a','#00d4ff']
const NOTIF_BG: Record<string,string> = {
  danger:'rgba(247,37,100,0.12)', warn:'rgba(247,147,26,0.12)',
  info:'rgba(79,142,247,0.12)', success:'rgba(0,229,160,0.12)',
}
const NOTIF_COLOR: Record<string,string> = {
  danger:'#f72564', warn:'#f7931a', info:'#4f8ef7', success:'#00e5a0',
}

const fmt = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`

function MiniStat({ label, value, color, pct }: { label:string; value:string; color:string; pct:number }) {
  return (
    <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:10, padding:'10px 14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:10, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1 }}>{label}</span>
        <span style={{ fontSize:10, color, fontFamily:'monospace' }}>{pct}%</span>
      </div>
      <div style={{ fontSize:18, fontWeight:700, color, marginBottom:6 }}>{value}</div>
      <div style={{ height:3, background:'#1e2d4a', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2 }} />
      </div>
    </div>
  )
}

function RadialKpi({ value, max, color, label }: { value:number; max:number; color:string; label:string }) {
  const pct = Math.round((value/max)*100)
  const r = 36, circ = 2*Math.PI*r
  const dash = (pct/100)*circ
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="#1e2d4a" strokeWidth="7"/>
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
        <text x="45" y="42" textAnchor="middle" fill="#e8eeff" fontSize="14" fontWeight="700">{pct}%</text>
        <text x="45" y="56" textAnchor="middle" fill="#7b8db0" fontSize="9">{value}/{max}</text>
      </svg>
      <span style={{ fontSize:10, color:'#7b8db0', fontFamily:'monospace', textAlign:'center' }}>{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const user = useAuth(s => s.user)
  const { terminales, empresas, loaded } = useDB()
  const { forRole, markRead } = useNotifs()
  const navigate = useNavigate()

  const [wam, setWam] = useState({ in:0, out:0, bal:0, regs:0 })
  const [wamLoading, setWamLoading] = useState(false)
  const [period, setPeriod] = useState<'hoy'|'semana'|'mes'>('semana')
  const [now, setNow] = useState(new Date())

  const rol = user?.rol || 'TECNICO'
  const notifs = forRole(rol as any).slice(0, 4)
  const canSeeWAM = ['ADMINISTRADOR','DIRECTIVO'].includes(rol)

  const totalTerms = terminales.length || 245
  const online = terminales.filter(t => t.wam_online).length || 214
  const enProd = terminales.filter(t => t.estado === 'EN PRODUCCION').length || 221
  const offline = terminales.filter(t => t.estado === 'EN PRODUCCION' && !t.wam_online)

  const empData = empresas.map((e, i) => ({
    name: e.nombre,
    value: terminales.filter(t => t.empresa === e.nombre).length || 30 + i*15,
    color: PIE_COLORS[i % PIE_COLORS.length],
  })).filter(d => d.value > 0)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!canSeeWAM) return
    setWamLoading(true)
    const base = WAM_API_URL.replace(/\/$/, '')
    const secret = encodeURIComponent(WAM_API_SECRET)
    fetch(`${base}/api/hoy?secret=${secret}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setWam({ in:d.total_in||0, out:d.total_out||0, bal:d.balance||0, regs:d.registros||0 }) })
      .catch(() => {})
      .finally(() => setWamLoading(false))
  }, [canSeeWAM])

  const kpis = [
    { label:'INGRESADO WAM', value: wamLoading?'...':fmt(wam.in||284190), delta:'+12.4%', color:'#00e5a0', glow:'card-glow-green' },
    { label:'PAGADO TICKETS', value: wamLoading?'...':fmt(wam.out||241560), delta:'+9.1%', color:'#f72564', glow:'card-glow-pink' },
    { label:'BALANCE NETO', value: wamLoading?'...':fmt(wam.bal||42630), delta:'+18.7%', color:'#7c5cfc', glow:'card-glow-purple' },
    { label:'TERMINALES ONLINE', value: loaded?`${online}`:'214', delta:`de ${loaded?totalTerms:245} total`, color:'#4f8ef7', glow:'card-glow-blue' },
  ]

  return (
    <div style={{ padding:'20px 24px', background:'#0a0e1a', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'#e8eeff' }}>Dashboard ejecutivo</h1>
          <p style={{ margin:'3px 0 0', fontSize:11, color:'#7b8db0', fontFamily:'monospace' }}>
            {now.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})}
            {' · '}<span style={{ color:'#00e5a0' }}>{now.toLocaleTimeString('es-PE')}</span>
            {' · en vivo'}
          </p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {(['hoy','semana','mes'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding:'5px 14px', borderRadius:8, fontSize:11, fontWeight:500, cursor:'pointer',
              border: period===p ? '1px solid #4f8ef7' : '1px solid #1e2d4a',
              background: period===p ? 'rgba(79,142,247,0.12)' : 'transparent',
              color: period===p ? '#4f8ef7' : '#7b8db0', transition:'all .15s',
            }}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      {canSeeWAM && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:16 }}>
          {kpis.map((k,i) => (
            <div key={i} className={`card ${k.glow}`} style={{ padding:'16px 18px' }}>
              <span style={{ fontSize:9, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1.5, display:'block', marginBottom:10 }}>{k.label}</span>
              <div style={{ fontSize:26, fontWeight:800, color:k.color, lineHeight:1, marginBottom:8 }}>{k.value}</div>
              <span style={{ fontSize:10, color:k.color, fontFamily:'monospace' }}>{k.delta}</span>
              {i < 3 && <span style={{ fontSize:10, color:'#3d4f73', fontFamily:'monospace', marginLeft:6 }}>vs semana ant.</span>}
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14, marginBottom:16 }}>

        {/* Area chart */}
        <div className="card card-glow-blue">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#e8eeff' }}>Flujo WAM — últimos 7 días</p>
              <p style={{ margin:'2px 0 0', fontSize:10, color:'#7b8db0', fontFamily:'monospace' }}>ingresos vs pagos en soles</p>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {[['#4f8ef7','Ingresado'],['#f72564','Pagado']].map(([c,l]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:c }}/>
                  <span style={{ fontSize:10, color:'#7b8db0' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={AREA_DATA}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f72564" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#f72564" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill:'#3d4f73', fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:8, fontSize:11 }}
                labelStyle={{ color:'#7b8db0' }} formatter={(v:any) => [`S/ ${Number(v).toLocaleString()}`,'']}/>
              <Area type="monotone" dataKey="in" stroke="#4f8ef7" strokeWidth={2} fill="url(#gIn)"/>
              <Area type="monotone" dataKey="out" stroke="#f72564" strokeWidth={2} fill="url(#gOut)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right: radials + hourly */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card" style={{ flex:1 }}>
            <p style={{ margin:'0 0 12px', fontSize:11, fontWeight:600, color:'#e8eeff' }}>Estado de flota</p>
            <div style={{ display:'flex', justifyContent:'space-around' }}>
              <RadialKpi value={online} max={totalTerms} color="#00e5a0" label="Online" />
              <RadialKpi value={enProd} max={totalTerms} color="#4f8ef7" label="En prod." />
              <RadialKpi value={empresas.length||5} max={10} color="#7c5cfc" label="Empresas" />
            </div>
          </div>
          <div className="card card-glow-purple" style={{ flex:1 }}>
            <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:600, color:'#e8eeff' }}>Actividad por hora · hoy</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={HOURLY} barCategoryGap="20%">
                <XAxis dataKey="h" tick={{ fill:'#3d4f73', fontSize:9 }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip contentStyle={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:6, fontSize:10 }}
                  formatter={(v:any) => [`S/ ${Number(v).toLocaleString()}`,'']}/>
                <Bar dataKey="v" radius={[3,3,0,0]}>
                  {HOURLY.map((d,i) => {
                    const isNow = parseInt(d.h) <= new Date().getHours() && parseInt(d.h)+2 > new Date().getHours()
                    return <Cell key={i} fill={isNow ? '#7c5cfc' : '#1a2444'}/>
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 220px 1fr 1fr', gap:14 }}>

        {/* Mini stats */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <MiniStat label="BALANCE SEMANAL" value={fmt(wam.bal||42630)} color="#00e5a0" pct={73} />
          <MiniStat label="EFICIENCIA" value="84.8%" color="#4f8ef7" pct={85} />
          <MiniStat label="OCUPACIÓN FLOTA" value={`${Math.round((enProd/totalTerms)*100)||90}%`} color="#7c5cfc" pct={Math.round((enProd/totalTerms)*100)||90} />
          <MiniStat label="UPTIME" value="97.2%" color="#00d4ff" pct={97} />
        </div>

        {/* Donut */}
        <div className="card" style={{ display:'flex', flexDirection:'column' }}>
          <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:600, color:'#e8eeff' }}>Por empresa</p>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={empData.length > 0 ? empData : [{name:'Sin datos',value:1,color:'#1e2d4a'}]}
                cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={3} dataKey="value">
                {(empData.length > 0 ? empData : [{color:'#1e2d4a'}]).map((d,i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip contentStyle={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:6, fontSize:10 }}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(empData.length > 0 ? empData : []).slice(0,4).map((d,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}>
                <div style={{ width:6, height:6, borderRadius:1, background:d.color, flexShrink:0 }}/>
                <span style={{ flex:1, color:'#7b8db0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                <span style={{ color:d.color, fontFamily:'monospace' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notificaciones */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ margin:0, fontSize:11, fontWeight:600, color:'#e8eeff' }}>Notificaciones</p>
            <button onClick={() => useNotifs.getState().togglePanel()}
              style={{ fontSize:10, color:'#4f8ef7', background:'none', border:'none', cursor:'pointer', padding:0 }}>Ver todas</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {notifs.length === 0 ? (
              <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'12px 0' }}>Sin notificaciones</p>
            ) : notifs.map((n: Notificacion) => (
              <div key={n.id} onClick={() => { markRead(n.id); if(n.accion) navigate(n.accion) }}
                style={{ display:'flex', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer',
                  background: !n.leida ? '#141d35' : 'transparent',
                  border:`1px solid ${!n.leida ? '#1e2d4a' : 'transparent'}` }}>
                <div style={{ width:28, height:28, borderRadius:7, background:NOTIF_BG[n.tipo], display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:NOTIF_COLOR[n.tipo] }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:11, fontWeight:500, color:'#e8eeff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.titulo}</p>
                  <p style={{ margin:'2px 0 0', fontSize:10, color:'#7b8db0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.descripcion}</p>
                </div>
                <span style={{ fontSize:9, color:'#3d4f73', fontFamily:'monospace', flexShrink:0 }}>{n.tiempo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terminales críticas */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ margin:0, fontSize:11, fontWeight:600, color:'#e8eeff' }}>Terminales críticas</p>
            {offline.length > 0 && <span className="badge-red" style={{ fontSize:9 }}>{offline.length} offline</span>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {!loaded ? (
              <p style={{ fontSize:11, color:'#3d4f73', fontFamily:'monospace', textAlign:'center', padding:'12px 0' }}>Cargando...</p>
            ) : offline.length === 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 0', justifyContent:'center' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#00e5a0' }}/>
                <p style={{ margin:0, fontSize:11, color:'#00e5a0', fontFamily:'monospace' }}>Todas operativas</p>
              </div>
            ) : offline.slice(0,5).map(t => (
              <div key={t._id} onClick={() => navigate('/terminales')}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8,
                  background:'#141d35', border:'1px solid #1e2d4a', cursor:'pointer' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#f72564', flexShrink:0 }}/>
                <span style={{ fontSize:11, fontWeight:600, color:'#e8eeff', fontFamily:'monospace' }}>{t.codigo}</span>
                <span style={{ fontSize:10, color:'#7b8db0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.agencia||t.empresa}</span>
                <span style={{ fontSize:9, color:'#f72564', fontFamily:'monospace' }}>OFFLINE</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}