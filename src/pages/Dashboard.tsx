import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useNotifs } from '../store/notifs'
import { WAM_API_URL, WAM_API_SECRET } from '../lib/config'
import AnalyticsWAM from '../components/dashboard/AnalyticsWAM'
import type { Notificacion } from '../types'

// ── Leaflet loader ────────────────────────────────────
const L_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
const L_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'

function loadLeaflet(): Promise<void> {
  return new Promise(resolve => {
    if ((window as any).L) { resolve(); return }
    if (!document.querySelector(`link[href="${L_CSS}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = L_CSS
      document.head.appendChild(l)
    }
    if (document.querySelector(`script[src="${L_JS}"]`)) {
      const t = setInterval(() => { if ((window as any).L) { clearInterval(t); resolve() } }, 50)
      return
    }
    const s = document.createElement('script'); s.src = L_JS
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

// ── Coordenadas de distritos ──────────────────────────
const COORDS: Record<string, [number, number]> = {
  // Departamentos Peru
  'LIMA':         [-12.0464, -77.0428],
  'LA LIBERTAD':  [-8.1159,  -79.0300],
  'TRUJILLO':     [-8.1159,  -79.0300],
  'VIRU':         [-8.4186,  -78.7486],
  'UCAYALI':      [-8.3791,  -74.5539],
  'PUCALLPA':     [-8.3791,  -74.5539],
  'AREQUIPA':     [-16.4090, -71.5375],
  'CUSCO':        [-13.5319, -71.9675],
  'PIURA':        [-5.1945,  -80.6328],
  'LAMBAYEQUE':   [-6.7011,  -79.9068],
  'CHICLAYO':     [-6.7011,  -79.9068],
  'ANCASH':       [-9.5300,  -77.5283],
  'HUANCAYO':     [-12.0651, -75.2049],
  'JUNIN':        [-12.0651, -75.2049],
  'ICA':          [-14.0678, -75.7286],
  'PUNO':         [-15.8402, -70.0219],
  'CAJAMARCA':    [-7.1638,  -78.5003],
  'LORETO':       [-3.7491,  -73.2538],
  'IQUITOS':      [-3.7491,  -73.2538],
  'TACNA':        [-18.0066, -70.2481],
  'MOQUEGUA':     [-17.1936, -70.9356],
  'TUMBES':       [-3.5669,  -80.4515],
  'AMAZONAS':     [-6.2309,  -77.8693],
  'MADRE DE DIOS':[-12.5932, -69.1853],
  'HUANUCO':      [-9.9306,  -76.2422],
  'PASCO':        [-10.6866, -76.2572],
  'APURIMAC':     [-14.0522, -72.8914],
  'AYACUCHO':     [-13.1588, -74.2236],
  'HUANCAVELICA': [-12.7869, -74.9759],
  'SAN MARTIN':   [-6.5000,  -76.3833],
  // Distritos Lima
  'MIRAFLORES':   [-12.1190, -77.0369],
  'SAN ISIDRO':   [-12.0964, -77.0369],
  'SAN JUAN DE LURIGANCHO': [-12.0219, -76.9931],
  'SJL':          [-12.0219, -76.9931],
  'CHORRILLOS':   [-12.1731, -77.0201],
  'VILLA EL SALVADOR': [-12.2133, -76.9428],
  'LOS OLIVOS':   [-11.9772, -77.0733],
  'CALLAO':       [-12.0566, -77.1180],
  'SURCO':        [-12.1386, -76.9956],
  'LA VICTORIA':  [-12.0712, -77.0229],
  'ATE':          [-12.0267, -76.9189],
  'INDEPENDENCIA':[-11.9950, -77.0606],
  'COMAS':        [-11.9371, -77.0456],
  'BREÑA':        [-12.0600, -77.0500],
  'SAN MARTIN DE PORRES': [-12.0232, -77.0892],
  'CERCADO':      [-12.0464, -77.0300],
  'RIMAC':        [-12.0267, -77.0333],
  // Trujillo distritos
  'LA ESPERANZA': [-8.0727,  -79.0494],
  'EL PORVENIR':  [-8.0942,  -79.0017],
  'FLORENCIA DE MORA': [-8.0858, -79.0192],
}

const EMP_COLORS = ['#00e5a0', '#4f8ef7', '#7c5cfc', '#f7931a', '#00d4ff', '#f72564', '#ed93b1', '#97c459']

function getCoords(ag: any): [number, number] {
  if (ag.lat && ag.lng) return [ag.lat, ag.lng]
  const upper = (s: string) => (s || '').toUpperCase()
  const dept  = upper(ag.sucursal)   // departamento: LIMA, VIRU, UCAYALI...
  const sub   = upper(ag.subagencia) // nombre agencia
  // Buscar por departamento primero (campo más confiable)
  for (const [k, v] of Object.entries(COORDS)) {
    if (dept === k || dept.includes(k)) return v
  }
  // Luego por nombre de subagencia
  for (const [k, v] of Object.entries(COORDS)) {
    if (sub.includes(k)) return v
  }
  // Default: Lima con pequeño offset para no apilar
  const seed = (ag.subagencia || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
  const dx = ((seed % 100) - 50) / 800
  const dy = ((seed % 70)  - 35) / 600
  return [-12.0464 + dx, -77.0428 + dy]
}

// ── Mapa component — Estilo C: Positron invertido + pins con número ─────
function MapaAgencias({ agencias, empresas, terminales }: any) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!divRef.current) return

    loadLeaflet().then(() => {
      const L = (window as any).L

      // Estilos popup y zoom dark
      if (!document.getElementById('tlos-map-css')) {
        const st = document.createElement('style'); st.id = 'tlos-map-css'
        st.textContent = [
          '.leaflet-popup-content-wrapper{background:#0f1629!important;border:1px solid #1e2d4a!important;',
          'border-radius:10px!important;box-shadow:none!important;padding:0!important}',
          '.leaflet-popup-content{margin:0!important}',
          '.leaflet-popup-tip{background:#0f1629!important}',
          '.leaflet-popup-close-button{color:#7b8db0!important;top:6px!important;right:8px!important}',
          '.leaflet-control-zoom a{background:#0f1629!important;color:#7b8db0!important;border-color:#1e2d4a!important}',
          '.leaflet-control-zoom a:hover{background:#141d35!important;color:#e8eeff!important}',
        ].join('')
        document.head.appendChild(st)
      }

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const map = L.map(divRef.current, {
        center: [-12.0464, -77.0428], zoom: 12,
        zoomControl: false, attributionControl: false,
      })
      mapRef.current = map

      // Tile Positron (minimalista) con CSS filter para invertir a negro
      const tileLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      ).addTo(map)

      // Aplicar filtro CSS al tile layer para invertir colores
      tileLayer.on('tileload', function(e: any) {
        if (e.tile) {
          e.tile.style.filter = 'invert(90%) hue-rotate(200deg) brightness(0.85) saturate(0.5)'
        }
      })

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      agencias.forEach((ag: any) => {
        const coords = getCoords(ag)
        const ei     = empresas.findIndex((e: any) => e.nombre === ag.empresa)
        const color  = EMP_COLORS[ei >= 0 ? ei % EMP_COLORS.length : 0]
        const terms  = terminales.filter((t: any) => t.id_sub === ag.id_sub)
        const count  = terms.length
        const size   = count > 9 ? 28 : 24

        // Pin circular con número de terminales adentro
        const isLight = ['#00e5a0','#00d4ff'].includes(color)
        const textColor = isLight ? '#0a0e1a' : '#ffffff'

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${color};
            border:2px solid rgba(255,255,255,0.2);
            display:flex;align-items:center;justify-content:center;
            font-size:${count > 9 ? 10 : 11}px;font-weight:700;
            color:${textColor};
            font-family:monospace;
            cursor:pointer;
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
          ">${count}</div>`,
          iconSize:   [size, size],
          iconAnchor: [size/2, size/2],
        })

        L.marker(coords, { icon }).addTo(map).bindPopup(`
          <div style="padding:10px 12px;min-width:160px;font-family:system-ui,sans-serif">
            <div style="font-size:12px;font-weight:600;color:#e8eeff;margin-bottom:3px">${ag.subagencia}</div>
            <div style="font-size:9px;color:#7b8db0;font-family:monospace;margin-bottom:8px">${ag.empresa} · ${ag.sucursal || 'Lima'}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
              <div style="background:#141d35;border-radius:6px;padding:6px 8px">
                <div style="font-size:8px;color:#7b8db0;font-family:monospace;margin-bottom:2px">TERMINALES</div>
                <div style="font-size:18px;font-weight:800;color:${color};line-height:1">${count}</div>
              </div>
              <div style="background:#141d35;border-radius:6px;padding:6px 8px">
                <div style="font-size:8px;color:#7b8db0;font-family:monospace;margin-bottom:2px">ESTADO</div>
                <div style="font-size:10px;font-weight:600;color:${ag.estado === 'EN PRODUCCION' ? '#00e5a0' : '#f7931a'}">${ag.estado === 'EN PRODUCCION' ? 'ACTIVA' : 'PENDIENTE'}</div>
              </div>
            </div>
          </div>
        `, { className: '', maxWidth: 220 })
      })
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [agencias, empresas, terminales])

  return (
    <div style={{ position: 'relative', height: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={divRef} style={{ height: '100%', width: '100%' }} />
      {empresas.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 1000,
          background: 'rgba(10,14,26,0.92)', border: '1px solid #1e2d4a',
          borderRadius: 8, padding: '6px 10px',
        }}>
          {empresas.slice(0, 5).map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: i < 4 ? 3 : 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: EMP_COLORS[i % EMP_COLORS.length] }} />
              <span style={{ fontSize: 8, color: '#7b8db0', fontFamily: 'monospace', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Radial gauge ──────────────────────────────────────
function RadialKpi({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct  = Math.round((value / Math.max(max, 1)) * 100)
  const r    = 34, circ = 2 * Math.PI * r, dash = (pct / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg width="78" height="78" viewBox="0 0 78 78">
        <circle cx="39" cy="39" r={r} fill="none" stroke="#1e2d4a" strokeWidth="6" />
        <circle cx="39" cy="39" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
        <text x="39" y="36" textAnchor="middle" fill="#e8eeff" fontSize="12" fontWeight="700">{pct}%</text>
        <text x="39" y="48" textAnchor="middle" fill="#7b8db0" fontSize="7">{value}/{max}</text>
      </svg>
      <span style={{ fontSize: 9, color: '#7b8db0', fontFamily: 'monospace' }}>{label}</span>
    </div>
  )
}

// ── Mini stat ─────────────────────────────────────────
function MiniStat({ label, value, color, pct }: { label: string; value: string; color: string; pct: number }) {
  return (
    <div style={{ background: '#141d35', border: '1px solid #1e2d4a', borderRadius: 9, padding: '9px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 8, color: '#7b8db0', fontFamily: 'monospace', letterSpacing: 1 }}>{label}</span>
        <span style={{ fontSize: 8, color, fontFamily: 'monospace' }}>{pct}%</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1, marginBottom: 5 }}>{value}</div>
      <div style={{ height: 2, background: '#1e2d4a', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 1 }} />
      </div>
    </div>
  )
}

// ── Constants ─────────────────────────────────────────
const AREA_DATA = [
  { day: 'Lun', in: 32400, out: 28100 }, { day: 'Mar', in: 41200, out: 35600 },
  { day: 'Mié', in: 38900, out: 33200 }, { day: 'Jue', in: 45600, out: 38900 },
  { day: 'Vie', in: 52100, out: 44300 }, { day: 'Sáb', in: 48300, out: 41200 },
  { day: 'Dom', in: 25700, out: 21800 },
]
const PIE_COLORS   = ['#4f8ef7', '#7c5cfc', '#00e5a0', '#f7931a', '#00d4ff']
const NOTIF_BG     : Record<string, string> = { danger: 'rgba(247,37,100,0.12)', warn: 'rgba(247,147,26,0.12)', info: 'rgba(79,142,247,0.12)', success: 'rgba(0,229,160,0.12)' }
const NOTIF_COLOR  : Record<string, string> = { danger: '#f72564', warn: '#f7931a', info: '#4f8ef7', success: '#00e5a0' }
const fmt = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`

// ── Dashboard ─────────────────────────────────────────
export default function Dashboard() {
  const user                              = useAuth(s => s.user)
  const { terminales, empresas, agencias, loaded, loadAll } = useDB()
  const { forRole, markRead }             = useNotifs()
  const navigate                          = useNavigate()

  const [wam, setWam]       = useState({ in: 0, out: 0, bal: 0, regs: 0 })
  const [wamLoad, setWL]    = useState(false)
  const [period, setPeriod] = useState<'hoy' | 'semana' | 'mes'>('semana')
  const [now, setNow]       = useState(new Date())

  const rol        = user?.rol || 'TECNICO'
  const notifs     = forRole(rol as any).slice(0, 5)
  const canSeeWAM  = ['ADMINISTRADOR', 'DIRECTIVO'].includes(rol)
  const totalTerms = terminales.length  || 245
  const online     = terminales.filter(t => t.wam_online).length || 214
  const enProd     = terminales.filter(t => t.estado === 'EN PRODUCCION').length || 221
  const offline    = terminales.filter(t => t.estado === 'EN PRODUCCION' && !t.wam_online)
  const topTerms   = [...terminales].slice(0, 5)

  const empData = empresas.map((e, i) => ({
    name:  e.nombre,
    value: terminales.filter(t => t.empresa === e.nombre).length || 30 + i * 15,
    color: PIE_COLORS[i % PIE_COLORS.length],
  })).filter(d => d.value > 0)

  useEffect(() => {
  if (!loaded && !terminales.length) loadAll()
}, [])

  useEffect(() => {
    if (!canSeeWAM) return
    setWL(true)
    const base   = WAM_API_URL.replace(/\/$/, '')
    const secret = encodeURIComponent(WAM_API_SECRET)
    fetch(`${base}/api/hoy?secret=${secret}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setWam({ in: d.total_in || 0, out: d.total_out || 0, bal: d.balance || 0, regs: d.registros || 0 }) })
      .catch(() => {})
      .finally(() => setWL(false))
  }, [canSeeWAM])

  return (
    <div style={{ padding: '18px 22px', background: '#0a0e1a', minHeight: '100vh' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#e8eeff' }}>Dashboard ejecutivo</h1>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#7b8db0', fontFamily: 'monospace' }}>
            {now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}<span style={{ color: '#00e5a0' }}>{now.toLocaleTimeString('es-PE')}</span>
            {' · en vivo'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['hoy', 'semana', 'mes'] as const).map(p => (
            <button key={`period-${p}`} onClick={() => setPeriod(p)} style={{
              padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              border:      period === p ? '1px solid #4f8ef7' : '1px solid #1e2d4a',
              background:  period === p ? 'rgba(79,142,247,0.12)' : 'transparent',
              color:       period === p ? '#4f8ef7' : '#7b8db0',
            }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* ── KPIs ── */}
      {canSeeWAM && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 11, marginBottom: 12 }}>
          {[
            { label: 'INGRESADO WAM',     value: wamLoad ? '...' : fmt(wam.in  || 284190), delta: '+12.4%', color: '#00e5a0', cls: 'card-glow-green' },
            { label: 'PAGADO TICKETS',    value: wamLoad ? '...' : fmt(wam.out || 241560), delta: '+9.1%',  color: '#f72564', cls: 'card-glow-pink'  },
            { label: 'BALANCE NETO',      value: wamLoad ? '...' : fmt(wam.bal || 42630),  delta: '+18.7%', color: '#7c5cfc', cls: 'card-glow-purple' },
            { label: 'TERMINALES ONLINE', value: loaded  ? `${online}` : '214',            delta: `de ${loaded ? totalTerms : 245} total`, color: '#4f8ef7', cls: 'card-glow-blue' },
          ].map((k, i) => (
            <div key={i} className={`card ${k.cls}`} style={{ padding: '13px 15px' }}>
              <span style={{ fontSize: 8, color: '#7b8db0', fontFamily: 'monospace', letterSpacing: 1.5, display: 'block', marginBottom: 7 }}>{k.label}</span>
              <div style={{ fontSize: 23, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 5 }}>{k.value}</div>
              <span style={{ fontSize: 9, color: k.color, fontFamily: 'monospace' }}>{k.delta}</span>
              {i < 3 && <span style={{ fontSize: 9, color: '#3d4f73', fontFamily: 'monospace', marginLeft: 5 }}>vs sem. ant.</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── ROW 2: Area + Mapa + [Radiales+Analytics] ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 270px', gap: 11, marginBottom: 11 }}>

        {/* Area chart */}
        <div className="card card-glow-blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Flujo WAM — últimos 7 días</p>
              <p style={{ margin: '2px 0 0', fontSize: 9, color: '#7b8db0', fontFamily: 'monospace' }}>ingresos vs pagos en soles</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['#4f8ef7', 'Ingresado'], ['#f72564', 'Pagado']].map(([c, l]) => (
                <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: c as string }} />
                  <span style={{ fontSize: 9, color: '#7b8db0' }}>{l as string}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={148}>
            <AreaChart data={AREA_DATA}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4f8ef7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f72564" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f72564" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#3d4f73', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#7b8db0' }} formatter={(v: any) => [`S/ ${Number(v).toLocaleString()}`, '']} />
              <Area type="monotone" dataKey="in"  stroke="#4f8ef7" strokeWidth={2} fill="url(#gIn)"  />
              <Area type="monotone" dataKey="out" stroke="#f72564" strokeWidth={2} fill="url(#gOut)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Mapa */}
        <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Mapa de sedes</p>
              <p style={{ margin: '2px 0 0', fontSize: 9, color: '#7b8db0', fontFamily: 'monospace' }}>{agencias.length || 48} agencias · Lima y Trujillo</p>
            </div>
            <span style={{ fontSize: 8, background: 'rgba(0,229,160,0.1)', color: '#00e5a0', border: '1px solid rgba(0,229,160,0.2)', padding: '2px 7px', borderRadius: 10, fontFamily: 'monospace' }}>LIVE</span>
          </div>
          <div style={{ flex: 1, minHeight: 180 }}>
            <MapaAgencias agencias={agencias} empresas={empresas} terminales={terminales} />
          </div>
        </div>

        {/* Radiales + Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ padding: '11px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Estado de flota</p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <RadialKpi value={online}          max={totalTerms}    color="#00e5a0" label="Online"   />
              <RadialKpi value={enProd}           max={totalTerms}    color="#4f8ef7" label="En prod." />
              <RadialKpi value={empresas.length || 5} max={10}       color="#7c5cfc" label="Empresas" />
            </div>
          </div>
          <div className="card card-glow-purple" style={{ padding: '11px', flex: 1 }}>
            <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Analytics WAM</p>
            <AnalyticsWAM />
          </div>
        </div>
      </div>

      {/* ── ROW 3 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 195px 1fr 1fr', gap: 11 }}>

        {/* Mini stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <MiniStat label="BALANCE SEMANAL" value={fmt(wam.bal || 42630)} color="#00e5a0" pct={73} />
          <MiniStat label="EFICIENCIA"      value="84.8%"                 color="#4f8ef7" pct={85} />
          <MiniStat label="OCUPACIÓN FLOTA" value={`${Math.round((enProd / totalTerms) * 100) || 90}%`} color="#7c5cfc" pct={Math.round((enProd / totalTerms) * 100) || 90} />
          <MiniStat label="UPTIME"          value="97.2%"                 color="#00d4ff" pct={97} />
        </div>

        {/* Donut */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Por empresa</p>
          <ResponsiveContainer width="100%" height={95}>
            <PieChart>
              <Pie
                data={empData.length > 0 ? empData : [{ name: 'Sin datos', value: 1, color: '#1e2d4a' }]}
                cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={3} dataKey="value"
              >
                {(empData.length > 0 ? empData : [{ color: '#1e2d4a' }]).map((d: any, i: number) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {empData.slice(0, 4).map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: 1, background: d.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 9, color: '#7b8db0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span style={{ fontSize: 9, color: d.color, fontFamily: 'monospace' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notificaciones */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Notificaciones</p>
            <button onClick={() => useNotifs.getState().togglePanel()}
              style={{ fontSize: 9, color: '#4f8ef7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver todas</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notifs.length === 0 ? (
              <p style={{ fontSize: 10, color: '#3d4f73', fontFamily: 'monospace', textAlign: 'center', padding: '10px 0' }}>Sin notificaciones</p>
            ) : notifs.map((n: Notificacion) => (
              <div key={n.id} onClick={() => { markRead(n.id); if (n.accion) navigate(n.accion) }}
                style={{ display: 'flex', gap: 8, padding: '6px 7px', borderRadius: 8, cursor: 'pointer',
                  background: !n.leida ? '#141d35' : 'transparent',
                  border: `1px solid ${!n.leida ? '#1e2d4a' : 'transparent'}` }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: NOTIF_BG[n.tipo], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: NOTIF_COLOR[n.tipo] }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 500, color: '#e8eeff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.titulo}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 9, color: '#7b8db0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.descripcion}</p>
                </div>
                <span style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', flexShrink: 0 }}>{n.tiempo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terminales */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Terminales</p>
            {offline.length > 0 && (
              <span style={{ fontSize: 8, background: 'rgba(247,37,100,0.1)', color: '#f72564', border: '1px solid rgba(247,37,100,0.2)', padding: '1px 6px', borderRadius: 10, fontFamily: 'monospace' }}>{offline.length} offline</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {!loaded ? (
              <p style={{ fontSize: 10, color: '#3d4f73', fontFamily: 'monospace', textAlign: 'center', padding: '10px 0' }}>Cargando...</p>
            ) : offline.length === 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 7px', borderBottom: '1px solid #1e2d4a', marginBottom: 2 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5a0' }} />
                  <p style={{ margin: 0, fontSize: 10, color: '#00e5a0', fontFamily: 'monospace' }}>Todas operativas</p>
                </div>
                {topTerms.slice(0, 4).map(t => (
                  <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, background: '#141d35', border: '1px solid #1e2d4a' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5a0', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#e8eeff', fontFamily: 'monospace' }}>{t.codigo}</span>
                    <span style={{ fontSize: 9, color: '#7b8db0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.agencia || t.empresa}</span>
                    <span style={{ fontSize: 8, color: '#00e5a0', fontFamily: 'monospace' }}>ACTIVA</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                {offline.slice(0, 3).map(t => (
                  <div key={t._id} onClick={() => navigate('/terminales')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, background: '#141d35', border: '1px solid #1e2d4a', cursor: 'pointer' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f72564', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#e8eeff', fontFamily: 'monospace' }}>{t.codigo}</span>
                    <span style={{ fontSize: 9, color: '#7b8db0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.agencia || t.empresa}</span>
                    <span style={{ fontSize: 8, color: '#f72564', fontFamily: 'monospace' }}>OFFLINE</span>
                  </div>
                ))}
                {topTerms.filter(t => t.wam_online).slice(0, 2).map(t => (
                  <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, background: 'rgba(0,229,160,0.03)', border: '1px solid rgba(0,229,160,0.1)' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5a0', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#e8eeff', fontFamily: 'monospace' }}>{t.codigo}</span>
                    <span style={{ fontSize: 9, color: '#7b8db0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.agencia || t.empresa}</span>
                    <span style={{ fontSize: 8, color: '#00e5a0', fontFamily: 'monospace' }}>ONLINE</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}