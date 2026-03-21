import { CSSProperties, ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  iconBg?: string
  value: string | number
  valueColor?: string
  label: string
  delta?: string
  deltaUp?: boolean
}

export function StatCard({
  icon,
  iconBg = 'transparent',
  value,
  valueColor = 'var(--terra)',
  label,
  delta,
  deltaUp = true,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg } as CSSProperties}>{icon}</div>
      <div className="stat-value" style={{ color: valueColor } as CSSProperties}>{value}</div>
      <div className="stat-label">{label}</div>
      {delta && <div className={`stat-delta${deltaUp ? ' delta-up' : ''}`}>{delta}</div>}
    </div>
  )
}
