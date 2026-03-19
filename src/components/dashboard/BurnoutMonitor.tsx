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
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div className="section-title" style={{ margin: 0 }}>Burnout Monitor</div>
        <Badge variant="sage">{risk} Risk</Badge>
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginBottom: 14 }}>Based on your last 7 sessions</div>
      {bars.map((bar) => (
        <div key={bar.label} className="burnout-bar-wrap">
          <div className="burnout-label">
            <span>{bar.label}</span>
            <span style={{ fontWeight: 600 }}>{bar.valueLabel ?? `${bar.value}%`}</span>
          </div>
          <div className="burnout-bar">
            <div className="burnout-fill" style={{ width: `${bar.value}%`, background: bar.color }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 16, padding: '11px 13px', background: 'var(--sage-light)', borderRadius: 'var(--r-sm)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sage)', marginBottom: 2 }}>✓ You&apos;re doing great!</div>
        <div style={{ fontSize: 12, color: 'var(--text-mid)' }}>{message}</div>
      </div>
    </div>
  )
}
