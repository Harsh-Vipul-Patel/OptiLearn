'use client'

import { useState } from 'react'
import { useSession } from '@/components/Providers'
import { useStudyLogSync } from '@/hooks/useStudyLogSync'
import { usePlans } from '@/hooks/usePlans'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DatePicker } from '@/components/ui/DatePicker'
import { BookIcon, FocusIcon, LaptopIcon, PhoneIcon, SparklesIcon, VolumeIcon } from '@/components/ui/AppIcons'
import { TimePicker } from '@/components/ui/TimePicker'
import { formatPlanScheduleLabel } from '@/lib/planTimeLabel'

const DISTRACTIONS = [
  { key: 'phone', label: 'Phone', icon: <PhoneIcon width={14} height={14} /> },
  { key: 'fatigue', label: 'Fatigue', icon: <FocusIcon width={14} height={14} /> },
  { key: 'boredom', label: 'Boredom', icon: <FocusIcon width={14} height={14} /> },
  { key: 'hard-material', label: 'Hard Material', icon: <BookIcon width={14} height={14} /> },
  { key: 'noise', label: 'Noise', icon: <VolumeIcon width={14} height={14} /> },
  { key: 'social-media', label: 'Social Media', icon: <LaptopIcon width={14} height={14} /> },
]

function formatLocalTime(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getAmPm(date: Date | null): 'AM' | 'PM' {
  if (!date || Number.isNaN(date.getTime())) return 'AM'
  return date.getHours() < 12 ? 'AM' : 'PM'
}

export function LoggerPage() {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const { logs, isLoading: logsLoading } = useStudyLogSync(session?.user?.id || '')
  const nowLocal = new Date()
  const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`
  const { plans: openPlans, isLoading: openPlansLoading, mutate: mutatePlans } = usePlans(today, false)
  const { plans: allTodayPlans, isLoading: allTodayPlansLoading } = usePlans(today, true)

  const plans = openPlans
  const plansLoading = openPlansLoading || allTodayPlansLoading
  const hasAnyPlanToday = allTodayPlans.length > 0
  const allSessionsFinishedToday = hasAnyPlanToday && openPlans.length === 0



  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [logDate, setLogDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [focusLevel, setFocusLevel] = useState(3)
  const [fatigueLevel, setFatigueLevel] = useState(3)
  const [distractions, setDistractions] = useState<string[]>([])
  const [reflection, setReflection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dayFilter, setDayFilter] = useState<'all' | 'today' | 'yesterday' | 'last7'>('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const isWithinDayFilter = (startTime: unknown) => {
    if (dayFilter === 'all') return true
    const date = new Date(String(startTime || ''))
    if (Number.isNaN(date.getTime())) return false

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    if (dayFilter === 'today') {
      return date >= startOfToday && date < startOfTomorrow
    }

    if (dayFilter === 'yesterday') {
      const startOfYesterday = new Date(startOfToday)
      startOfYesterday.setDate(startOfYesterday.getDate() - 1)
      return date >= startOfYesterday && date < startOfToday
    }

    const sevenDaysAgo = new Date(startOfToday)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    return date >= sevenDaysAgo && date < startOfTomorrow
  }

  const getSubjectName = (log: Record<string, unknown>) => String(
    (log as { dailyPlan?: { studyTopic?: { subject?: { subject_name?: string } } } }).dailyPlan?.studyTopic?.subject?.subject_name ||
    'Unknown subject'
  )

  const filteredLogs = logs.filter((log) => {
    if (!isWithinDayFilter(log.start_time)) return false
    const logSubject = getSubjectName(log)
    if (subjectFilter !== 'all' && logSubject !== subjectFilter) return false
    return true
  })

  const uniqueSubjects = Array.from(new Set(logs.map((log) => getSubjectName(log))))
  const planOptions = plans.map((plan) => ({
    value: plan.plan_id,
    label: `${plan.studyTopic?.subject?.subject_name ?? '?'} · ${plan.studyTopic?.topic_name ?? '?'} (${plan.target_duration} min @ ${formatPlanScheduleLabel(plan)})`,
  }))
  const dayFilterOptions = [
    { value: 'all', label: 'All Days' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7', label: 'Last 7 Days' },
  ]
  const subjectFilterOptions = [
    { value: 'all', label: 'All Subjects' },
    ...uniqueSubjects.map((subject) => ({ value: subject, label: subject })),
  ]

  const toggleDistraction = (d: string) => {
    setDistractions(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  /** Converts a date string (YYYY-MM-DD) + time string (HH:MM) → ISO DateTime string */
  const toISO = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString()
  const toLocalDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`)

  const handleSubmit = async () => {
    if (!selectedPlanId) {
      showToast('Please select a study plan to log against', 'warning')
      return
    }

    const now = new Date()
    const sessionStartTime = toLocalDateTime(logDate, startTime)
    const sessionEndTime = toLocalDateTime(logDate, endTime)

    if (Number.isNaN(sessionStartTime.getTime()) || Number.isNaN(sessionEndTime.getTime())) {
      showToast('Invalid date/time selected', 'warning')
      return
    }

    if (sessionStartTime >= sessionEndTime) {
      showToast('End time must be after start time', 'warning')
      return
    }

    // Validate: Session should not be in the future
    if (sessionStartTime > now) {
      showToast('Cannot log a session that starts in the future', 'warning')
      return
    }

    // Validate: Session end time should not be in the future
    if (sessionEndTime > now) {
      showToast('Session end time cannot be in the future', 'warning')
      return
    }

    // Validate: No overlap with existing logged sessions.
    const hasOverlap = logs.some((log) => {
      const existingStart = new Date(String(log.start_time || ''))
      const existingEnd = new Date(String(log.end_time || ''))
      if (Number.isNaN(existingStart.getTime()) || Number.isNaN(existingEnd.getTime())) return false
      return sessionStartTime < existingEnd && existingStart < sessionEndTime
    })

    if (hasOverlap) {
      showToast('This session overlaps with an already logged session', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id:    selectedPlanId,
          start_time: toISO(logDate, startTime),
          end_time:   toISO(logDate, endTime),
          focus_level: focusLevel,
          fatigue_level: fatigueLevel,
          distractions: distractions.join(', '),
          reflection,
        }),
      })
      if (res.ok) {
        showToast('Session logged — AI is processing your data…')
        setReflection('')
        setDistractions([])
        setSelectedPlanId('')
        await mutatePlans()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to save session', 'warning')
      }
    } catch {
      showToast('Network error', 'warning')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-title">Log Study Session</div>
      <div className="page-sub">Honest data → better AI insights. Takes under 2 minutes.</div>
      <div className="grid-2 logger-layout-grid">
        {/* Form */}
        <div className="card">
          <div className="section-title">Session Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* Plan selector */}
            <div className="form-group">
              <label className="form-label">Study Plan</label>
              {plansLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Loading plans…</div>
              ) : !hasAnyPlanToday ? (
                <div style={{ fontSize: 13, color: 'var(--terra)' }}>
                  No plans for today. <a href="/dashboard/planner" style={{ color: 'var(--terra)', fontWeight: 600 }}>Create one →</a>
                </div>
              ) : allSessionsFinishedToday ? (
                <div style={{ fontSize: 13, color: 'var(--sage)' }}>
                  All sessions finished for today. <a href="/dashboard/planner" style={{ color: 'var(--sage)', fontWeight: 600 }}>Add another plan →</a>
                </div>
              ) : (
                <CustomSelect
                  value={selectedPlanId}
                  onChange={setSelectedPlanId}
                  options={planOptions}
                  placeholder="— Select a plan —"
                  ariaLabel="Select study plan"
                />
              )}
            </div>

            <div className="logger-time-grid" style={{ display: 'grid', gap: 13 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <DatePicker value={logDate} onChange={setLogDate} ariaLabel="Select log date" />
              </div>
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <TimePicker value={startTime} onChange={setStartTime} ariaLabel="Select session start time" minuteStep={1} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <TimePicker value={endTime} onChange={setEndTime} ariaLabel="Select session end time" minuteStep={1} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Focus Level: <span style={{ color: 'var(--terra)', fontWeight: 700 }}>{focusLevel} / 5</span></label>
              <div style={{ position: 'relative', paddingBottom: '24px' }}>
                <input className="form-range" type="range" min="1" max="5" step="1" value={focusLevel} onChange={e => setFocusLevel(Number(e.target.value))} />
                <div className="range-labels" style={{ position: 'absolute', bottom: '0', left: '0', right: '0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-soft)', fontWeight: '500', userSelect: 'none', paddingLeft: '2px', paddingRight: '2px' }}><span>Distracted</span><span>Moderate</span><span>Laser-focused</span></div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fatigue Level: <span style={{ color: 'var(--terra)', fontWeight: 700 }}>{fatigueLevel} / 5</span></label>
              <div style={{ position: 'relative', paddingBottom: '24px' }}>
                <input className="form-range" type="range" min="1" max="5" step="1" value={fatigueLevel} onChange={e => setFatigueLevel(Number(e.target.value))} />
                <div className="range-labels" style={{ position: 'absolute', bottom: '0', left: '0', right: '0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-soft)', fontWeight: '500', userSelect: 'none', paddingLeft: '2px', paddingRight: '2px' }}><span>Energized</span><span>Okay</span><span>Exhausted</span></div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Distractions</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                {DISTRACTIONS.map(d => (
                  <span
                    key={d.key}
                    className={`d-chip${distractions.includes(d.label) ? ' active' : ''}`}
                    onClick={() => toggleDistraction(d.label)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {d.icon}
                    {d.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reflection Notes (optional)</label>
              <textarea className="form-textarea" value={reflection} onChange={e => setReflection(e.target.value)} placeholder="What went well? What was hard? Any patterns you noticed…" />
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSubmit}
              disabled={submitting || !selectedPlanId}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {submitting ? 'Saving…' : 'Submit Session Log'}
            </button>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="card">
          <div className="section-title">Recent Sessions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <CustomSelect
              value={dayFilter}
              onChange={(value) => setDayFilter(value as 'all' | 'today' | 'yesterday' | 'last7')}
              options={dayFilterOptions}
              ariaLabel="Filter recent sessions by day"
            />
            <CustomSelect
              value={subjectFilter}
              onChange={setSubjectFilter}
              options={subjectFilterOptions}
              ariaLabel="Filter recent sessions by subject"
            />
          </div>
          {logsLoading ? (
            <div style={{ color: 'var(--text-soft)', fontSize: 13, padding: '12px 0' }}>Loading sessions…</div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ color: 'var(--text-soft)', fontSize: 13, fontStyle: 'italic', padding: '12px 0' }}>No sessions match current filters.</div>
          ) : (
            filteredLogs.slice(0, 12).map((log, i) => {
              const startedAt = log.start_time ? new Date(String(log.start_time)) : null
              const start = formatLocalTime(startedAt)
              const sessionDate = startedAt && !Number.isNaN(startedAt.getTime())
                ? startedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Unknown date'
              const subjectName = getSubjectName(log)
              const endedAt = log.end_time ? new Date(String(log.end_time)) : null
              const end = formatLocalTime(endedAt)
              const durationMin = startedAt && endedAt && !Number.isNaN(startedAt.getTime()) && !Number.isNaN(endedAt.getTime())
                ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))
                : null
              const distractionsList = String(log.distractions || '')
                .split(',')
                .map(x => x.trim())
                .filter(Boolean)
              const effBadge = Number(log.focus_level) >= 4 ? 'sage' : Number(log.focus_level) >= 3 ? 'indigo' : 'terra'
              const analyzed = log.quality_score != null
              const logId = String(log.log_id || i)
              const isExpanded = expandedLogId === logId
              return (
                <div
                  key={i}
                  className="log-item"
                  onClick={() => setExpandedLogId(prev => (prev === logId ? null : logId))}
                  style={{ cursor: 'pointer', display: 'block' }}
                >
                  <div className="logger-time-col" style={{ minWidth: 50, textAlign: 'center' }}>
                    <div className="log-time">{start.slice(0, 2)}</div>
                    <div className="log-ampm">{getAmPm(startedAt)}</div>
                  </div>
                  <div className="logger-content-col" style={{ flex: 1 }}>
                    <div className="log-title">{String(log.reflection || '—').slice(0, 60) || 'Study session'}</div>
                    <div className="log-detail">
                      {subjectName} · {sessionDate}
                    </div>
                    <div className="log-detail">
                      Focus: {Number(log.focus_level)}/5
                      {analyzed && <span style={{ marginLeft: 8, color: 'var(--sage)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><SparklesIcon width={16} height={16} />AI: {Number(log.quality_score).toFixed(0)}%</span>}
                    </div>
                    <div className="focus-dots">
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} className={`focus-dot ${n <= Number(log.focus_level) ? 'focus-filled' : 'focus-empty'}`} />
                      ))}
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <div className="log-detail">Date: {sessionDate}</div>
                        <div className="log-detail">Subject: {subjectName}</div>
                        <div className="log-detail">Start: {start || '--:--'} · End: {end || '--:--'}</div>
                        <div className="log-detail">Duration: {durationMin != null ? `${durationMin} min` : 'Unknown'}</div>
                        <div className="log-detail">Focus: {Number(log.focus_level)}/5 · Fatigue: {Number(log.fatigue_level) || 0}/5</div>
                        <div className="log-detail">Distractions: {distractionsList.length ? distractionsList.join(', ') : 'None'}</div>
                        <div className="log-detail">Reflection: {String(log.reflection || 'No reflection added.')}</div>
                        {analyzed && <div className="log-detail">AI Quality Score: {Number(log.quality_score).toFixed(0)}%</div>}
                      </div>
                    )}
                  </div>
                  <Badge variant={effBadge as 'sage' | 'indigo' | 'terra'}>{Number(log.focus_level) * 20}%</Badge>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
