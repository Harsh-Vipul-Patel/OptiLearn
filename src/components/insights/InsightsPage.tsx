'use client'

import { useSession } from '@/components/Providers'
import { useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

const HISTORY_ITEMS = [
  { time: '9:00 AM',  text: 'Schedule Mechanics in morning for better retention',    badge: 'sage',   label: '👍 Liked'    },
  { time: '12:00 PM', text: 'Take a break — 3h straight detected',                  badge: 'terra',  label: 'Dismissed'   },
  { time: '4:00 PM',  text: 'Afternoon Chemistry sessions show 22% lower efficiency', badge: 'gold',  label: 'Pending'     },
]

export function InsightsPage() {
  const { data: session } = useSession()
  const { suggestions } = useSuggestionsSync(session?.user?.id || '')
  const { showToast } = useToast()

  const top = (suggestions[0] as Record<string, unknown> | undefined)
  const topText = top?.content as string | undefined
    ?? 'Physics peaks 9–11 AM. Mechanics tomorrow morning will yield 31% better recall than your usual afternoon slot.'

  return (
    <div>
      <div className="page-title">AI Insights</div>
      <div className="page-sub">Personalised, non-judgmental guidance based on your actual study data.</div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="insight-card">
          <div className="insight-label">Today&apos;s Top Insight</div>
          <div className="insight-text">&quot;{topText}&quot;</div>
          <div className="insight-actions">
            <button className="insight-btn insight-btn-primary" onClick={() => showToast('Feedback recorded — insights will improve!')}>👍 Helpful</button>
            <button className="insight-btn insight-btn-ghost" onClick={() => showToast('Dismissed', '👋')}>👎 Not now</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <SmallInsight icon="⏱️" iconBg="var(--terra-light)" title="Optimal Session Length" color="var(--terra)"
            text="45-min sprints + 10-min breaks → ~23% better retention." />
          <SmallInsight icon="🔄" iconBg="var(--gold-light)" title="Subject Sequencing" color="var(--gold)"
            text="Alternate Maths ↔ Chemistry to reduce context fatigue." />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <InsightTip icon="⚠️" title="Burnout Warning" text="6 consecutive days fatigue ≥ 3. Consider a lighter Sunday with revision only." badge="terra" badgeLabel="High Priority" />
        <InsightTip icon="📖" title="Task Chunking" text="Break 2h Organic Chemistry into 3 × 40-min sprints. Attention drops after 50 min." badge="indigo" badgeLabel="Smart Tip" />
        <InsightTip icon="🌟" title="Positive Reinforcement" text="Chemistry efficiency: 64% → 91% in one week. Morning + no phone = your formula." badge="sage" badgeLabel="Keep it up!" />
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Insight History</div>
          <Badge variant="indigo">3 today</Badge>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {HISTORY_ITEMS.map((item) => (
            <div key={item.time} style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '10px 13px', background: 'var(--cream)', borderRadius: 'var(--r-sm)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-soft)', minWidth: 58 }}>{item.time}</div>
              <div style={{ flex: 1, fontSize: '12.5px', color: 'var(--text-mid)' }}>{item.text}</div>
              <Badge variant={item.badge as 'sage' | 'terra' | 'gold'}>{item.label}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SmallInsight({ icon, iconBg, title, color, text }: { icon: string; iconBg: string; title: string; color: string; text: string }) {
  const { showToast } = useToast()
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, background: iconBg, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color, marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-mid)', lineHeight: 1.5 }}>{text}</div>
        </div>
      </div>
      <div style={{ marginTop: 9, display: 'flex', gap: 7 }}>
        <button className="insight-btn" style={{ background: color, color: 'white', padding: '5px 12px' }} onClick={() => showToast('Feedback recorded!')}>👍</button>
        <button className="insight-btn insight-btn-ghost" style={{ color: 'var(--text-soft)', borderColor: 'var(--border)', padding: '5px 12px' }}>👎</button>
      </div>
    </div>
  )
}

function InsightTip({ icon, title, text, badge, badgeLabel }: { icon: string; title: string; text: string; badge: 'terra' | 'indigo' | 'sage' | 'gold'; badgeLabel: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 19, marginBottom: 7 }}>{icon}</div>
      <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-soft)', lineHeight: 1.6 }}>{text}</div>
      <div style={{ marginTop: 9 }}><Badge variant={badge}>{badgeLabel}</Badge></div>
    </div>
  )
}
