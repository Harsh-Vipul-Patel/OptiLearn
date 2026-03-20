'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/components/Providers'
import { useStudyLogSync } from '@/hooks/useStudyLogSync'
import { usePlans } from '@/hooks/usePlans'

const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function AnalyticsPage() {
  const { data: session } = useSession()
  const { logs } = useStudyLogSync(session?.user?.id || '')
  const { plans } = usePlans()

  const [tab, setTab] = useState<'week' | 'month'>('week')
  
  // Data Aggregations
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)
  const monthStart = new Date(now)
  monthStart.setDate(now.getDate() - 30)

  const weekLogs = logs.filter((l: any) => new Date(l.start_time) >= weekStart)
  const monthLogs = logs.filter((l: any) => new Date(l.start_time) >= monthStart)

  const calculateStats = (filteredLogs: any[]) => {
    const totalMin = filteredLogs.reduce((acc, l) => {
      const s = new Date(l.start_time).getTime()
      const e = l.end_time ? new Date(l.end_time).getTime() : new Date().getTime()
      return acc + (e - s) / 60000
    }, 0)
    const effArr = filteredLogs.map((l: any) => l.efficiency).filter(Boolean)
    const avgEff = effArr.length ? Math.round(effArr.reduce((a:number,b:number)=>a+b,0)/effArr.length) : 0
    const focusArr = filteredLogs.map((l: any) => Number(l.focus_level)).filter(Boolean)
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
    const d=new Date(); d.setDate(d.getDate() - (6-i)); return d.toLocaleDateString('en-US',{weekday:'short'})
  })
  const actualData = Array(7).fill(0)
  const focusData = Array(7).fill(0)
  const focusCounts = Array(7).fill(0)

  weekLogs.forEach((l: any) => {
    // 0 = today, 1 = yesterday, ... 6 = 6 days ago
    const dayDist = Math.floor((now.getTime() - new Date(l.start_time).getTime()) / 86400000)
    if (dayDist >= 0 && dayDist < 7) {
      const idx = 6 - dayDist
      const s = new Date(l.start_time).getTime()
      const e = l.end_time ? new Date(l.end_time).getTime() : new Date().getTime()
      actualData[idx] += (e - s) / 3600000 // push hours
      
      focusData[idx] += Number(l.focus_level)
      focusCounts[idx] += 1
    }
  })
  
  const avgFocusData = focusData.map((f, i) => focusCounts[i] ? Number((f / focusCounts[i]).toFixed(1)) : 0)

  // Subject parsing
  const subjMap: Record<string, number> = {}
  weekLogs.forEach((l: any) => {
    const plan = plans.find(p => p.plan_id === l.plan_id)
    if (plan && plan.studyTopic?.subject) {
      const subj = plan.studyTopic.subject.subject_name
      if (!subjMap[subj]) subjMap[subj] = 0
      const s = new Date(l.start_time).getTime()
      const e = l.end_time ? new Date(l.end_time).getTime() : new Date().getTime()
      subjMap[subj] += (e - s) / 3600000
    }
  })
  const subjectLabels = Object.keys(subjMap)
  const subjectData = Object.values(subjMap).map(h => Number(h.toFixed(1)))

  // Heatmap
  const heatData = Array.from({length: 4}, () => Array(7).fill(0))
  monthLogs.forEach((l: any) => {
    const d = new Date(l.start_time)
    const dayDist = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (dayDist >= 0 && dayDist < 28) {
      const weekIdx = 3 - Math.floor(dayDist / 7)
      const rDay = d.getDay() // 0 is Sunday
      const dayIdx = rDay === 0 ? 6 : rDay - 1 // M=0, S=6
      const s = new Date(l.start_time).getTime()
      const e = l.end_time ? new Date(l.end_time).getTime() : new Date().getTime()
      heatData[weekIdx][dayIdx] += (e - s) / 3600000
    }
  })

  const charts = useCharts(tab, weekLabels, actualData, avgFocusData, subjectLabels, subjectData)

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
              <div className="section-title">Actual Hours</div>
              <div className="chart-wrap"><canvas ref={charts.planVsActualRef} /></div>
            </div>
            <div className="card">
              <div className="section-title">Hours by Subject</div>
              <div className="chart-wrap"><canvas ref={charts.subjectEffRef} /></div>
            </div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="section-title">Focus by Day</div>
              <div className="chart-wrap" style={{ height: 195 }}><canvas ref={charts.focusTimeRef} /></div>
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
            <div className="section-title">Monthly Subject Breakdown</div>
            <div className="chart-wrap" style={{ height: 240 }}><canvas ref={charts.monthRef} /></div>
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
  actualData: number[], 
  avgFocusData: number[], 
  subjectLabels: string[], 
  subjectData: number[]
) {
  const planVsActualRef = useRef<HTMLCanvasElement>(null)
  const subjectEffRef   = useRef<HTMLCanvasElement>(null)
  const focusTimeRef    = useRef<HTMLCanvasElement>(null)
  const monthRef        = useRef<HTMLCanvasElement>(null)

  const font = { family: 'Inter,sans-serif', size: 11.5 }

  useEffect(() => {
    let weekCharts: any[] = []
    let monthChart: any = null

    const buildWeek = () => {
      if (tab !== 'week') return
      // @ts-expect-error Chart is loaded via CDN
      const Chart = window.Chart
      if (!Chart) return

      if (planVsActualRef.current) {
        weekCharts.push(new Chart(planVsActualRef.current, { type: 'bar', data: { labels: weekLabels, datasets: [{ label: 'Actual', data: actualData, backgroundColor: 'rgba(107,155,122,.25)', borderColor: '#6B9B7A', borderWidth: 2, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font, boxWidth: 9, boxHeight: 9, padding: 12 } } }, scales: { x: { ticks: { font }, grid: { display: false } }, y: { ticks: { font, callback: (v: number) => v+'h' }, grid: { color: 'rgba(100,80,50,.06)' }, beginAtZero: true } } } }))
      }

      if (subjectEffRef.current) {
        const bg = ['#4A5FA0','#C96B3A','#6B9B7A','#D4A843','#B85C7A']
        weekCharts.push(new Chart(subjectEffRef.current, { type: 'doughnut', data: { labels: subjectLabels, datasets: [{ data: subjectData, backgroundColor: bg.slice(0, subjectLabels.length), borderWidth: 0, hoverOffset: 7 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { font, boxWidth: 9, boxHeight: 9, padding: 12 } } } } }))
      }

      if (focusTimeRef.current) {
        weekCharts.push(new Chart(focusTimeRef.current, { type: 'line', data: { labels: weekLabels, datasets: [{ label: 'Avg Focus', data: avgFocusData, borderColor: '#D4A843', backgroundColor: 'rgba(212,168,67,.12)', tension: .4, fill: true, pointBackgroundColor: '#D4A843', pointRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font }, grid: { display: false } }, y: { min: 0, max: 5, ticks: { font, stepSize: 1 }, grid: { color: 'rgba(100,80,50,.06)' } } } } }))
      }
    }

    const buildMonth = () => {
      if (tab !== 'month') return
      // @ts-expect-error Chart is loaded via CDN
      const Chart = window.Chart
      if (!Chart) return
      
      if (monthRef.current) {
         monthChart = new Chart(monthRef.current, { type: 'bar', data: { labels: weekLabels, datasets: [{ label: 'Monthly Hours Aggregate Placeholder', data: actualData, borderColor: '#4A5FA0', backgroundColor: 'rgba(74,95,160,.6)', borderWidth: 1, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font, boxWidth: 9, boxHeight: 9, padding: 12 } } }, scales: { x: { ticks: { font }, grid: { display: false } }, y: { ticks: { font, callback: (v: number) => v+'h' }, grid: { color: 'rgba(100,80,50,.06)' }, beginAtZero: true } } } })
      }
    }

    // Load Chart.js once
    // @ts-expect-error Chart is loaded via CDN
    if (window.Chart) {
      buildWeek(); buildMonth()
    } else {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      s.onload = () => { buildWeek(); buildMonth() }
      document.head.appendChild(s)
    }

    return () => {
      weekCharts.forEach(c => c.destroy())
      if (monthChart) monthChart.destroy()
    }
  }, [tab, weekLabels, actualData, avgFocusData, subjectLabels, subjectData]) // Update when live data loads

  return { planVsActualRef, subjectEffRef, focusTimeRef, monthRef }
}
