import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { LogsService } from '@/services/logs.service'

/* ── Types ── */
type DigestItem = { text: string; metric?: string }

interface WeeklyDigest {
  week: string
  wins: DigestItem[]
  issues: DigestItem[]
  actions: DigestItem[]
  summary: {
    totalHours: string
    sessions: number
    avgEfficiency: string
    avgDelay: string
    bestSubject: string
    worstSubject: string
  }
}

type LogEntry = Record<string, unknown> & {
  start_time?: string
  end_time?: string | null
  efficiency?: number | string | null
  focus_level?: number
  fatigue_level?: number
  dailyPlan?: {
    start_time?: string | null
    time_slot?: string | null
    studyTopic?: {
      subject?: {
        subject_name?: string
      }
    }
  }
}

/* ── Helpers ── */
const parseEff = (v: unknown): number | null => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return n <= 1 ? n * 100 : n
}

const getDurationMin = (log: LogEntry): number => {
  const s = new Date(String(log.start_time || '')).getTime()
  const e = log.end_time ? new Date(String(log.end_time)).getTime() : 0
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0
  return (e - s) / 60000
}

const getSubject = (log: LogEntry): string =>
  log.dailyPlan?.studyTopic?.subject?.subject_name || 'Unknown'

const getDelay = (log: LogEntry): number | null => {
  const planned = log.dailyPlan?.start_time
  if (!planned || !log.start_time) return null
  const actual = new Date(log.start_time)
  if (Number.isNaN(actual.getTime())) return null
  const [ph, pm] = planned.split(':').map(Number)
  if (!Number.isFinite(ph) || !Number.isFinite(pm)) return null
  return (actual.getHours() * 60 + actual.getMinutes()) - (ph * 60 + pm)
}

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allLogs = (await LogsService.getLogs(user.id)) as LogEntry[]

    // Filter last 7 days
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weekLogs = allLogs.filter(l => {
      const d = new Date(String(l.start_time || ''))
      return !Number.isNaN(d.getTime()) && d >= weekAgo && d <= now
    })

    // Week label
    const weekLabel = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    // Per-subject aggregations
    const subjectMap: Record<string, { hours: number; efficiencies: number[]; delays: number[] }> = {}
    let totalMinutes = 0
    const allEffs: number[] = []
    const allDelays: number[] = []

    weekLogs.forEach(log => {
      const subj = getSubject(log)
      const mins = getDurationMin(log)
      const eff = parseEff(log.efficiency)
      const delay = getDelay(log)

      if (!subjectMap[subj]) subjectMap[subj] = { hours: 0, efficiencies: [], delays: [] }
      subjectMap[subj].hours += mins / 60
      if (eff !== null) { subjectMap[subj].efficiencies.push(eff); allEffs.push(eff) }
      if (delay !== null) { subjectMap[subj].delays.push(delay); allDelays.push(delay) }
      totalMinutes += mins
    })

    const totalHours = (totalMinutes / 60)
    const avgEff = allEffs.length > 0 ? Math.round(allEffs.reduce((s, v) => s + v, 0) / allEffs.length) : 0
    const avgDelay = allDelays.length > 0 ? Math.round(allDelays.reduce((s, v) => s + v, 0) / allDelays.length) : 0

    // Best / worst subjects by efficiency
    const subjectEntries = Object.entries(subjectMap)
    let bestSubject = 'N/A'
    let worstSubject = 'N/A'
    if (subjectEntries.length > 0) {
      const withEff = subjectEntries
        .map(([name, d]) => ({ name, avgEff: d.efficiencies.length > 0 ? d.efficiencies.reduce((s, v) => s + v, 0) / d.efficiencies.length : 0 }))
        .sort((a, b) => b.avgEff - a.avgEff)
      bestSubject = withEff[0]?.name || 'N/A'
      worstSubject = withEff[withEff.length - 1]?.name || 'N/A'
    }

    // ── Build 3 Wins ──
    const wins: DigestItem[] = []
    if (weekLogs.length > 0) wins.push({ text: `Completed ${weekLogs.length} study sessions this week`, metric: `${weekLogs.length} sessions` })
    if (totalHours >= 5) wins.push({ text: `Put in ${totalHours.toFixed(1)} hours of focused study`, metric: `${totalHours.toFixed(1)}h` })
    if (avgEff >= 60) wins.push({ text: `Maintained ${avgEff}% average efficiency`, metric: `${avgEff}%` })
    if (bestSubject !== 'N/A') wins.push({ text: `Strongest performance in ${bestSubject}`, metric: bestSubject })
    // Consistency check
    const uniqueDays = new Set(weekLogs.map(l => String(l.start_time || '').slice(0, 10)))
    if (uniqueDays.size >= 5) wins.push({ text: `Studied on ${uniqueDays.size} out of 7 days — great consistency!`, metric: `${uniqueDays.size}/7` })
    if (avgDelay <= 5 && allDelays.length > 0) wins.push({ text: 'Started sessions close to planned times', metric: `${avgDelay}m avg delay` })

    // ── Build 3 Issues ──
    const issues: DigestItem[] = []
    if (avgEff < 50 && allEffs.length > 0) issues.push({ text: `Average efficiency is only ${avgEff}% — below the 50% threshold`, metric: `${avgEff}%` })
    if (avgDelay > 15 && allDelays.length > 0) issues.push({ text: `Averaging ${avgDelay}-minute delays in starting sessions`, metric: `+${avgDelay}m` })
    if (uniqueDays.size < 4) issues.push({ text: `Only studied ${uniqueDays.size} out of 7 days`, metric: `${uniqueDays.size}/7` })
    if (worstSubject !== 'N/A' && worstSubject !== bestSubject) issues.push({ text: `${worstSubject} is falling behind — lowest efficiency this week`, metric: worstSubject })
    if (weekLogs.some(l => Number(l.fatigue_level) >= 4)) issues.push({ text: 'High fatigue detected in some sessions', metric: 'High' })
    if (totalHours < 3) issues.push({ text: `Only ${totalHours.toFixed(1)} total study hours this week`, metric: `${totalHours.toFixed(1)}h` })

    // ── Build 3 Actions ──
    const actions: DigestItem[] = []
    if (avgDelay > 10) actions.push({ text: 'Set phone reminders 5 minutes before each planned session' })
    if (avgEff < 50) actions.push({ text: 'Try shorter 30-minute sessions with higher focus instead of long low-efficiency ones' })
    if (uniqueDays.size < 5) actions.push({ text: 'Aim for at least 5 study days next week to build consistency' })
    if (worstSubject !== 'N/A' && worstSubject !== bestSubject) actions.push({ text: `Schedule extra time for ${worstSubject} next week` })
    actions.push({ text: 'Review your strongest topic briefly to maintain confidence' })
    actions.push({ text: 'Plan tomorrow\'s sessions tonight to reduce morning decision fatigue' })

    const digest: WeeklyDigest = {
      week: weekLabel,
      wins: wins.slice(0, 3),
      issues: issues.slice(0, 3),
      actions: actions.slice(0, 3),
      summary: {
        totalHours: totalHours.toFixed(1),
        sessions: weekLogs.length,
        avgEfficiency: `${avgEff}%`,
        avgDelay: allDelays.length > 0 ? `${avgDelay}m` : 'N/A',
        bestSubject,
        worstSubject,
      },
    }

    return NextResponse.json({ digest }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
