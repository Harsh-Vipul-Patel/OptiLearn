'use client'

import { StatCard } from '@/components/ui/StatCard'

interface StatsRowProps {
  hoursToday: string
  efficiency: string
  streak: number
  insightsToday: number
}

export function StatsRow({ hoursToday, efficiency, streak, insightsToday }: StatsRowProps) {
  return (
    <div className="grid-4" style={{ marginBottom: 20 }}>
      <StatCard
        icon={<BookIcon />}
        value={hoursToday}
        valueColor="var(--terra)"
        label="Hours Today"
        delta="↑ 18% vs yesterday"
        deltaUp
      />
      <StatCard
        icon={<TargetIcon />}
        value={efficiency}
        valueColor="var(--sage)"
        label="Efficiency Score"
        delta="↑ 6 pts this week"
        deltaUp
      />
      <StatCard
        icon={<FlameIcon />}
        value={streak}
        valueColor="var(--gold)"
        label="Day Streak"
        delta="Personal best!"
        deltaUp
      />
      <StatCard
        icon={<BulbIcon />}
        value={insightsToday}
        valueColor="var(--indigo)"
        label="AI Insights Today"
        delta="2 new since morning"
        deltaUp={false}
      />
    </div>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.5.5H6.5A2.5 2.5 0 0 1 4 17.5v-11z" />
      <path d="M8 4v16" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3c2 3 5 4.5 5 9a5 5 0 1 1-10 0c0-2.6 1.2-4.5 3.4-6.8" />
      <path d="M12 12c1.4 1.1 2 2.2 2 3.3A2 2 0 0 1 10 15c0-1 .5-1.9 2-3z" />
    </svg>
  )
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 3a7 7 0 0 0-4 12c.8.6 1.4 1.7 1.6 3h4.8c.2-1.3.8-2.4 1.6-3A7 7 0 0 0 12 3z" />
    </svg>
  )
}
