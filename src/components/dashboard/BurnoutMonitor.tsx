import { Badge } from '@/components/ui/Badge'

interface BurnoutBar {
  label: string
  value: number
  color: string
  valueLabel?: string
}

interface BurnoutMonitorProps {
  risk?: 'Low' | 'Medium' | 'High'
  bars?: BurnoutBar[]
  message?: string
}

const DEFAULT_BARS: BurnoutBar[] = [
  { label: 'Fatigue Level',       value: 32, color: 'linear-gradient(90deg,var(--sage),var(--gold),var(--terra))', valueLabel: '32%' },
  { label: 'Study Consistency',   value: 78, color: 'linear-gradient(90deg,var(--sage),#96C9A0)',                  valueLabel: '78%' },
  { label: 'Focus Quality',       value: 71, color: 'linear-gradient(90deg,#4A5FA0,#7B8FCC)',                      valueLabel: '71%' },
]

export function BurnoutMonitor({
  risk = 'Low',
  bars = DEFAULT_BARS,
  message = "No burnout detected. Keep sessions under 2h for best retention.",
}: BurnoutMonitorProps) {
  const badgeVariant = risk === 'High' ? 'terra' : risk === 'Medium' ? 'indigo' : 'sage'
  const panelBg = risk === 'High' ? 'rgba(201, 107, 58, 0.12)' : risk === 'Medium' ? 'rgba(74, 95, 160, 0.12)' : 'var(--sage-light)'
  const panelTitle = risk === 'High' ? 'Burnout warning' : risk === 'Medium' ? 'Watch your load' : "You're doing great!"
  const panelTitleColor = risk === 'High' ? 'var(--terra)' : risk === 'Medium' ? 'var(--indigo)' : 'var(--sage)'

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div className="section-title" style={{ margin: 0 }}>Burnout Monitor</div>
        <Badge variant={badgeVariant as 'sage' | 'indigo' | 'terra'}>{risk} Risk</Badge>
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginBottom: 14 }}>Based on your last 7 sessions</div>
      {bars.map((bar) => {
        const clampedValue = Math.min(100, Math.max(0, Math.round(bar.value)))

        return (
        <div key={bar.label} className="burnout-bar-wrap">
          <div className="burnout-label">
            <span>{bar.label}</span>
            <span style={{ fontWeight: 600 }}>{bar.valueLabel ?? `${clampedValue}%`}</span>
          </div>
          <div className="burnout-bar">
            <div className="burnout-fill" style={{ width: `${clampedValue}%`, background: bar.color }} />
          </div>
        </div>
        )
      })}
      <div style={{ marginTop: 16, padding: '11px 13px', background: panelBg, borderRadius: 'var(--r-sm)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: panelTitleColor, marginBottom: 2 }}>{panelTitle}</div>
        <div style={{ fontSize: 12, color: 'var(--text-mid)' }}>{message}</div>
      </div>
    </div>
  )
}
