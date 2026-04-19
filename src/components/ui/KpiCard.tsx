interface KpiCardProps {
  label: string
  value: string
  delta?: string
  deltaUp?: boolean
  accentColor?: string
  sub?: string
}

export default function KpiCard({ label, value, delta, deltaUp, accentColor = '#00e5a0', sub }: KpiCardProps) {
  return (
    <div className="card relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accentColor }} />
      <p className="text-[10px] text-tx2 font-mono tracking-wider mb-2">{label}</p>
      <p className="text-xl font-bold leading-none" style={{ color: accentColor }}>{value}</p>
      {sub && <p className="text-xs text-tx3 mt-1">{sub}</p>}
      {delta && (
        <p className={`text-xs mt-1.5 font-mono ${deltaUp ? 'text-ac' : 'text-danger'}`}>
          {deltaUp ? '↑' : '↓'} {delta}
        </p>
      )}
    </div>
  )
}