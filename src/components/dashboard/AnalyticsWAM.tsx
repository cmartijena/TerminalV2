import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { WAM_API_URL, WAM_API_SECRET } from '../../lib/config'

const HOURLY_MOCK = [
  {h:'00',v:1200},{h:'02',v:800},{h:'04',v:400},{h:'06',v:900},
  {h:'08',v:3200},{h:'10',v:5800},{h:'12',v:7200},{h:'14',v:6800},
  {h:'16',v:8100},{h:'18',v:9200},{h:'20',v:7600},{h:'22',v:4300},
]

interface AnalyticsData {
  rtp: number
  spins: number
  peakHour: string
  avgTicket: number
  totalOps: number
}

export default function AnalyticsWAM() {
  const [data, setData] = useState<AnalyticsData>({
    rtp: 84.8, spins: 12847, peakHour: '18:00', avgTicket: 18.8, totalOps: 0,
  })
  const currentHour = new Date().getHours()

  useEffect(() => {
    const base = WAM_API_URL.replace(/\/$/, '')
    const secret = encodeURIComponent(WAM_API_SECRET)
    fetch(`${base}/api/hoy?secret=${secret}`)
      .then(r => r.json())
      .then(d => {
        if (!d.error) {
          const rtp = d.total_in > 0 ? Math.round((d.total_out / d.total_in) * 1000) / 10 : 84.8
          setData(prev => ({ ...prev, rtp, totalOps: d.registros || 0 }))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, height:'100%' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px' }}>
          <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>RTP PROMEDIO</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#f7931a', lineHeight:1 }}>{data.rtp}%</div>
          <div style={{ height:2, background:'#1e2d4a', borderRadius:1, marginTop:5, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${data.rtp}%`, background:'#f7931a', borderRadius:1 }}/>
          </div>
        </div>
        <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px' }}>
          <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>SPINS HOY</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#00d4ff', lineHeight:1 }}>{data.spins.toLocaleString()}</div>
          <div style={{ height:2, background:'#1e2d4a', borderRadius:1, marginTop:5, overflow:'hidden' }}>
            <div style={{ height:'100%', width:'72%', background:'#00d4ff', borderRadius:1 }}/>
          </div>
        </div>
        <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px' }}>
          <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>HORA PICO</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#7c5cfc', lineHeight:1 }}>{data.peakHour}</div>
          <div style={{ fontSize:9, color:'#3d4f73', fontFamily:'monospace', marginTop:3 }}>mayor actividad</div>
        </div>
        <div style={{ background:'#141d35', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px' }}>
          <div style={{ fontSize:8, color:'#7b8db0', fontFamily:'monospace', letterSpacing:1, marginBottom:3 }}>TICKET PROM.</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#00e5a0', lineHeight:1 }}>S/ {data.avgTicket}</div>
          <div style={{ fontSize:9, color:'#3d4f73', fontFamily:'monospace', marginTop:3 }}>por operación</div>
        </div>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:9, color:'#7b8db0', fontFamily:'monospace', marginBottom:4 }}>ACTIVIDAD POR HORA · HOY</div>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={HOURLY_MOCK} barCategoryGap="15%">
            <XAxis dataKey="h" tick={{ fill:'#3d4f73', fontSize:8 }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ background:'#0f1629', border:'1px solid #1e2d4a', borderRadius:6, fontSize:10 }}
              formatter={(v: any) => [`S/ ${Number(v).toLocaleString()}`, '']}
              cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
            <Bar dataKey="v" radius={[3,3,0,0]}>
              {HOURLY_MOCK.map((d, i) => {
                const h = parseInt(d.h)
                const isNow = h <= currentHour && h + 2 > currentHour
                const isPast = h < currentHour
                return <Cell key={i} fill={isNow ? '#7c5cfc' : isPast ? '#1e3a5f' : '#141d35'} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}