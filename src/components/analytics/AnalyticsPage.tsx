'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/components/Providers'
import { useStudyLogSync } from '@/hooks/useStudyLogSync'
import { usePlans } from '@/hooks/usePlans'
import { CustomSelect } from '@/components/ui/CustomSelect'

const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const CHART_FONT = { family: 'Inter,sans-serif', size: 11.5 }

type StudyLog = {
  plan_id?: string
  start_time?: string
  end_time?: string | null
  efficiency?: number | string | null
  focus_level?: number
  dailyPlan?: {
    start_time?: string | null
    end_time?: string | null
    target_duration?: number | null
    time_slot?: string | null
    studyTopic?: {
      subject?: {
        subject_name?: string
      }
    }
  }
}

type ChartLike = {
  destroy: () => void
}

type DigestItem = { text: string; metric?: string }
type WeeklyDigest = {
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

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getLogDurationHours(log: StudyLog): number {
  const start = new Date(log.start_time || '').getTime()
  const end = new Date(log.end_time || '').getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return (end - start) / 3600000
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

const parseEfficiencyPercent = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null

  return numeric <= 1 ? clampPercent(numeric * 100) : clampPercent(numeric)
}

export function AnalyticsPage() {
  const { data: session } = useSession()
  const { logs } = useStudyLogSync(session?.user?.id || '')
  const { plans } = usePlans()
  const planVsActualRef = useRef<HTMLCanvasElement>(null)
  const subjectEffRef = useRef<HTMLCanvasElement>(null)
  const focusTimeRef = useRef<HTMLCanvasElement>(null)
  const planVsActualMonthRef = useRef<HTMLCanvasElement>(null)
  const subjectMonthRef = useRef<HTMLCanvasElement>(null)
  const effMonthRef = useRef<HTMLCanvasElement>(null)
  const subjectBreakdownMonthRef = useRef<HTMLCanvasElement>(null)
  const procrastinationRef = useRef<HTMLCanvasElement>(null)
  const priorityMatrixRef = useRef<HTMLCanvasElement>(null)
  const timeOnTaskRef = useRef<HTMLCanvasElement>(null)

  const [tab, setTab] = useState<'week' | 'month' | 'digest'>('week')
  const [planVsActualFilter, setPlanVsActualFilter] = useState('all')
  const [subjectMonthFilter, setSubjectMonthFilter] = useState('all')
  const [effMonthFilter, setEffMonthFilter] = useState('all')
  const [breakdownMonthFilter, setBreakdownMonthFilter] = useState('all')
  const [isExporting, setIsExporting] = useState(false)
  const [digest, setDigest] = useState<WeeklyDigest | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)

  // Fetch digest when tab switches
  useEffect(() => {
    if (tab !== 'digest') return
    if (digest) return // already loaded
    setDigestLoading(true)
    fetch('/api/digest')
      .then(r => r.json())
      .then(data => { if (data.digest) setDigest(data.digest) })
      .catch(console.error)
      .finally(() => setDigestLoading(false))
  }, [tab, digest])
  
  const handleExportPDF = async () => {
    try {
      setIsExporting(true)
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('analytics-content');
      if (!element) return;
      const opt = {
        margin:       0.4,
        filename:     `Study_Report_${tab}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt as any).from(element).save();
    } catch (err) {
      console.error('Failed to export PDF', err);
    } finally {
      setIsExporting(false)
    }
  }

  // Data Aggregations
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(todayStart.getDate() - 6)
  const monthStart = new Date(todayStart)
  monthStart.setDate(todayStart.getDate() - 29)

  const typedLogs = logs as StudyLog[]
  const weekLogs = typedLogs.filter((l) => {
    const startedAt = new Date(l.start_time || '')
    return !Number.isNaN(startedAt.getTime()) && startedAt >= weekStart
  })
  const monthLogs = typedLogs.filter((l) => {
    const startedAt = new Date(l.start_time || '')
    return !Number.isNaN(startedAt.getTime()) && startedAt >= monthStart
  })

  const getFilteredLogs = (sourceLogs: StudyLog[], filterVal: string) => sourceLogs.filter((log) => {
    if (filterVal === 'all') return true
    const startedAt = new Date(log.start_time || '')
    if (Number.isNaN(startedAt.getTime())) return false
    const dayDist = Math.floor((now.getTime() - startedAt.getTime()) / 86400000)
    if (dayDist >= 0 && dayDist < 28) {
      const weekIdx = 3 - Math.floor(dayDist / 7)
      return Number(filterVal) === weekIdx
    }
    return false
  })

  const calculateStats = (filteredLogs: StudyLog[]) => {
    const totalMin = filteredLogs.reduce((acc, l) => acc + (getLogDurationHours(l) * 60), 0)
    const loggedEfficiency = filteredLogs
      .map((l) => parseEfficiencyPercent(l.efficiency))
      .filter((value): value is number => value !== null)
    const focusDerivedEfficiency = filteredLogs
      .map((l) => Number(l.focus_level))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5)
      .map((value) => clampPercent((value / 5) * 100))
    const efficiencySource = loggedEfficiency.length > 0 ? loggedEfficiency : focusDerivedEfficiency
    const avgEff = efficiencySource.length ? Math.round(efficiencySource.reduce((a,b)=>a+b,0)/efficiencySource.length) : 0
    const focusArr = filteredLogs.map((l) => Number(l.focus_level || 0)).filter(Boolean)
    const avgFocus = focusArr.length ? (focusArr.reduce((a:number,b:number)=>a+b,0)/focusArr.length).toFixed(1) : '0.0'
    return {
      totalHours: (totalMin / 60).toFixed(1) + 'h',
      avgEff: avgEff + '%',
      avgFocus,
      sessions: filteredLogs.length.toString()
    }
  }

  const wStats = calculateStats(weekLogs)
  const mStats = calculateStats(monthLogs)

  // ── Procrastination Tracker Data ──
  const computeDelayMinutes = (log: StudyLog): number | null => {
    const plannedStart = log.dailyPlan?.start_time
    if (!plannedStart || !log.start_time) return null
    // planned start is TIME (HH:MM:SS), actual start is TIMESTAMPTZ
    const actualDate = new Date(log.start_time)
    if (Number.isNaN(actualDate.getTime())) return null
    const [ph, pm] = plannedStart.split(':').map(Number)
    if (!Number.isFinite(ph) || !Number.isFinite(pm)) return null
    const plannedMinutes = ph * 60 + pm
    const actualMinutes = actualDate.getHours() * 60 + actualDate.getMinutes()
    return actualMinutes - plannedMinutes // positive = late
  }

  const weekDelays = weekLogs.map(computeDelayMinutes).filter((d): d is number => d !== null)
  const monthDelays = monthLogs.map(computeDelayMinutes).filter((d): d is number => d !== null)
  const avgWeekDelay = weekDelays.length > 0 ? Math.round(weekDelays.reduce((a, b) => a + b, 0) / weekDelays.length) : 0
  const avgMonthDelay = monthDelays.length > 0 ? Math.round(monthDelays.reduce((a, b) => a + b, 0) / monthDelays.length) : 0

  // Delay by time slot (for the month chart)
  const slotDelayMap: Record<string, number[]> = {}
  monthLogs.forEach(log => {
    const delay = computeDelayMinutes(log)
    if (delay === null) return
    const slot = log.dailyPlan?.time_slot || 'Unknown'
    if (!slotDelayMap[slot]) slotDelayMap[slot] = []
    slotDelayMap[slot].push(delay)
  })
  const procrastSlotLabels = Object.keys(slotDelayMap)
  const procrastSlotAvgs = procrastSlotLabels.map(s => {
    const arr = slotDelayMap[s]
    return arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  })


  const formatDelay = (mins: number) => {
    if (mins === 0) return 'On time'
    const abs = Math.abs(mins)
    const label = abs >= 60 ? `${(abs / 60).toFixed(1)}h` : `${abs}m`
    return mins > 0 ? `+${label} late` : `${label} early`
  }

  const WEEK_STATS = [
    { value: wStats.totalHours, label: 'Total This Week',  color: 'var(--terra)' },
    { value: wStats.avgEff,     label: 'Avg Efficiency',    color: 'var(--sage)'   },
    { value: wStats.avgFocus,   label: 'Avg Focus Score',   color: 'var(--indigo)' },
    { value: wStats.sessions,   label: 'Sessions Logged',   color: 'var(--gold)'   },
    { value: weekDelays.length > 0 ? formatDelay(avgWeekDelay) : 'N/A', label: 'Avg Start Delay', color: avgWeekDelay > 10 ? 'var(--terra)' : 'var(--sage)' },
  ]
  const MONTH_STATS = [
    { value: mStats.totalHours, label: 'Total This Month', color: 'var(--terra)' },
    { value: mStats.avgEff,     label: 'Avg Efficiency',   color: 'var(--sage)'   },
    { value: mStats.avgFocus,   label: 'Avg Focus Score',  color: 'var(--indigo)' },
    { value: mStats.sessions,   label: 'Sessions Logged',  color: 'var(--gold)'   },
    { value: monthDelays.length > 0 ? formatDelay(avgMonthDelay) : 'N/A', label: 'Avg Start Delay', color: avgMonthDelay > 10 ? 'var(--terra)' : 'var(--sage)' },
  ]

  const getWeekLabel = (weekIdx: number) => {
    const end = new Date(todayStart)
    end.setDate(todayStart.getDate() - ((3 - weekIdx) * 7))
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    return `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${end.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
  }

  const monthWeekFilterOptions = [
    { value: 'all', label: 'All 4 Weeks' },
    { value: '3', label: `Week 4 (${getWeekLabel(3)})` },
    { value: '2', label: `Week 3 (${getWeekLabel(2)})` },
    { value: '1', label: `Week 2 (${getWeekLabel(1)})` },
    { value: '0', label: `Week 1 (${getWeekLabel(0)})` },
  ]

  // Arrays for Charts
  const weekLabels = Array.from({length:7}, (_,i) => {
    const d = new Date(todayStart)
    d.setDate(todayStart.getDate() - (6 - i))
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  })
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStart)
    d.setDate(todayStart.getDate() - (6 - i))
    return toLocalDateKey(d)
  })
  const weekDateIndex = new Map(weekDates.map((date, idx) => [date, idx]))
  const planSubjectById = new Map(
    plans.map((plan) => [plan.plan_id, plan.studyTopic?.subject?.subject_name || 'Unknown subject'])
  )
  const getSubjectName = (log: StudyLog) => (
    log.dailyPlan?.studyTopic?.subject?.subject_name ||
    (log.plan_id ? planSubjectById.get(log.plan_id) : undefined) ||
    'Unknown subject'
  )

  const plannedData = Array(7).fill(0)
  const actualData = Array(7).fill(0)
  const focusData = Array(7).fill(0)
  const focusCounts = Array(7).fill(0)

  plans.forEach((p) => {
    const idx = weekDateIndex.get(p.plan_date)
    if (idx !== undefined) {
      plannedData[idx] += Number(p.target_duration || 0) / 60
    }
  })

  weekLogs.forEach((l) => {
    const startedAt = new Date(l.start_time || '')
    if (Number.isNaN(startedAt.getTime())) return
    const idx = weekDateIndex.get(toLocalDateKey(startedAt))
    if (idx === undefined) return

    actualData[idx] += getLogDurationHours(l)
    focusData[idx] += Number(l.focus_level)
    focusCounts[idx] += 1
  })
  
  const avgFocusData = focusData.map((f, i) => focusCounts[i] ? Number((f / focusCounts[i]).toFixed(1)) : 0)

  const buildSubjectHours = (sourceLogs: StudyLog[]) => {
    const subjectMap: Record<string, number> = {}

    sourceLogs.forEach((log) => {
      const subjectName = getSubjectName(log)

      if (!subjectMap[subjectName]) subjectMap[subjectName] = 0
      subjectMap[subjectName] += getLogDurationHours(log)
    })

    return {
      labels: Object.keys(subjectMap),
      data: Object.values(subjectMap).map((hours) => Number(hours.toFixed(1))),
    }
  }

  const { labels: subjectLabels, data: subjectData } = buildSubjectHours(weekLogs)
  
  // Month Charts Data
  const { labels: monthSubjectLabels, data: monthSubjectData } = buildSubjectHours(getFilteredLogs(monthLogs, subjectMonthFilter))
  
  const monthWeekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const monthPlannedData = Array(7).fill(0)
  const monthActualData = Array(7).fill(0)
  const monthEffData = Array(7).fill(0)
  const monthEffCounts = Array(7).fill(0)

  plans.forEach((p) => {
    const startedAt = new Date(p.plan_date || '')
    if (Number.isNaN(startedAt.getTime())) return
    const dayDist = Math.floor((now.getTime() - startedAt.getTime()) / 86400000)
    if (dayDist >= 0 && dayDist < 28) {
      const weekIdx = 3 - Math.floor(dayDist / 7)
      if (planVsActualFilter === 'all' || Number(planVsActualFilter) === weekIdx) {
        const dWeekDay = startedAt.getDay()
        const dayIdx = dWeekDay === 0 ? 6 : dWeekDay - 1
        monthPlannedData[dayIdx] += Number(p.target_duration || 0) / 60
      }
    }
  })

  monthLogs.forEach((log) => {
    const startedAt = new Date(log.start_time || '')
    if (Number.isNaN(startedAt.getTime())) return
    const dayDist = Math.floor((now.getTime() - startedAt.getTime()) / 86400000)
    
    if (dayDist >= 0 && dayDist < 28) {
      const weekIdx = 3 - Math.floor(dayDist / 7)
      
      if (planVsActualFilter === 'all' || Number(planVsActualFilter) === weekIdx) {
        const day = startedAt.getDay()
        const idx = day === 0 ? 6 : day - 1
        monthActualData[idx] += getLogDurationHours(log)
      }
        
      if (effMonthFilter === 'all' || Number(effMonthFilter) === weekIdx) {
        let eff = parseEfficiencyPercent(log.efficiency)
        if (eff === null && Number.isFinite(Number(log.focus_level))) {
          eff = clampPercent((Number(log.focus_level) / 5) * 100)
        }
        if (eff !== null) {
          const day = startedAt.getDay()
          const idx = day === 0 ? 6 : day - 1
          monthEffData[idx] += eff
          monthEffCounts[idx] += 1
        }
      }
    }
  })
  
  const monthAvgEffSeries = monthEffData.map((e, i) => monthEffCounts[i] ? Number((e / monthEffCounts[i]).toFixed(1)) : 0)

  // ── Monthly Subject Breakdown (per-day-per-subject line chart data) ──
  let breakdownDayCount = 28
  let breakdownEndDate = new Date(todayStart)

  if (breakdownMonthFilter !== 'all') {
    breakdownDayCount = 7
    const weekIdx = Number(breakdownMonthFilter)
    const daysAgo = (3 - weekIdx) * 7
    breakdownEndDate.setDate(todayStart.getDate() - daysAgo)
  }

  const monthBreakdownDates = Array.from({ length: breakdownDayCount }, (_, i) => {
    const d = new Date(breakdownEndDate)
    d.setDate(breakdownEndDate.getDate() - (breakdownDayCount - 1 - i))
    return d
  })
  const monthBreakdownDateKeys = monthBreakdownDates.map(d => toLocalDateKey(d))
  const monthBreakdownLabels = monthBreakdownDates.map(d =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  )

  // Gather all unique subjects within the selected monthly filter
  const breakdownLogs = getFilteredLogs(monthLogs, breakdownMonthFilter)
  const allSubjects = new Set<string>()
  breakdownLogs.forEach(log => {
    const d = new Date(log.start_time || '')
    if (Number.isNaN(d.getTime())) return
    const key = toLocalDateKey(d)
    if (monthBreakdownDateKeys.includes(key)) {
      allSubjects.add(getSubjectName(log))
    }
  })

  const subjectBreakdownMap: Record<string, number[]> = {}
  allSubjects.forEach(s => { subjectBreakdownMap[s] = Array(breakdownDayCount).fill(0) })

  breakdownLogs.forEach(log => {
    const d = new Date(log.start_time || '')
    if (Number.isNaN(d.getTime())) return
    const key = toLocalDateKey(d)
    const dayIdx = monthBreakdownDateKeys.indexOf(key)
    if (dayIdx === -1) return
    const subj = getSubjectName(log)
    if (subjectBreakdownMap[subj]) {
      subjectBreakdownMap[subj][dayIdx] += getLogDurationHours(log)
    }
  })

  const subjectBreakdownEntries = Object.entries(subjectBreakdownMap)

  // Heatmap
  const heatData = Array.from({length: 4}, () => Array(7).fill(0))
  monthLogs.forEach((l) => {
    const d = new Date(l.start_time || '')
    const dayDist = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (dayDist >= 0 && dayDist < 28) {
      const weekIdx = 3 - Math.floor(dayDist / 7)
      const rDay = d.getDay() // 0 is Sunday
      const dayIdx = rDay === 0 ? 6 : rDay - 1 // M=0, S=6
      heatData[weekIdx][dayIdx] += getLogDurationHours(l)
    }
  })


  // ── Subject Priority Matrix Data (scatter: hours vs efficiency change) ──
  const subjectPriorityData: { label: string; hours: number; effDelta: number }[] = []
  {
    const subjectSessions: Record<string, { hours: number; efficiencies: { date: number; eff: number }[] }> = {}
    monthLogs.forEach(log => {
      const subjectName = getSubjectName(log)
      const hours = getLogDurationHours(log)
      const eff = parseEfficiencyPercent(log.efficiency)
      const dateMs = new Date(log.start_time || '').getTime()
      if (!subjectSessions[subjectName]) subjectSessions[subjectName] = { hours: 0, efficiencies: [] }
      subjectSessions[subjectName].hours += hours
      if (eff !== null && Number.isFinite(dateMs)) {
        subjectSessions[subjectName].efficiencies.push({ date: dateMs, eff })
      }
    })
    for (const [name, data] of Object.entries(subjectSessions)) {
      const sorted = data.efficiencies.sort((a, b) => a.date - b.date)
      let effDelta = 0
      if (sorted.length >= 2) {
        const half = Math.floor(sorted.length / 2)
        const firstHalf = sorted.slice(0, half)
        const secondHalf = sorted.slice(half)
        const avgFirst = firstHalf.reduce((s, e) => s + e.eff, 0) / firstHalf.length
        const avgSecond = secondHalf.reduce((s, e) => s + e.eff, 0) / secondHalf.length
        effDelta = avgSecond - avgFirst
      }
      subjectPriorityData.push({ label: name, hours: Number(data.hours.toFixed(1)), effDelta: Number(effDelta.toFixed(1)) })
    }
  }

  // ── Time-on-Task Correlation Data (scatter: session duration vs efficiency) ──
  const timeOnTaskData: { x: number; y: number }[] = []
  monthLogs.forEach(log => {
    const durationMin = getLogDurationHours(log) * 60
    const eff = parseEfficiencyPercent(log.efficiency)
    if (durationMin > 0 && eff !== null) {
      timeOnTaskData.push({ x: Math.round(durationMin), y: eff })
    }
  })

  useCharts(
    tab,
    {
       labels: weekLabels,
       planned: plannedData,
       actual: actualData,
       avgFocus: avgFocusData,
       subjectLabels: subjectLabels,
       subjectData: subjectData,
    },
    {
       labels: monthWeekdayLabels,
       planned: monthPlannedData,
       actual: monthActualData,
       avgEff: monthAvgEffSeries,
       subjectLabels: monthSubjectLabels,
       subjectData: monthSubjectData,
       breakdownLabels: monthBreakdownLabels,
       breakdownEntries: subjectBreakdownEntries,
       procrastSlotLabels,
       procrastSlotAvgs,
       subjectPriorityData,
       timeOnTaskData,
    },
    {
       planVsActualWeek: planVsActualRef,
       subjectWeek: subjectEffRef,
       focusWeek: focusTimeRef,
       planVsActualMonth: planVsActualMonthRef,
       subjectMonth: subjectMonthRef,
       effMonth: effMonthRef,
       subjectBreakdownMonth: subjectBreakdownMonthRef,
       procrastination: procrastinationRef,
       priorityMatrix: priorityMatrixRef,
       timeOnTask: timeOnTaskRef,
    }
  )

  return (
    <div id="analytics-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 4 }}>Analytics</div>
          <div className="page-sub" style={{ margin: 0 }}>Your productivity story, told seamlessly through live data.</div>
        </div>
        {!isExporting && (
          <button onClick={handleExportPDF} className="insight-btn insight-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isExporting ? 0.5 : 1 }} disabled={isExporting}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export PDF
          </button>
        )}
      </div>
      <div className="tabs">
        <button className={`tab${tab === 'week' ? ' active' : ''}`} onClick={() => setTab('week')}>This Week</button>
        <button className={`tab${tab === 'month' ? ' active' : ''}`} onClick={() => setTab('month')}>This Month</button>
        <button className={`tab${tab === 'digest' ? ' active' : ''}`} onClick={() => setTab('digest')}>Weekly Digest</button>
      </div>

      {tab === 'week' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
            {WEEK_STATS.map(st => (
              <div key={st.label} className="stat-card">
                <div className="stat-value" style={{ color: st.color }}>{st.value}</div>
                <div className="stat-label">{st.label}</div>
              </div>
            ))}
          </div>
          <div className="grid-2" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="section-title">Planned vs Actual Hours</div>
              <div className="chart-wrap"><canvas ref={planVsActualRef} /></div>
            </div>
            <div className="card">
              <div className="section-title">Hours by Subject</div>
              {subjectData.length > 0 ? (
                <div className="chart-wrap"><canvas ref={subjectEffRef} /></div>
              ) : (
                <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-soft)', fontSize: '13.5px' }}>
                  No sessions logged
                </div>
              )}
            </div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="section-title">Focus by Day</div>
              <div className="chart-wrap" style={{ height: 195 }}><canvas ref={focusTimeRef} /></div>
            </div>
            <div className="card">
              <div className="section-title">Activity Heatmap</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginBottom: 10 }}>Past 4 weeks · darker = more hours</div>
              <div className="heatmap">
                {days.map((d, di) => (
                  <div key={di} className="heatmap-row">
                    <div className="heatmap-label">{d}</div>
                    {heatData.map((w, wi) => {
                      const heatLvl = w[di] > 4 ? 4 : w[di] > 2 ? 3 : w[di] > 1 ? 2 : w[di] > 0 ? 1 : 0
                      return <div key={wi} className={`heatmap-cell${heatLvl > 0 ? ` heat-${heatLvl}` : ''}`} title={`${w[di].toFixed(1)}h studied`} />
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'month' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
            {MONTH_STATS.map(st => (
              <div key={st.label} className="stat-card">
                <div className="stat-value" style={{ color: st.color }}>{st.value}</div>
                <div className="stat-label">{st.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Planned vs Actual</div>
              <CustomSelect
                value={planVsActualFilter}
                onChange={setPlanVsActualFilter}
                options={monthWeekFilterOptions}
                ariaLabel="Filter Planned vs Actual chart by week"
                style={{ width: 200 }}
              />
            </div>
            <div className="chart-wrap" style={{ height: 280 }}><canvas ref={planVsActualMonthRef} /></div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Hours by Subject</div>
                <CustomSelect
                  value={subjectMonthFilter}
                  onChange={setSubjectMonthFilter}
                  options={monthWeekFilterOptions}
                  ariaLabel="Filter Hours by Subject chart by week"
                  style={{ width: 170 }}
                />
              </div>
              {monthSubjectData.length > 0 ? (
                <div className="chart-wrap"><canvas ref={subjectMonthRef} /></div>
              ) : (
                <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-soft)', fontSize: '13.5px' }}>
                  No sessions logged
                </div>
              )}
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Efficiency by Weekday</div>
                <CustomSelect
                  value={effMonthFilter}
                  onChange={setEffMonthFilter}
                  options={monthWeekFilterOptions}
                  ariaLabel="Filter Efficiency by Weekday chart by week"
                  style={{ width: 170 }}
                />
              </div>
              <div className="chart-wrap" style={{ height: 195 }}><canvas ref={effMonthRef} /></div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div className="section-title" style={{ marginBottom: 0 }}>Monthly Subject Breakdown</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginTop: 4, marginBottom: 10 }}>Hours studied per subject over the selected monthly filter</div>
              </div>
              <CustomSelect
                value={breakdownMonthFilter}
                onChange={setBreakdownMonthFilter}
                options={monthWeekFilterOptions}
                ariaLabel="Filter Monthly Subject Breakdown chart by week"
                style={{ width: 200 }}
              />
            </div>
            {subjectBreakdownEntries.length > 0 ? (
              <div className="chart-wrap" style={{ height: 260 }}><canvas ref={subjectBreakdownMonthRef} /></div>
            ) : (
              <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-soft)', fontSize: '13.5px' }}>
                No sessions logged for the selected filter
              </div>
            )}
          </div>

          {/* ── Procrastination Tracker ── */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title">Procrastination Tracker</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginBottom: 10 }}>Average start delay by time slot — positive means you started late</div>
            {procrastSlotLabels.length > 0 ? (
              <div className="chart-wrap" style={{ height: 220 }}><canvas ref={procrastinationRef} /></div>
            ) : (
              <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-soft)', fontSize: '13.5px' }}>
                No sessions with planned start times yet. Use "Custom Time" in the planner.
              </div>
            )}
          </div>

          {/* ── Subject Priority Matrix + Time-on-Task ── */}
          <div className="grid-2" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title">Subject Priority Matrix</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginBottom: 10 }}>Effort (hours) vs Efficiency improvement — find quick wins</div>
              {subjectPriorityData.length > 0 ? (
                <div className="chart-wrap" style={{ height: 240 }}><canvas ref={priorityMatrixRef} /></div>
              ) : (
                <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-soft)', fontSize: '13.5px' }}>
                  Need multiple sessions across subjects to generate matrix
                </div>
              )}
            </div>
            <div className="card">
              <div className="section-title">Time-on-Task Correlation</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginBottom: 10 }}>Do longer sessions = better efficiency? Each dot = one session</div>
              {timeOnTaskData.length > 0 ? (
                <div className="chart-wrap" style={{ height: 240 }}><canvas ref={timeOnTaskRef} /></div>
              ) : (
                <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-soft)', fontSize: '13.5px' }}>
                  Need sessions with efficiency data to show correlation
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'digest' && (
        <div>
          {digestLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0', fontSize: 14 }}>
              Generating your weekly digest…
            </div>
          ) : !digest ? (
            <div style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0', fontSize: 14 }}>
              No digest data available. Log more sessions to generate your report.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 18 }}>{digest.week}</div>

              {/* Summary stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  { value: `${digest.summary.totalHours}h`, label: 'Total Hours', color: 'var(--terra)' },
                  { value: digest.summary.sessions, label: 'Sessions', color: 'var(--gold)' },
                  { value: digest.summary.avgEfficiency, label: 'Avg Efficiency', color: 'var(--sage)' },
                  { value: digest.summary.avgDelay, label: 'Avg Delay', color: 'var(--indigo)' },
                  { value: digest.summary.bestSubject, label: 'Best Subject', color: 'var(--sage)' },
                  { value: digest.summary.worstSubject, label: 'Needs Work', color: 'var(--terra)' },
                ].map(st => (
                  <div key={st.label} className="stat-card">
                    <div className="stat-value" style={{ color: st.color, fontSize: 18 }}>{st.value}</div>
                    <div className="stat-label">{st.label}</div>
                  </div>
                ))}
              </div>

              {/* 3-3-3 Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {/* Wins */}
                <div className="card" style={{ borderTop: '3px solid var(--sage)' }}>
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🏆</span> 3 Wins
                  </div>
                  {digest.wins.length === 0 ? (
                    <div style={{ color: 'var(--text-soft)', fontSize: 13, fontStyle: 'italic' }}>No wins identified yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {digest.wins.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(107,155,122,.06)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--sage)' }}>
                          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>{item.text}</div>
                          {item.metric && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage)', whiteSpace: 'nowrap' }}>{item.metric}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Issues */}
                <div className="card" style={{ borderTop: '3px solid var(--terra)' }}>
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>⚠️</span> 3 Issues
                  </div>
                  {digest.issues.length === 0 ? (
                    <div style={{ color: 'var(--text-soft)', fontSize: 13, fontStyle: 'italic' }}>No issues found — keep it up!</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {digest.issues.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(201,107,58,.06)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--terra)' }}>
                          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>{item.text}</div>
                          {item.metric && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--terra)', whiteSpace: 'nowrap' }}>{item.metric}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="card" style={{ borderTop: '3px solid var(--indigo)' }}>
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🎯</span> 3 Actions
                  </div>
                  {digest.actions.length === 0 ? (
                    <div style={{ color: 'var(--text-soft)', fontSize: 13, fontStyle: 'italic' }}>No actions needed yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {digest.actions.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(74,95,160,.06)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--indigo)' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--indigo)', minWidth: 20 }}>{i + 1}.</div>
                          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>{item.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Chart.js integration via dynamic script ── */
function useCharts(
  tab: 'week' | 'month',
  weekData: {
    labels: string[],
    planned: number[],
    actual: number[],
    avgFocus: number[],
    subjectLabels: string[],
    subjectData: number[],
  },
  monthData: {
    labels: string[],
    planned: number[],
    actual: number[],
    subjectLabels: string[],
    subjectData: number[],
    avgEff: number[],
    breakdownLabels: string[],
    breakdownEntries: [string, number[]][],
    procrastSlotLabels: string[],
    procrastSlotAvgs: number[],
    subjectPriorityData: { label: string; hours: number; effDelta: number }[],
    timeOnTaskData: { x: number; y: number }[],
  },
  refs: {
    planVsActualWeek: React.RefObject<HTMLCanvasElement | null>,
    subjectWeek: React.RefObject<HTMLCanvasElement | null>,
    focusWeek: React.RefObject<HTMLCanvasElement | null>,
    planVsActualMonth: React.RefObject<HTMLCanvasElement | null>,
    subjectMonth: React.RefObject<HTMLCanvasElement | null>,
    effMonth: React.RefObject<HTMLCanvasElement | null>,
    subjectBreakdownMonth: React.RefObject<HTMLCanvasElement | null>,
    procrastination: React.RefObject<HTMLCanvasElement | null>,
    priorityMatrix: React.RefObject<HTMLCanvasElement | null>,
    timeOnTask: React.RefObject<HTMLCanvasElement | null>,
  }
) {
  useEffect(() => {
    let cancelled = false
    const charts: ChartLike[] = []
    let scriptEl: HTMLScriptElement | null = null

    const destroyExistingOnCanvas = (canvas: HTMLCanvasElement | null, ChartCtor: { getChart?: (item: HTMLCanvasElement) => { destroy: () => void } | undefined }) => {
      if (!canvas || !ChartCtor?.getChart) return
      const existing = ChartCtor.getChart(canvas)
      if (existing) existing.destroy()
    }

    const destroyAllKnownCharts = () => {
      // @ts-expect-error Chart is loaded via CDN
      const Chart = window.Chart as { getChart?: (item: HTMLCanvasElement) => { destroy: () => void } | undefined } | undefined
      if (!Chart) return
      destroyExistingOnCanvas(refs.planVsActualWeek.current, Chart)
      destroyExistingOnCanvas(refs.subjectWeek.current, Chart)
      destroyExistingOnCanvas(refs.focusWeek.current, Chart)
      destroyExistingOnCanvas(refs.planVsActualMonth.current, Chart)
      destroyExistingOnCanvas(refs.subjectMonth.current, Chart)
      destroyExistingOnCanvas(refs.effMonth.current, Chart)
      destroyExistingOnCanvas(refs.subjectBreakdownMonth.current, Chart)
      destroyExistingOnCanvas(refs.procrastination.current, Chart)
      destroyExistingOnCanvas(refs.priorityMatrix.current, Chart)
      destroyExistingOnCanvas(refs.timeOnTask.current, Chart)
    }

    const buildWeek = () => {
      if (tab !== 'week') return
      // @ts-expect-error Chart is loaded via CDN
      const Chart = window.Chart
      if (!Chart) return
      if (cancelled) return

      if (refs.planVsActualWeek.current) {
        destroyExistingOnCanvas(refs.planVsActualWeek.current, Chart)
        charts.push(new Chart(refs.planVsActualWeek.current, {
          type: 'bar',
          data: {
            labels: weekData.labels,
            datasets: [
              {
                label: 'Planned',
                data: weekData.planned,
                backgroundColor: 'rgba(201,107,58,.18)',
                borderColor: '#C96B3A',
                borderWidth: 1.5,
                borderRadius: 6,
              },
              {
                label: 'Actual',
                data: weekData.actual,
                backgroundColor: 'rgba(107,155,122,.25)',
                borderColor: '#6B9B7A',
                borderWidth: 2,
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: CHART_FONT, boxWidth: 9, boxHeight: 9, padding: 12 } } },
            scales: {
              x: { ticks: { font: CHART_FONT }, grid: { display: false } },
              y: { ticks: { font: CHART_FONT, callback: (v: number) => v+'h' }, grid: { color: 'rgba(100,80,50,.06)' }, beginAtZero: true },
            },
          },
        }))
      }

      if (refs.subjectWeek.current) {
        destroyExistingOnCanvas(refs.subjectWeek.current, Chart)
        const bg = ['#4A5FA0','#C96B3A','#6B9B7A','#D4A843','#B85C7A']
        charts.push(new Chart(refs.subjectWeek.current, { type: 'doughnut', data: { labels: weekData.subjectLabels, datasets: [{ data: weekData.subjectData, backgroundColor: bg.slice(0, Math.max(5, weekData.subjectLabels.length)), borderWidth: 0, hoverOffset: 7 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { font: CHART_FONT, boxWidth: 9, boxHeight: 9, padding: 12 } } } } }))
      }

      if (refs.focusWeek.current) {
        destroyExistingOnCanvas(refs.focusWeek.current, Chart)
        charts.push(new Chart(refs.focusWeek.current, {
          type: 'line',
          data: {
            labels: weekData.labels,
            datasets: [{
              label: 'Avg Focus',
              data: weekData.avgFocus,
              borderColor: '#D4A843',
              backgroundColor: 'rgba(212,168,67,.12)',
              tension: .4,
              fill: true,
              pointBackgroundColor: '#D4A843',
              pointRadius: 4,
              pointHoverRadius: 5,
              clip: false,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 8, right: 10, bottom: 6, left: 4 } },
            plugins: { legend: { display: false } },
            scales: {
              x: {
                offset: true,
                ticks: { font: CHART_FONT, padding: 8 },
                grid: { display: false },
              },
              y: {
                min: 0,
                max: 5,
                ticks: { font: CHART_FONT, stepSize: 1, padding: 6 },
                grid: { color: 'rgba(100,80,50,.06)' },
              },
            },
          },
        }))
      }
    }

    const buildMonth = () => {
      if (tab !== 'month') return
      // @ts-expect-error Chart is loaded via CDN
      const Chart = window.Chart
      if (!Chart) return
      if (cancelled) return

      if (refs.planVsActualMonth.current) {
        destroyExistingOnCanvas(refs.planVsActualMonth.current, Chart)
        charts.push(new Chart(refs.planVsActualMonth.current, {
          type: 'bar',
          data: {
            labels: monthData.labels,
            datasets: [
              {
                label: 'Planned',
                data: monthData.planned,
                backgroundColor: 'rgba(201,107,58,.18)',
                borderColor: '#C96B3A',
                borderWidth: 1.5,
                borderRadius: 6,
              },
              {
                label: 'Actual',
                data: monthData.actual,
                backgroundColor: 'rgba(107,155,122,.25)',
                borderColor: '#6B9B7A',
                borderWidth: 2,
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: CHART_FONT, boxWidth: 9, boxHeight: 9, padding: 12 } } },
            scales: {
              x: { ticks: { font: CHART_FONT }, grid: { display: false } },
              y: { ticks: { font: CHART_FONT, callback: (v: number) => v+'h' }, grid: { color: 'rgba(100,80,50,.06)' }, beginAtZero: true },
            },
          },
        }))
      }

      if (refs.subjectMonth.current) {
        destroyExistingOnCanvas(refs.subjectMonth.current, Chart)
        const bg = ['#4A5FA0','#C96B3A','#6B9B7A','#D4A843','#B85C7A']
        charts.push(new Chart(refs.subjectMonth.current, { type: 'doughnut', data: { labels: monthData.subjectLabels, datasets: [{ data: monthData.subjectData, backgroundColor: bg.slice(0, Math.max(5, monthData.subjectLabels.length)), borderWidth: 0, hoverOffset: 7 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { font: CHART_FONT, boxWidth: 9, boxHeight: 9, padding: 12 } } } } }))
      }

      if (refs.effMonth.current) {
        destroyExistingOnCanvas(refs.effMonth.current, Chart)
        charts.push(new Chart(refs.effMonth.current, {
          type: 'line',
          data: {
            labels: monthData.labels,
            datasets: [{
              label: 'Avg Efficiency (%)',
              data: monthData.avgEff,
              borderColor: '#6B9B7A',
              backgroundColor: 'rgba(107,155,122,.12)',
              tension: .4,
              fill: true,
              pointBackgroundColor: '#6B9B7A',
              pointRadius: 4,
              pointHoverRadius: 5,
              clip: false,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 8, right: 10, bottom: 6, left: 4 } },
            plugins: { legend: { display: false } },
            scales: {
              x: {
                offset: true,
                ticks: { font: CHART_FONT, padding: 8 },
                grid: { display: false },
              },
              y: {
                min: 0,
                max: 100,
                ticks: { font: CHART_FONT, stepSize: 20, padding: 6, callback: (v: number) => v + '%' },
                grid: { color: 'rgba(100,80,50,.06)' },
              },
            },
          },
        }))
      }

      // Subject Breakdown multi-line chart
      if (refs.subjectBreakdownMonth.current && monthData.breakdownEntries.length > 0) {
        destroyExistingOnCanvas(refs.subjectBreakdownMonth.current, Chart)
        const lineColors = ['#3D4F8C','#C96B3A','#6B9B7A','#D4A843','#B85C7A','#2A8C8C','#6B4F8C']
        const bgColors  = ['rgba(61,79,140,.08)','rgba(201,107,58,.08)','rgba(107,155,122,.08)','rgba(212,168,67,.08)','rgba(184,92,122,.08)','rgba(42,140,140,.08)','rgba(107,79,140,.08)']
        const datasets = monthData.breakdownEntries.map(([name, data]: [string, number[]], idx: number) => ({
          label: name,
          data: data.map((v: number) => Number(v.toFixed(2))),
          borderColor: lineColors[idx % lineColors.length],
          backgroundColor: bgColors[idx % bgColors.length],
          tension: .4,
          fill: idx === 0,
          pointBackgroundColor: lineColors[idx % lineColors.length],
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          clip: false,
        }))
        charts.push(new Chart(refs.subjectBreakdownMonth.current, {
          type: 'line',
          data: { labels: monthData.breakdownLabels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 8, right: 10, bottom: 6, left: 4 } },
            plugins: {
              legend: {
                position: 'top',
                labels: { font: CHART_FONT, boxWidth: 10, boxHeight: 10, padding: 14 },
              },
            },
            scales: {
              x: {
                offset: true,
                ticks: { font: CHART_FONT, padding: 8, maxRotation: 0 },
                grid: { display: false },
              },
              y: {
                min: 0,
                ticks: { font: CHART_FONT, padding: 6, callback: (v: number) => v + 'h' },
                grid: { color: 'rgba(100,80,50,.06)' },
              },
            },
          },
        }))
      }

      // Procrastination Tracker bar chart
      if (refs.procrastination.current && monthData.procrastSlotLabels.length > 0) {
        destroyExistingOnCanvas(refs.procrastination.current, Chart)
        const delayColors = monthData.procrastSlotAvgs.map((v: number) =>
          v > 15 ? 'rgba(201,107,58,.7)' : v > 0 ? 'rgba(212,168,67,.6)' : 'rgba(107,155,122,.6)'
        )
        charts.push(new Chart(refs.procrastination.current, {
          type: 'bar',
          data: {
            labels: monthData.procrastSlotLabels,
            datasets: [{
              label: 'Avg Delay (min)',
              data: monthData.procrastSlotAvgs,
              backgroundColor: delayColors,
              borderColor: delayColors.map((c: string) => c.replace(/[\d.]+\)$/, '1)')),
              borderWidth: 1.5,
              borderRadius: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
              x: {
                ticks: { font: CHART_FONT, callback: (v: number) => (v > 0 ? '+' : '') + v + 'm' },
                grid: { color: 'rgba(100,80,50,.06)' },
              },
              y: { ticks: { font: CHART_FONT }, grid: { display: false } },
            },
          },
        }))
      }

      // Subject Priority Matrix scatter
      if (refs.priorityMatrix.current && monthData.subjectPriorityData.length > 0) {
        destroyExistingOnCanvas(refs.priorityMatrix.current, Chart)
        const scatterColors = ['#4A5FA0','#C96B3A','#6B9B7A','#D4A843','#B85C7A','#2A8C8C','#6B4F8C']
        const datasets = monthData.subjectPriorityData.map((item: { label: string; hours: number; effDelta: number }, idx: number) => ({
          label: item.label,
          data: [{ x: item.hours, y: item.effDelta }],
          backgroundColor: scatterColors[idx % scatterColors.length],
          borderColor: scatterColors[idx % scatterColors.length],
          pointRadius: 8,
          pointHoverRadius: 11,
        }))
        charts.push(new Chart(refs.priorityMatrix.current, {
          type: 'scatter',
          data: { datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', labels: { font: CHART_FONT, boxWidth: 8, boxHeight: 8, padding: 10 } },
              tooltip: {
                callbacks: {
                  label: (ctx: { dataset: { label: string }; parsed: { x: number; y: number } }) =>
                    `${ctx.dataset.label}: ${ctx.parsed.x}h effort, ${ctx.parsed.y > 0 ? '+' : ''}${ctx.parsed.y}% eff. change`,
                },
              },
            },
            scales: {
              x: { title: { display: true, text: 'Hours Invested', font: CHART_FONT }, ticks: { font: CHART_FONT }, grid: { color: 'rgba(100,80,50,.06)' }, beginAtZero: true },
              y: { title: { display: true, text: 'Efficiency Change (%)', font: CHART_FONT }, ticks: { font: CHART_FONT, callback: (v: number) => (v > 0 ? '+' : '') + v + '%' }, grid: { color: 'rgba(100,80,50,.06)' } },
            },
          },
        }))
      }

      // Time-on-Task Correlation scatter
      if (refs.timeOnTask.current && monthData.timeOnTaskData.length > 0) {
        destroyExistingOnCanvas(refs.timeOnTask.current, Chart)
        charts.push(new Chart(refs.timeOnTask.current, {
          type: 'scatter',
          data: {
            datasets: [{
              label: 'Session',
              data: monthData.timeOnTaskData,
              backgroundColor: 'rgba(74,95,160,.45)',
              borderColor: '#4A5FA0',
              pointRadius: 5,
              pointHoverRadius: 7,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: { parsed: { x: number; y: number } }) => `${ctx.parsed.x} min → ${ctx.parsed.y}% eff.`,
                },
              },
            },
            scales: {
              x: { title: { display: true, text: 'Session Duration (min)', font: CHART_FONT }, ticks: { font: CHART_FONT }, grid: { color: 'rgba(100,80,50,.06)' }, beginAtZero: true },
              y: { title: { display: true, text: 'Efficiency (%)', font: CHART_FONT }, min: 0, max: 100, ticks: { font: CHART_FONT, stepSize: 20, callback: (v: number) => v + '%' }, grid: { color: 'rgba(100,80,50,.06)' } },
            },
          },
        }))
      }
    }

    const handleChartReady = () => {
      if (cancelled) return
      buildWeek()
      buildMonth()
    }

    // Load Chart.js once
    // @ts-expect-error Chart is loaded via CDN
    if (window.Chart) {
      handleChartReady()
    } else {
      const existing = document.getElementById('chartjs-cdn') as HTMLScriptElement | null
      if (existing) {
        scriptEl = existing
        existing.addEventListener('load', handleChartReady)
      } else {
        const s = document.createElement('script')
        s.id = 'chartjs-cdn'
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
        s.addEventListener('load', handleChartReady)
        document.head.appendChild(s)
        scriptEl = s
      }
    }

    return () => {
      cancelled = true
      if (scriptEl) {
        scriptEl.removeEventListener('load', handleChartReady)
      }
      charts.forEach(c => c.destroy())
      destroyAllKnownCharts()
    }
  }, [
    tab,
    weekData.labels.join(','), weekData.planned.join(','), weekData.actual.join(','), weekData.avgFocus.join(','), weekData.subjectLabels.join(','), weekData.subjectData.join(','),
    monthData.labels.join(','), monthData.planned.join(','), monthData.actual.join(','), monthData.avgEff.join(','), monthData.subjectLabels.join(','), monthData.subjectData.join(','),
    monthData.breakdownLabels.join(','), monthData.breakdownEntries.map(([n,d]) => n+':'+d.join('|')).join(','),
    monthData.procrastSlotLabels.join(','), monthData.procrastSlotAvgs.join(','),
    monthData.subjectPriorityData.map(d => d.label+d.hours+d.effDelta).join(','),
    monthData.timeOnTaskData.map(d => d.x+':'+d.y).join(','),
    refs.planVsActualWeek, refs.subjectWeek, refs.focusWeek, refs.planVsActualMonth, refs.subjectMonth, refs.effMonth, refs.subjectBreakdownMonth,
    refs.procrastination, refs.priorityMatrix, refs.timeOnTask
  ]) // Update when live data loads
}
