'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'

type PlanStatus = 'done' | 'inprogress' | 'upcoming'

interface PlanSlot {
  time: string
  subject: string
  topic: string
  duration: number
  status: PlanStatus
  difficulty?: string
}

interface TodayPlanCardProps {
  slots: PlanSlot[]
  doneCount?: number
  totalCount?: number
}

const STATUS_CONFIG: Record<PlanStatus, { pill: string; dot: string; badgeVariant: 'sage' | 'indigo' | 'terra'; opacity?: number }> = {
  done:       { pill: '✓ Done',      dot: 'background:var(--sage)',               badgeVariant: 'sage' },
  inprogress: { pill: 'In Progress', dot: 'border:2px solid var(--terra)',         badgeVariant: 'indigo' },
  upcoming:   { pill: 'Upcoming',    dot: 'border:2px solid var(--text-soft)',     badgeVariant: 'terra', opacity: 0.5 },
}

export function TodayPlanCard({ slots, doneCount = 0, totalCount = 0 }: TodayPlanCardProps) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>Today&apos;s Plan</div>
        <Badge variant="terra">{doneCount} of {totalCount} done</Badge>
      </div>

      {slots.map((slot, i) => {
        const cfg = STATUS_CONFIG[slot.status]
        return (
          <div key={i} className="plan-slot" style={slot.status === 'upcoming' ? { opacity: .5 } : {}}>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-soft)' }}>{slot.time}</div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', margin: '5px 0 0 5px', ...parseDotStyle(cfg.dot) }} />
            </div>
            <div className="plan-content">
              <div className="plan-subject">{slot.subject}</div>
              <div className="plan-topic">{slot.topic}</div>
              <div className="plan-pills">
                <span className={`plan-pill badge-${cfg.badgeVariant}`}>{cfg.pill}</span>
                {slot.difficulty && <span className="plan-pill badge-gold">{slot.difficulty}</span>}
              </div>
            </div>
            <div>
              <div className="plan-duration" style={{ color: 'var(--text-dark)' }}>{slot.duration}</div>
              <div className="plan-dur-label">min</div>
            </div>
          </div>
        )
      })}

      <Link href="/dashboard/planner" className="btn-secondary btn-sm" style={{ marginTop: 6, width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex' }}>
        View full plan →
      </Link>
    </div>
  )
}

function parseDotStyle(css: string): React.CSSProperties {
  const rules: Record<string, string> = {}
  css.split(';').forEach(rule => {
    const [prop, val] = rule.split(':').map(s => s.trim())
    if (prop && val) {
      const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      rules[camel] = val
    }
  })
  return rules as React.CSSProperties
}
