'use client'

import { useSession } from '@/components/Providers'
import { useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ReactNode } from 'react'
import { ThumbsDownIcon, ThumbsUpIcon } from '@/components/ui/AppIcons'

const HISTORY_ITEMS = [
  { time: '9:00 AM',  text: 'Schedule Mechanics in morning for better retention',    badge: 'sage',   label: 'Liked'    },
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
            <button className="insight-btn insight-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => showToast('Feedback recorded — insights will improve!')}><ThumbsUpIcon width={16} height={16} />Helpful</button>
            <button className="insight-btn insight-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => showToast('Dismissed', 'info')}><ThumbsDownIcon width={16} height={16} />Not now</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <SmallInsight icon={<TimerIcon />} title="Optimal Session Length" color="var(--terra)"
            text="45-min sprints + 10-min breaks → ~23% better retention." />
          <SmallInsight icon={<SwapIcon />} title="Subject Sequencing" color="var(--gold)"
            text="Alternate Maths ↔ Chemistry to reduce context fatigue." />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <InsightTip icon={<AlertIcon />} title="Burnout Warning" text="6 consecutive days fatigue ≥ 3. Consider a lighter Sunday with revision only." badge="terra" badgeLabel="High Priority" />
        <InsightTip icon={<BookIcon />} title="Task Chunking" text="Break 2h Organic Chemistry into 3 × 40-min sprints. Attention drops after 50 min." badge="indigo" badgeLabel="Smart Tip" />
        <InsightTip icon={<StarIcon />} title="Positive Reinforcement" text="Chemistry efficiency: 64% → 91% in one week. Morning + no phone = your formula." badge="sage" badgeLabel="Keep it up!" />
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

function SmallInsight({ icon, title, color, text }: { icon: ReactNode; title: string; color: string; text: string }) {
  const { showToast } = useToast()
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid var(--border)', background: 'linear-gradient(160deg, #FFFFFF 0%, #FFF8F2 100%)', color: 'var(--text-mid)' }}>{icon}</div>
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color, marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-mid)', lineHeight: 1.5 }}>{text}</div>
        </div>
      </div>
      <div style={{ marginTop: 9, display: 'flex', gap: 7 }}>
        <button className="insight-btn" style={{ background: color, color: 'white', padding: '5px 12px', display: 'inline-flex', alignItems: 'center' }} onClick={() => showToast('Feedback recorded!')}><ThumbsUpIcon width={16} height={16} /></button>
        <button className="insight-btn insight-btn-ghost" style={{ color: 'var(--text-soft)', borderColor: 'var(--border)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center' }}><ThumbsDownIcon width={16} height={16} /></button>
      </div>
    </div>
  )
}

function InsightTip({ icon, title, text, badge, badgeLabel }: { icon: ReactNode; title: string; text: string; badge: 'terra' | 'indigo' | 'sage' | 'gold'; badgeLabel: string }) {
  return (
    <div className="card">
      <div style={{ width: 34, height: 34, marginBottom: 9, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border)', background: 'linear-gradient(160deg, #FFFFFF 0%, #FFF8F2 100%)', color: 'var(--text-mid)' }}>{icon}</div>
      <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-soft)', lineHeight: 1.6 }}>{text}</div>
      <div style={{ marginTop: 9 }}><Badge variant={badge}>{badgeLabel}</Badge></div>
    </div>
  )
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13l3-2" />
      <path d="M9 2h6" />
      <path d="M12 5v2" />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M17 3l4 4-4 4" />
      <path d="M3 7h18" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M21 17H3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M12 3l9 16H3L12 3z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r="1" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.5.5H6.5A2.5 2.5 0 0 1 4 17.5v-11z" />
      <path d="M8 4v16" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M12 3l2.8 5.7L21 9.6l-4.5 4.4 1.1 6.3L12 17.4 6.4 20.3 7.5 14 3 9.6l6.2-.9L12 3z" />
    </svg>
  )
}
