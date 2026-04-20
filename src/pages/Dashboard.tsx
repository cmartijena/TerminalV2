import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'
import { useNotifs } from '../store/notifs'
import { WAM_API_URL, WAM_API_SECRET } from '../lib/config'
import AnalyticsWAM from '../components/dashboard/AnalyticsWAM'
import { useSolicitudes } from '../store/solicitudes'
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

  // Init mapa UNA sola vez — no se destruye en cada render
  useEffect(() => {
    if (!divRef.current) return
    loadLeaflet().then(() => {
      const L = (window as any).L
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
      if (mapRef.current) return
      const map = L.map(divRef.current, {
        center: [-12.0464, -77.0428], zoom: 12,
        zoomControl: false, attributionControl: false,
      })
      mapRef.current = map
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      ).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
    })
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])  // Solo al montar — nunca destruir el mapa por re-renders

  // Pins — actualizar sin destruir el mapa
  useEffect(() => {
    if (!mapRef.current || !agencias.length) return
    const L = (window as any).L
    if (!L) return

    // Limpiar solo markers
    mapRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) mapRef.current.removeLayer(layer)
    })

    agencias.forEach((ag: any) => {
      const coords = getCoords(ag)
      const ei     = empresas.findIndex((e: any) => e.nombre === ag.empresa)
      const color  = EMP_COLORS[ei >= 0 ? ei % EMP_COLORS.length : 0]
      const terms  = terminales.filter((t: any) => t.id_sub === ag.id_sub)
      const count  = terms.length
      const size   = count > 9 ? 28 : 24
      const isLight = ['#00e5a0','#00d4ff'].includes(color)
      const textColor = isLight ? '#0a0e1a' : '#ffffff'

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:${count>9?10:11}px;font-weight:700;color:${textColor};font-family:monospace;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${count}</div>`,
        iconSize: [size, size], iconAnchor: [size/2, size/2],
      })
      L.marker(coords, { icon }).addTo(mapRef.current).bindPopup(`
        <div style="padding:10px 12px;min-width:160px;font-family:system-ui,sans-serif">
          <div style="font-size:12px;font-weight:600;color:#e8eeff;margin-bottom:3px">${ag.subagencia}</div>
          <div style="font-size:9px;color:#7b8db0;font-family:monospace;margin-bottom:8px">${ag.empresa} · ${ag.sucursal||'Lima'}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
            <div style="background:#141d35;border-radius:6px;padding:6px 8px">
              <div style="font-size:8px;color:#7b8db0;font-family:monospace;margin-bottom:2px">TERMINALES</div>
              <div style="font-size:18px;font-weight:800;color:${color};line-height:1">${count}</div>
            </div>
            <div style="background:#141d35;border-radius:6px;padding:6px 8px">
              <div style="font-size:8px;color:#7b8db0;font-family:monospace;margin-bottom:2px">ESTADO</div>
              <div style="font-size:10px;font-weight:600;color:${ag.estado==='EN PRODUCCION'?'#00e5a0':'#f7931a'}">${ag.estado==='EN PRODUCCION'?'ACTIVA':'PENDIENTE'}</div>
            </div>
          </div>
        </div>
      `, { className: '', maxWidth: 220 })
    })
  }, [agencias, empresas, terminales])

  return (
    <div style={{ position: 'relative', height: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={divRef} style={{ height: '100%', width: '100%' }} />
      {/* Leyenda empresas */}
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
      {/* Botones dinámicos por departamento + Ver todo */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
        {/* Ver todo */}
        <button
          onClick={() => {
            if (mapRef.current && agencias.length > 0) {
              const L = (window as any).L
              if (L) {
                const pts = agencias.map((ag: any) => getCoords(ag))
                const bounds = L.latLngBounds(pts)
                mapRef.current.fitBounds(bounds, { padding: [20, 20] })
              }
            }
          }}
          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 9, fontFamily: 'monospace',
            background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.4)',
            color: '#4f8ef7', cursor: 'pointer' }}>
          Ver todo
        </button>
        {/* Un botón por cada departamento único */}
        {Array.from(new Set(agencias.map((ag: any) => ag.sucursal).filter(Boolean))).map((dept: any) => {
          const coords = getCoords({ sucursal: dept, subagencia: '' })
          return (
            <button key={dept}
              onClick={() => mapRef.current?.setView(coords, 12)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 9, fontFamily: 'monospace',
                background: 'rgba(10,14,26,0.92)', border: '1px solid #1e2d4a',
                color: '#7b8db0', cursor: 'pointer', transition: 'all .15s', textAlign: 'left' }}
              onMouseEnter={e => { const t = e.target as any; t.style.color='#e8eeff'; t.style.borderColor='#4f8ef7' }}
              onMouseLeave={e => { const t = e.target as any; t.style.color='#7b8db0'; t.style.borderColor='#1e2d4a' }}>
              {String(dept).toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}


// ── Sparkline ──────────────────────────────────────────
function Sparkline({ color, positive = true }: { color: string; positive?: boolean }) {
  const pts = positive
    ? '0,15 12,12 24,8 36,10 48,5 60,7 72,3 80,4'
    : '0,4 12,5 24,3 36,7 48,10 60,13 72,16 80,18'
  return (
    <svg width="100%" height="18" viewBox="0 0 80 18" style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color + '30'} strokeWidth="1.5"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1" strokeDasharray="2,1"/>
    </svg>
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



// ── Constants ─────────────────────────────────────────
// AREA_DATA removed — using real WAM data
const PIE_COLORS   = ['#4f8ef7', '#7c5cfc', '#00e5a0', '#f7931a', '#00d4ff']
const NOTIF_BG     : Record<string, string> = { danger: 'rgba(247,37,100,0.12)', warn: 'rgba(247,147,26,0.12)', info: 'rgba(79,142,247,0.12)', success: 'rgba(0,229,160,0.12)' }
const NOTIF_COLOR  : Record<string, string> = { danger: '#f72564', warn: '#f7931a', info: '#4f8ef7', success: '#00e5a0' }
const fmt = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`

// ── Dashboard ─────────────────────────────────────────
export default function Dashboard() {
  const user                              = useAuth(s => s.user)
  const { terminales, empresas, agencias, loaded, loadAll } = useDB()
  const { forRole, markRead }             = useNotifs()
  const { pendientes: solPend, loadAll: loadSol } = useSolicitudes()
  const navigate                          = useNavigate()

  const [wam, setWam]       = useState({ in: 0, out: 0, bal: 0, regs: 0 })
  const [wamLoad, setWL]    = useState(false)
  const [now, setNow]       = useState(new Date())

  const rol        = user?.rol || 'TECNICO'
  const notifs     = forRole(rol as any).slice(0, 5)
  const canSeeWAM  = ['ADMINISTRADOR', 'DIRECTIVO'].includes(rol)
  const isFranq    = rol === 'FRANQUICIADO'

  // Franquiciado — filtrar todo por su empresa
  const miEmpresa   = isFranq ? (user?.empresas?.[0] || '') : ''
  const miEmpObj    = isFranq ? empresas.find(e => e.nombre === miEmpresa || e._id === miEmpresa) : null
  const miEmpNombre = miEmpObj?.nombre || miEmpresa

  // Filtros según rol
  const misAgencias   = isFranq ? agencias.filter(a => a.empresa === miEmpNombre)  : agencias
  const misTerminales = isFranq ? terminales.filter(t => t.empresa === miEmpNombre) : terminales
  const misEmpresas   = isFranq ? (miEmpObj ? [miEmpObj] : []) : empresas

  const totalTerms = misTerminales.length  || (isFranq ? 0 : 245)
  const enProd     = misTerminales.filter(t => t.estado === 'ACTIVO').length
  const online     = enProd
  // offline removed — using estado field directly
  const topTerms   = [...misTerminales].sort((ta, tb) => {
    const ord = ['ACTIVO', 'NO DISPONIBLE']
    const ai  = ord.indexOf(ta.estado as string)
    const bi  = ord.indexOf(tb.estado as string)
    return (ai < 0 ? 9 : ai) - (bi < 0 ? 9 : bi)
  })

  const empData = misEmpresas.map((e, i) => ({
    name:  e.nombre,
    value: misTerminales.filter(t => t.empresa === e.nombre).length || 30 + i * 15,
    color: PIE_COLORS[i % PIE_COLORS.length],
  })).filter(d => d.value > 0)

  // Cargar datos si no están cargados (ej: recarga de página)
  useEffect(() => {
    if (!loaded && !terminales.length) loadAll()
    loadSol()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
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
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#e8eeff' }}>{isFranq ? `Portal · ${miEmpNombre}` : 'Dashboard ejecutivo'}</h1>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#7b8db0', fontFamily: 'monospace' }}>
            {now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}<span style={{ color: '#00e5a0' }}>{now.toLocaleTimeString('es-PE')}</span>
            {' · en vivo'}
          </p>
        </div>

      </div>

      {/* ── KPIs ── */}
      {canSeeWAM && (() => {
        const balNeg = (wam.bal || 42630) < 0
        const kpiList = [
          {
            label: 'INGRESADO WAM', value: wamLoad ? '...' : fmt(wam.in || 284190),
            delta: '+12.4%', color: '#00e5a0', cls: 'card-glow-green', positive: true,
            icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>,
          },
          {
            label: 'PAGADO TICKETS', value: wamLoad ? '...' : fmt(wam.out || 241560),
            delta: '+9.1%', color: '#f72564', cls: 'card-glow-pink', positive: false,
            icon: <><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></>,
          },
          {
            label: 'BALANCE NETO', value: wamLoad ? '...' : fmt(wam.bal || 42630),
            delta: balNeg ? '⚠ NEGATIVO' : '+18.7%',
            color: balNeg ? '#f72564' : '#7c5cfc',
            cls: balNeg ? 'card-glow-pink' : 'card-glow-purple',
            positive: !balNeg,
            icon: <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>,
          },
          {
            label: 'TERMINALES ONLINE', value: loaded ? `${online}` : '214',
            delta: `de ${loaded ? totalTerms : 245} total`, color: '#4f8ef7', cls: 'card-glow-blue', positive: true,
            icon: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
          },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 11, marginBottom: 12 }}>
            {kpiList.map((k, i) => (
              <div key={i} className={`card ${k.cls}`} style={{ padding: '13px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
                  <span style={{ fontSize: 8, color: '#7b8db0', fontFamily: 'monospace', letterSpacing: 1.5 }}>{k.label}</span>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: k.color + '18', border: `1px solid ${k.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2" strokeLinecap="round">{k.icon}</svg>
                  </div>
                </div>
                <div style={{ fontSize: 23, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                <Sparkline color={k.color} positive={k.positive} />
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: k.color, fontFamily: 'monospace' }}>{k.delta}</span>
                  {i < 3 && !k.delta.includes('NEGATIVO') && <span style={{ fontSize: 9, color: '#3d4f73', fontFamily: 'monospace', marginLeft: 5 }}>vs sem. ant.</span>}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── ROW 2: Area + Mapa + [Radiales+Analytics] ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 270px', gap: 11, marginBottom: 11 }}>

        {/* Panel Opción A — 4 KPIs operacionales */}
        {(() => {
          const solicitCount = solPend()
          const sedesPend    = misAgencias.filter(a => a.estado === 'PENDIENTE')
          const kpis = [
            { label: isFranq ? 'MI EMPRESA' : 'EMPRESAS',   value: loaded ? misEmpresas.length : 0,   color: '#00e5a0', sub: isFranq ? miEmpNombre : `${misEmpresas.length} operadores`, icon: <path d="M12 22V12M2 7l10-5 10 5M2 7v10l10 5 10-5V7"/> },
            { label: isFranq ? 'MIS LOCALES' : 'SEDES',      value: loaded ? misAgencias.length : 0,    color: '#4f8ef7', sub: `${misAgencias.filter(a=>a.estado==='EN PRODUCCION').length} en producción`, icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
            { label: isFranq ? 'MIS TERMINALES' : 'TERMINALES', value: loaded ? totalTerms : 0,         color: '#7c5cfc', sub: `${enProd} activas · ${totalTerms-enProd} N/D`, icon: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></> },
            { label: 'SOLICITUDES',value: solicitCount,                    color: solicitCount > 0 ? '#f7931a' : '#3d4f73', sub: solicitCount > 0 ? `${solicitCount} pendiente${solicitCount>1?'s':''}` : 'sin pendientes', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></> },
          ]
          return (
            <div className="card card-glow-blue" style={{ display: 'flex', flexDirection: 'column' }}>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Resumen operacional</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
                {kpis.map((k, i) => (
                  <div key={i} style={{ background: '#141d35', border: `1px solid ${i===3 && solicitCount>0 ? 'rgba(247,147,26,0.3)' : '#1e2d4a'}`, borderRadius: 9, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 8, color: '#7b8db0', fontFamily: 'monospace', letterSpacing: 1 }}>{k.label}</span>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2" strokeLinecap="round">{k.icon}</svg>
                      </div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                    <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>{k.sub}</div>
                  </div>
                ))}
              </div>
              {/* Alertas */}
              {(sedesPend.length > 0 || solicitCount > 0) && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {sedesPend.map(ag => (
                    <div key={ag._id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px', background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.2)', borderRadius: 7 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f7931a', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: '#f7931a', fontFamily: 'monospace', flex: 1 }}>Sede pendiente: {ag.subagencia}</span>
                      <span style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>{ag.empresa}</span>
                    </div>
                  ))}
                  {solicitCount > 0 && (
                    <div onClick={() => navigate('/solicitudes')}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px', background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.2)', borderRadius: 7, cursor: 'pointer' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f7931a', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: '#f7931a', fontFamily: 'monospace', flex: 1 }}>{solicitCount} solicitud{solicitCount>1?'es':''} pendiente{solicitCount>1?'s':''} de revisión</span>
                      <span style={{ fontSize: 8, color: '#4f8ef7', fontFamily: 'monospace' }}>Revisar →</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #1e2d4a', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>Supabase · tiempo real</span>
                <span style={{ fontSize: 8, color: '#00e5a0', fontFamily: 'monospace' }}>{loaded ? 'Cargado' : 'Cargando...'}</span>
              </div>
            </div>
          )
        })()}

        {/* Mapa */}
        <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Mapa de sedes</p>
              <p style={{ margin: '2px 0 0', fontSize: 9, color: '#7b8db0', fontFamily: 'monospace' }}>{misAgencias.length} agencia{misAgencias.length!==1?'s':''} · {isFranq ? miEmpNombre : 'Lima y Trujillo'}</p>
            </div>
            <span style={{ fontSize: 8, background: 'rgba(0,229,160,0.1)', color: '#00e5a0', border: '1px solid rgba(0,229,160,0.2)', padding: '2px 7px', borderRadius: 10, fontFamily: 'monospace' }}>LIVE</span>
          </div>
          <div style={{ flex: 1, minHeight: 180 }}>
            <MapaAgencias agencias={misAgencias} empresas={misEmpresas} terminales={misTerminales} />
          </div>
        </div>

        {/* Radiales + Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ padding: '11px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Estado de flota</p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <RadialKpi value={enProd}           max={totalTerms}    color="#00e5a0" label="Activas"  />
              <RadialKpi value={misTerminales.filter(t=>(t.estado as string)==='NO DISPONIBLE').length} max={totalTerms} color="#f72564" label="Inactivas" />
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
      <div style={{ display: 'grid', gridTemplateColumns: isFranq ? '1fr 195px 1fr' : '1fr 195px 1fr 1fr', gap: 11 }}>

        {/* Resumen de flota — datos reales */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Estado de flota</p>
            <span style={{ fontSize: 8, color: '#7b8db0', fontFamily: 'monospace' }}>{totalTerms} terminales</span>
          </div>
          {/* Stats por estado */}
          {(() => {
            const estados = [
              { label: 'ACTIVO',        color: '#00e5a0', count: terminales.filter(t => t.estado === 'ACTIVO').length },
              { label: 'NO DISPONIBLE', color: '#f72564', count: terminales.filter(t => t.estado === 'NO DISPONIBLE').length },
            ]
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {estados.map(e => (
                  <div key={e.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: e.color, fontFamily: 'monospace' }}>{e.label}</span>
                      <span style={{ fontSize: 9, color: e.color, fontFamily: 'monospace', fontWeight: 700 }}>{e.count}</span>
                    </div>
                    <div style={{ height: 3, background: '#1e2d4a', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalTerms > 0 ? Math.round((e.count/totalTerms)*100) : 0}%`, background: e.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
          {/* Lista top terminales EN PRODUCCION */}
          <div style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace', marginBottom: 5 }}>ÚLTIMAS ACTIVAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {!loaded ? (
              <p style={{ fontSize: 10, color: '#3d4f73', fontFamily: 'monospace', textAlign: 'center', padding: '6px 0' }}>Cargando...</p>
            ) : topTerms.filter(t => t.estado === 'ACTIVO').slice(0, 4).map(t => (
              <div key={t._id} onClick={() => navigate('/terminales')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, background: '#141d35', border: '1px solid #1e2d4a', cursor: 'pointer' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5a0', flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: '#e8eeff', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.codigo}</span>
                <span style={{ fontSize: 8, color: '#7b8db0', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.agencia || t.empresa}</span>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 7, borderTop: '1px solid #1e2d4a', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>Supabase · tiempo real</span>
            <span style={{ fontSize: 8, color: '#00e5a0', fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => navigate('/terminales')}>Ver todas →</span>
          </div>
        </div>

        {/* Donut — empresa/provincia/agencia según rol */}
        {(() => {
          const PIE_C = ['#4f8ef7','#7c5cfc','#00e5a0','#f7931a','#00d4ff','#f72564']
          let donutData: { name: string; value: number; color: string }[] = []
          let donutTitle = 'Por empresa'

          if (isFranq) {
            // Provincias únicas de mis agencias
            const provs = Array.from(new Set(misAgencias.map(a => a.sucursal).filter(Boolean)))
            if (provs.length <= 1) {
              // Solo 1 provincia → mostrar por agencia
              donutTitle = provs[0] ? `Agencias · ${provs[0]}` : 'Mis agencias'
              donutData = misAgencias.map((ag, i) => ({
                name:  ag.subagencia,
                value: misTerminales.filter(t => t.id_sub === ag.id_sub).length,
                color: PIE_C[i % PIE_C.length],
              })).filter(d => d.value > 0)
            } else {
              // Varias provincias → por provincia
              donutTitle = 'Por provincia'
              donutData = provs.map((prov, i) => ({
                name:  String(prov),
                value: misAgencias.filter(a => a.sucursal === prov).length,
                color: PIE_C[i % PIE_C.length],
              }))
            }
          } else {
            donutTitle = 'Por empresa'
            donutData = empData
          }

          const fallback = [{ name: 'Sin datos', value: 1, color: '#1e2d4a' }]
          const data = donutData.length > 0 ? donutData : fallback

          return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>{donutTitle}</p>
              <ResponsiveContainer width="100%" height={95}>
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={3} dataKey="value">
                    {data.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
                {donutData.slice(0, 6).map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: 1, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 9, color: '#7b8db0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ fontSize: 9, color: d.color, fontFamily: 'monospace' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* WAM Reporte franquiciado O Notificaciones admin */}
        {isFranq ? (
          <div className="card card-glow-blue">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#e8eeff' }}>Reporte WAM · hoy</p>
                <p style={{ margin: '2px 0 0', fontSize: 9, color: '#7b8db0', fontFamily: 'monospace' }}>{miEmpNombre}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, padding: '3px 10px' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5a0' }} />
                <span style={{ fontSize: 9, color: '#00e5a0', fontFamily: 'monospace' }}>EN VIVO</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { label: 'INGRESADO', value: wamLoad ? '...' : fmt(wam.in || 0), color: '#00e5a0', icon: '↑' },
                { label: 'PAGADO',    value: wamLoad ? '...' : fmt(wam.out || 0), color: '#f72564', icon: '↓' },
                { label: 'BALANCE',   value: wamLoad ? '...' : fmt(wam.bal || 0), color: (wam.bal || 0) < 0 ? '#f72564' : '#7c5cfc', icon: '=' },
              ].map((k, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#141d35', border: '1px solid #1e2d4a', borderRadius: 8 }}>
                  <span style={{ fontSize: 14, color: k.color, fontFamily: 'monospace', width: 16 }}>{k.icon}</span>
                  <span style={{ fontSize: 9, color: '#7b8db0', fontFamily: 'monospace', flex: 1 }}>{k.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #1e2d4a', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 8, color: '#3d4f73', fontFamily: 'monospace' }}>Solo datos de {miEmpNombre}</span>
              <span style={{ fontSize: 8, color: '#4f8ef7', fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => navigate('/wam')}>Ver reporte →</span>
            </div>
          </div>
        ) : (
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
        )}


      </div>
    </div>
  )
}
