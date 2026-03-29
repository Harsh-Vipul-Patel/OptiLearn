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
  efficiency?: number
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

export function AnalyticsPage() {
  const { data: session } = useSession()
  const { logs } = useStudyLogSync(session?.user?.id || '')
  const { plans } = usePlans()
  const planVsActualRef = useRef<HTMLCanvasElement>(null)
  const subjectEffRef = useRef<HTMLCanvasElement>(null)
  const focusTimeRef = useRef<HTMLCanvasElement>(null)
  const monthRef = useRef<HTMLCanvasElement>(null)

  const [tab, setTab] = useState<'week' | 'month'>('week')
  const [monthSubjectFilter, setMonthSubjectFilter] = useState('all')
  
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
    const effArr = filteredLogs.map((l) => Number(l.efficiency || 0)).filter(Boolean)
    const avgEff = effArr.length ? Math.round(effArr.reduce((a,b)=>a+b,0)/effArr.length) : 0
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
  const { labels: monthSubjectOptions } = buildSubjectHours(monthLogs)
  const monthSubjectFilterOptions = [
    { value: 'all', label: 'All Subjects' },
    ...monthSubjectOptions.map((subject) => ({ value: subject, label: subject })),
  ]

  const monthWeekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const monthWeekdayData = Array(7).fill(0)
  const monthLogsForWeekdayChart = monthLogs.filter((log) => (
    monthSubjectFilter === 'all' || getSubjectName(log) === monthSubjectFilter
  ))
  monthLogsForWeekdayChart.forEach((log) => {
    const startedAt = new Date(log.start_time || '')
    if (Number.isNaN(startedAt.getTime())) return
    const day = startedAt.getDay()
    const idx = day === 0 ? 6 : day - 1
    monthWeekdayData[idx] += getLogDurationHours(log)
  })
  const monthWeekdaySeries = monthWeekdayData.map((hours) => Number(hours.toFixed(2)))
  const selectedMonthSubjectLabel = monthSubjectFilter === 'all' ? 'All subjects' : monthSubjectFilter

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
    weekLabels,
    plannedData,
    actualData,
    avgFocusData,
    subjectLabels,
    subjectData,
    monthWeekdayLabels,
    monthWeekdaySeries,
    planVsActualRef,
    subjectEffRef,
    focusTimeRef,
    monthRef
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
              <div className="chart-wrap"><canvas ref={subjectEffRef} /></div>
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

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Monthly Weekday Hours</div>
              <CustomSelect
                value={monthSubjectFilter}
                onChange={setMonthSubjectFilter}
                options={monthSubjectFilterOptions}
                ariaLabel="Filter monthly weekday chart by subject"
                style={{ width: 220, minWidth: 160 }}
              />
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-soft)', marginBottom: 8 }}>
              X-axis: weekdays, Y-axis: hours · Filter: {selectedMonthSubjectLabel}
            </div>
            <div className="chart-wrap" style={{ height: 280 }}><canvas ref={monthRef} /></div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Chart.js integration via dynamic script ── */
function useCharts(
  tab: 'week' | 'month', 
  weekLabels: string[], 
  plannedData: number[],
  actualData: number[], 
  avgFocusData: number[], 
  subjectLabels: string[], 
  subjectData: number[],
  monthLabels: string[],
  monthData: number[],
  planVsActualRef: React.RefObject<HTMLCanvasElement | null>,
  subjectEffRef: React.RefObject<HTMLCanvasElement | null>,
  focusTimeRef: React.RefObject<HTMLCanvasElement | null>,
  monthRef: React.RefObject<HTMLCanvasElement | null>
) {
  useEffect(() => {
    let cancelled = false
    const weekCharts: ChartLike[] = []
    let monthChart: ChartLike | null = null
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
      destroyExistingOnCanvas(planVsActualRef.current, Chart)
      destroyExistingOnCanvas(subjectEffRef.current, Chart)
      destroyExistingOnCanvas(focusTimeRef.current, Chart)
      destroyExistingOnCanvas(monthRef.current, Chart)
    }

    const buildWeek = () => {
      if (tab !== 'week') return
      // @ts-expect-error Chart is loaded via CDN
      const Chart = window.Chart
      if (!Chart) return
      if (cancelled) return

      if (planVsActualRef.current) {
        destroyExistingOnCanvas(planVsActualRef.current, Chart)
        weekCharts.push(new Chart(planVsActualRef.current, {
          type: 'bar',
          data: {
            labels: weekLabels,
            datasets: [
              {
                label: 'Planned',
                data: plannedData,
                backgroundColor: 'rgba(201,107,58,.18)',
                borderColor: '#C96B3A',
                borderWidth: 1.5,
                borderRadius: 6,
              },
              {
                label: 'Actual',
                data: actualData,
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

      if (subjectEffRef.current) {
        destroyExistingOnCanvas(subjectEffRef.current, Chart)
        const bg = ['#4A5FA0','#C96B3A','#6B9B7A','#D4A843','#B85C7A']
        weekCharts.push(new Chart(subjectEffRef.current, { type: 'doughnut', data: { labels: subjectLabels, datasets: [{ data: subjectData, backgroundColor: bg.slice(0, subjectLabels.length), borderWidth: 0, hoverOffset: 7 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { font: CHART_FONT, boxWidth: 9, boxHeight: 9, padding: 12 } } } } }))
      }

      if (focusTimeRef.current) {
        destroyExistingOnCanvas(focusTimeRef.current, Chart)
        weekCharts.push(new Chart(focusTimeRef.current, {
          type: 'line',
          data: {
            labels: weekLabels,
            datasets: [{
              label: 'Avg Focus',
              data: avgFocusData,
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

      if (monthRef.current) {
        destroyExistingOnCanvas(monthRef.current, Chart)
        monthChart = new Chart(monthRef.current, {
          type: 'bar',
          data: {
            labels: monthLabels,
            datasets: [{
              label: 'Hours by Weekday',
              data: monthData,
              borderColor: '#6B9B7A',
              backgroundColor: 'rgba(107,155,122,.32)',
              borderWidth: 1,
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: { font: CHART_FONT, boxWidth: 9, boxHeight: 9, padding: 12 },
              },
            },
            scales: {
              x: {
                ticks: { font: CHART_FONT, maxTicksLimit: 10 },
                grid: { display: false },
              },
              y: {
                ticks: { font: CHART_FONT, callback: (v: number) => v + 'h' },
                grid: { color: 'rgba(100,80,50,.06)' },
                beginAtZero: true,
              },
            },
          },
        })
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
      weekCharts.forEach(c => c.destroy())
      if (monthChart) monthChart.destroy()
      destroyAllKnownCharts()
    }
  }, [tab, weekLabels, plannedData, actualData, avgFocusData, subjectLabels, subjectData, monthLabels, monthData, planVsActualRef, subjectEffRef, focusTimeRef, monthRef]) // Update when live data loads
}
