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
        icon="📚"
        iconBg="var(--terra-light)"
        value={hoursToday}
        valueColor="var(--terra)"
        label="Hours Today"
        delta="↑ 18% vs yesterday"
        deltaUp
      />
      <StatCard
        icon="🎯"
        iconBg="var(--sage-light)"
        value={efficiency}
        valueColor="var(--sage)"
        label="Efficiency Score"
        delta="↑ 6 pts this week"
        deltaUp
      />
      <StatCard
        icon="🔥"
        iconBg="var(--gold-light)"
        value={streak}
        valueColor="var(--gold)"
        label="Day Streak"
        delta="Personal best!"
        deltaUp
      />
      <StatCard
        icon="💡"
        iconBg="var(--indigo-light)"
        value={insightsToday}
        valueColor="var(--indigo)"
        label="AI Insights Today"
        delta="2 new since morning"
        deltaUp={false}
      />
    </div>
  )
}
