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

  const [tab, setTab] = useState<'week' | 'month'>('week')
  const [monthWeekFilter, setMonthWeekFilter] = useState('all')
  
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

  const WEEK_STATS = [
    { value: wStats.totalHours, label: 'Total This Week',  color: 'var(--terra)' },
    { value: wStats.avgEff,     label: 'Avg Efficiency',    color: 'var(--sage)'   },
    { value: wStats.avgFocus,   label: 'Avg Focus Score',   color: 'var(--indigo)' },
    { value: wStats.sessions,   label: 'Sessions Logged',   color: 'var(--gold)'   },
  ]
  const MONTH_STATS = [
    { value: mStats.totalHours, label: 'Total This Month', color: 'var(--terra)' },
    { value: mStats.avgEff,     label: 'Avg Efficiency',   color: 'var(--sage)'   },
    { value: mStats.avgFocus,   label: 'Avg Focus Score',  color: 'var(--indigo)' },
    { value: mStats.sessions,   label: 'Sessions Logged',  color: 'var(--gold)'   },
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
  const filteredMonthLogs = monthLogs.filter((log) => {
    if (monthWeekFilter === 'all') return true
    const startedAt = new Date(log.start_time || '')
    if (Number.isNaN(startedAt.getTime())) return false
    const dayDist = Math.floor((now.getTime() - startedAt.getTime()) / 86400000)
    if (dayDist >= 0 && dayDist < 28) {
      const weekIdx = 3 - Math.floor(dayDist / 7)
      return Number(monthWeekFilter) === weekIdx
    }
    return false
  })

  const { labels: monthSubjectLabels, data: monthSubjectData } = buildSubjectHours(filteredMonthLogs)
  
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
      if (monthWeekFilter === 'all' || Number(monthWeekFilter) === weekIdx) {
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
      if (monthWeekFilter === 'all' || Number(monthWeekFilter) === weekIdx) {
        const day = startedAt.getDay()
        const idx = day === 0 ? 6 : day - 1
        monthActualData[idx] += getLogDurationHours(log)
        
        let eff = parseEfficiencyPercent(log.efficiency)
        if (eff === null && Number.isFinite(Number(log.focus_level))) {
          eff = clampPercent((Number(log.focus_level) / 5) * 100)
        }
        if (eff !== null) {
          monthEffData[idx] += eff
          monthEffCounts[idx] += 1
        }
      }
    }
  })
  
  const monthAvgEffSeries = monthEffData.map((e, i) => monthEffCounts[i] ? Number((e / monthEffCounts[i]).toFixed(1)) : 0)

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
    },
    {
       planVsActualWeek: planVsActualRef,
       subjectWeek: subjectEffRef,
       focusWeek: focusTimeRef,
       planVsActualMonth: planVsActualMonthRef,
       subjectMonth: subjectMonthRef,
       effMonth: effMonthRef
    }
  )

  return (
    <div>
      <div className="page-title">Analytics</div>
      <div className="page-sub">Your productivity story, told seamlessly through live data.</div>
      <div className="tabs">
        <button className={`tab${tab === 'week' ? ' active' : ''}`} onClick={() => setTab('week')}>This Week</button>
        <button className={`tab${tab === 'month' ? ' active' : ''}`} onClick={() => setTab('month')}>This Month</button>
      </div>

      {tab === 'week' && (
        <div>
          <div className="grid-4" style={{ marginBottom: 18 }}>
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
          <div className="grid-4" style={{ marginBottom: 18 }}>
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
                value={monthWeekFilter}
                onChange={setMonthWeekFilter}
                options={monthWeekFilterOptions}
                ariaLabel="Filter monthly chart by week"
                style={{ width: 240 }}
              />
            </div>
            <div className="chart-wrap" style={{ height: 280 }}><canvas ref={planVsActualMonthRef} /></div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="section-title">Hours by Subject</div>
              {monthSubjectData.length > 0 ? (
                <div className="chart-wrap"><canvas ref={subjectMonthRef} /></div>
              ) : (
                <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-soft)', fontSize: '13.5px' }}>
                  No sessions logged
                </div>
              )}
            </div>
            <div className="card">
              <div className="section-title">Efficiency by Weekday</div>
              <div className="chart-wrap" style={{ height: 195 }}><canvas ref={effMonthRef} /></div>
            </div>
          </div>
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
  },
  refs: {
    planVsActualWeek: React.RefObject<HTMLCanvasElement | null>,
    subjectWeek: React.RefObject<HTMLCanvasElement | null>,
    focusWeek: React.RefObject<HTMLCanvasElement | null>,
    planVsActualMonth: React.RefObject<HTMLCanvasElement | null>,
    subjectMonth: React.RefObject<HTMLCanvasElement | null>,
    effMonth: React.RefObject<HTMLCanvasElement | null>
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
    refs.planVsActualWeek, refs.subjectWeek, refs.focusWeek, refs.planVsActualMonth, refs.subjectMonth, refs.effMonth
  ]) // Update when live data loads
}
