'use client'

import { useSession } from '@/components/Providers'
import { useStudyLogSync, useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { usePlans } from '@/hooks/usePlans'
import { StatsRow } from '@/components/dashboard/StatsRow'
import { GoalRingCard } from '@/components/dashboard/GoalRingCard'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { TodayPlanCard } from '@/components/dashboard/TodayPlanCard'
import { BurnoutMonitor } from '@/components/dashboard/BurnoutMonitor'

export default function DashboardPage() {
  const { data: session } = useSession()
  const { logs }        = useStudyLogSync(session?.user?.id || '')
  const { suggestions } = useSuggestionsSync(session?.user?.id || '')
  const { plans }       = usePlans()

  const todayDate = new Date().toISOString().slice(0, 10)

  /* ── 1. Calculate Active Insights ── */
  const insightText = (suggestions[0] as Record<string,unknown>)?.content as string | undefined
    ?? 'No new AI insights yet. Keep logging your sessions to give the engine more data!'

  /* ── 2. Calculate Today's Plans ── */
  const todayPlans = plans.filter(p => p.plan_date === todayDate)
  const TODAY_SLOTS = todayPlans
    .sort((a,b) => (a.time_slot || '').localeCompare(b.time_slot || ''))
    .map(p => {
      const log = logs.find((l: any) => l.plan_id === p.id)
      let status: 'upcoming' | 'inprogress' | 'done' = 'upcoming'
      if (log) {
        status = (log as any).end_time ? 'done' : 'inprogress'
      }
      return {
        time: p.time_slot || 'Anytime',
        subject: p.studyTopic?.subject?.subject_name || 'Subject',
        topic: p.studyTopic?.topic_name || 'Topic',
        duration: p.target_duration,
        status,
        difficulty: (p.studyTopic as any)?.complexity || 'Medium',
      }
    })

  /* ── 3. Calculate Aggregates from Logs ── */
  const todayLogs = logs.filter((l: any) => String(l.start_time).startsWith(todayDate))
  
  const subjectAgg: Record<string, { durationMin: number }> = {}
  todayLogs.forEach((l: any) => {
    const plan = plans.find(p => p.id === l.plan_id)
    if (plan && plan.studyTopic?.subject) {
      const subj = plan.studyTopic.subject.subject_name
      if (!subjectAgg[subj]) subjectAgg[subj] = { durationMin: 0 }
      
      const start = new Date(l.start_time).getTime()
      const end = l.end_time ? new Date(l.end_time).getTime() : new Date().getTime()
      subjectAgg[subj].durationMin += (end - start) / 60000
    }
  })

  const totalMinToday = Object.values(subjectAgg).reduce((sum, s) => sum + s.durationMin, 0)
  const hoursTodayNum = totalMinToday / 60
  const hoursToday = hoursTodayNum > 0 ? `${hoursTodayNum.toFixed(1)}h` : '0h'

  const colors = ['#4A5FA0', '#C96B3A', '#6B9B7A', '#D4A843', '#B85C7A']
  const emojis = ['📚', '📐', '⚗️', '💻', '📝']
  const RING_SUBJECTS = Object.entries(subjectAgg).map(([name, data], i) => ({
    name,
    emoji: emojis[i % emojis.length],
    color: colors[i % colors.length],
    hours: `${(data.durationMin / 60).toFixed(1)}h`,
    pct: totalMinToday > 0 ? Math.round((data.durationMin / totalMinToday) * 100) : 0
  }))

  const effArr = todayLogs.map((l: any) => l.efficiency).filter(Boolean)
  const avgEff = effArr.length > 0 ? Math.round(effArr.reduce((a:number,b:number)=>a+b,0)/effArr.length) + '%' : 'N/A'

  /* ── 4. Calculate Streak ── */
  let streak = 0
  const uniqueDates = Array.from(new Set(logs.map((l: any) => String(l.start_time).slice(0,10)))).sort((a,b)=>b.localeCompare(a))
  const d = new Date()
  for (let i = 0; i < uniqueDates.length; i++) {
    const dateStr = d.toISOString().slice(0,10)
    if (uniqueDates.includes(dateStr)) streak++
    else if (i === 0 && !uniqueDates.includes(dateStr)) {
      d.setDate(d.getDate() - 1)
      if (uniqueDates.includes(d.toISOString().slice(0,10))) streak++
      else break
    } else break
    d.setDate(d.getDate() - 1)
  }

  return (
    <div style={{ animation: 'pageIn .4s cubic-bezier(.22,.68,0,1.1) both' }}>
      <div className="page-header">
        <div>
          <div className="page-title">
            Good morning, {session?.user?.name?.split(' ')[0] || 'there'} 👋
          </div>
          <div className="page-sub">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <StatsRow hoursToday={hoursToday} efficiency={avgEff} streak={streak} insightsToday={suggestions.filter((s:any) => String(s.created_at).startsWith(todayDate)).length} />

      <div className="dashboard-top-grid">
        <InsightCard text={insightText} burnoutRisk="Low" fatigue={Math.round(totalMinToday / 4)} />
        <GoalRingCard hoursStudied={Number(hoursTodayNum.toFixed(1))} goalHours={8} subjects={RING_SUBJECTS} />
      </div>

      <div className="grid-2">
        <TodayPlanCard slots={TODAY_SLOTS} doneCount={TODAY_SLOTS.filter(s => s.status === 'done').length} totalCount={TODAY_SLOTS.length} />
        <BurnoutMonitor />
      </div>
    </div>
  )
}
