'use client'

import { useState } from 'react'
import { useSession } from '@/components/Providers'
import { useStudyLogSync, useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { usePlans } from '@/hooks/usePlans'
import { useCheckin } from '@/hooks/useCheckin'
import { StatsRow } from '@/components/dashboard/StatsRow'
import { GoalRingCard } from '@/components/dashboard/GoalRingCard'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { TodayPlanCard } from '@/components/dashboard/TodayPlanCard'
import { BurnoutMonitor } from '@/components/dashboard/BurnoutMonitor'
import { DailyCheckinModal, ReadinessCard } from '@/components/dashboard/DailyCheckinModal'
import { AnalyticsIcon, BookIcon, BrainIcon, SparklesIcon, TargetIcon } from '@/components/ui/AppIcons'
import { formatPlanScheduleLabel, getPlanSortMinutes } from '@/lib/planTimeLabel'

type StudyLog = {
  plan_id?: string
  start_time?: string
  end_time?: string | null
  efficiency?: number | string | null
  focus_level?: number
  fatigue_level?: number
}

type Suggestion = {
  created_at?: string
  content?: string
  text?: string
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

const parseEfficiencyPercent = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null

  return numeric <= 1 ? clampPercent(numeric * 100) : clampPercent(numeric)
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { logs }        = useStudyLogSync(session?.user?.id || '')
  const { suggestions } = useSuggestionsSync(session?.user?.id || '')
  const typedLogs = logs as StudyLog[]
  const typedSuggestions = suggestions as Suggestion[]
  const todayDate = new Date().toISOString().slice(0, 10)
  const { plans }       = usePlans(todayDate)
  const { checkin, refreshCheckin, isLoading: checkinLoading } = useCheckin(session?.user?.id || '')
  const [checkinDismissed, setCheckinDismissed] = useState(false)

  // Show check-in modal when: user is logged in, no check-in today, not dismissed, not loading
  const showCheckinModal = !checkinLoading && !checkin && !checkinDismissed && !!session?.user?.id

  const handleCheckinComplete = () => {
    setCheckinDismissed(true)
    refreshCheckin()
  }

  const handleCheckinSkip = () => {
    setCheckinDismissed(true)
  }


  /* ── 1. Calculate Active Insights ── */
  const insightText = typedSuggestions[0]?.content
    ?? 'No new AI insights yet. Keep logging your sessions to give the engine more data!'

  /* ── 2. Calculate Today's Plans ── */
  const todayPlans = plans.filter(p => p.plan_date === todayDate)
  const TODAY_SLOTS = todayPlans
    .sort((a,b) => getPlanSortMinutes(a) - getPlanSortMinutes(b))
    .map(p => {
      const log = typedLogs.find((l) => l.plan_id === p.plan_id)
      let status: 'upcoming' | 'inprogress' | 'done' = 'upcoming'
      if (log) {
        status = log.end_time ? 'done' : 'inprogress'
      }
      return {
        time: formatPlanScheduleLabel(p),
        subject: p.studyTopic?.subject?.subject_name || 'Subject',
        topic: p.studyTopic?.topic_name || 'Topic',
        duration: p.target_duration,
        status,
        difficulty: p.studyTopic?.complexity || 'Medium',
      }
    })

  /* ── 3. Calculate Aggregates from Logs ── */
  const todayLogs = typedLogs.filter((l) => String(l.start_time).startsWith(todayDate))
  
  const subjectAgg: Record<string, { durationMin: number }> = {}
  todayLogs.forEach((l) => {
    if (!l.start_time) return

    const plan = plans.find(p => p.plan_id === l.plan_id)
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
  const ringIcons = [
    <BookIcon key="book" width={17} height={17} />,
    <TargetIcon key="target" width={17} height={17} />,
    <AnalyticsIcon key="analytics" width={17} height={17} />,
    <BrainIcon key="brain" width={17} height={17} />,
    <SparklesIcon key="sparkles" width={17} height={17} />,
  ]
  const RING_SUBJECTS = Object.entries(subjectAgg).map(([name, data], i) => ({
    name,
    icon: ringIcons[i % ringIcons.length],
    color: colors[i % colors.length],
    hours: `${(data.durationMin / 60).toFixed(1)}h`,
    pct: totalMinToday > 0 ? Math.round((data.durationMin / totalMinToday) * 100) : 0
  }))

  const loggedEfficiency = todayLogs
    .map((l) => parseEfficiencyPercent(l.efficiency))
    .filter((value): value is number => value !== null)

  const focusDerivedEfficiency = todayLogs
    .map((l) => Number(l.focus_level))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5)
    .map((value) => clampPercent((value / 5) * 100))

  const efficiencySource = loggedEfficiency.length > 0 ? loggedEfficiency : focusDerivedEfficiency
  const avgEff = efficiencySource.length > 0
    ? `${Math.round(efficiencySource.reduce((a:number,b:number)=>a+b,0) / efficiencySource.length)}%`
    : 'N/A'

  /* ── 3.5 Burnout metrics from last 7 sessions (db-backed logs) ── */
  const recentLogs = [...typedLogs]
    .filter((l) => l.start_time)
    .sort((a, b) => String(b.start_time).localeCompare(String(a.start_time)))
    .slice(0, 7)

  const avgFatiguePct = recentLogs.length > 0
    ? clampPercent((recentLogs.reduce((sum, l) => sum + Number(l.fatigue_level || 0), 0) / (recentLogs.length * 5)) * 100)
    : 0

  const avgFocusPct = recentLogs.length > 0
    ? clampPercent((recentLogs.reduce((sum, l) => sum + Number(l.focus_level || 0), 0) / (recentLogs.length * 5)) * 100)
    : 0

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgoStart = new Date(todayStart)
  sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 6)

  const uniqueRecentDays = new Set(
    typedLogs
      .filter((l) => l.start_time)
      .map((l) => new Date(String(l.start_time)))
      .filter((dt) => !Number.isNaN(dt.getTime()) && dt >= sevenDaysAgoStart)
      .map((dt) => dt.toISOString().slice(0, 10))
  )

  const consistencyPct = clampPercent((uniqueRecentDays.size / 7) * 100)

  const burnoutScore = clampPercent(avgFatiguePct * 0.5 + (100 - consistencyPct) * 0.25 + (100 - avgFocusPct) * 0.25)
  const burnoutRisk: 'Low' | 'Medium' | 'High' = burnoutScore >= 67 ? 'High' : burnoutScore >= 40 ? 'Medium' : 'Low'

  const insightFatigue = clampPercent(totalMinToday / 4)

  const burnoutMessage =
    burnoutRisk === 'High'
      ? 'High burnout risk detected. Reduce session length and schedule recovery breaks in your next plan.'
      : burnoutRisk === 'Medium'
        ? 'Moderate burnout risk. Keep breaks consistent and avoid stacking heavy topics back-to-back.'
        : 'No burnout detected. Keep sessions balanced and maintain your current rhythm.'

  const burnoutBars = [
    {
      label: 'Fatigue Level',
      value: avgFatiguePct,
      color: 'linear-gradient(90deg,var(--sage),var(--gold),var(--terra))',
      valueLabel: `${avgFatiguePct}%`,
    },
    {
      label: 'Study Consistency',
      value: consistencyPct,
      color: 'linear-gradient(90deg,var(--sage),#96C9A0)',
      valueLabel: `${consistencyPct}%`,
    },
    {
      label: 'Focus Quality',
      value: avgFocusPct,
      color: 'linear-gradient(90deg,#4A5FA0,#7B8FCC)',
      valueLabel: `${avgFocusPct}%`,
    },
  ]

  /* ── 4. Calculate Streak ── */
  let streak = 0
  const uniqueDates = Array.from(new Set(typedLogs.map((l) => String(l.start_time).slice(0,10)))).sort((a,b)=>b.localeCompare(a))
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
      {/* Daily Check-In Modal */}
      {showCheckinModal && (
        <DailyCheckinModal onComplete={handleCheckinComplete} onSkip={handleCheckinSkip} />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">
            Good morning, {session?.user?.name?.split(' ')[0] || 'there'}
          </div>
          <div className="page-sub">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <StatsRow hoursToday={hoursToday} efficiency={avgEff} streak={streak} insightsToday={typedSuggestions.filter((s) => String(s.created_at).startsWith(todayDate)).length} />

      {checkin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: 220, marginBottom: 18, marginTop: -4 }}>
          <ReadinessCard checkin={checkin} />
        </div>
      )}

      <div className="dashboard-top-grid">
        <InsightCard text={insightText} burnoutRisk="Low" fatigue={insightFatigue} />
        <GoalRingCard hoursStudied={Number(hoursTodayNum.toFixed(1))} goalHours={8} subjects={RING_SUBJECTS} />
      </div>

      <div className="grid-2">
        <TodayPlanCard slots={TODAY_SLOTS} doneCount={TODAY_SLOTS.filter(s => s.status === 'done').length} totalCount={TODAY_SLOTS.length} />
        <BurnoutMonitor risk={burnoutRisk} bars={burnoutBars} message={burnoutMessage} />
      </div>
    </div>
  )
}
