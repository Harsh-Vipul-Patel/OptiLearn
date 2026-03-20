'use client'

import { useState } from 'react'
import { useSession, signOut } from '@/components/Providers'
import { useStudyLogSync } from '@/hooks/useStudyLogSync'
import { usePlans } from '@/hooks/usePlans'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'

const DISTRACTIONS = ['📱 Phone', '😴 Fatigue', '😐 Boredom', '📖 Hard Material', '🔊 Noise', '💻 Social Media']

export function LoggerPage() {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const { logs, isLoading: logsLoading } = useStudyLogSync(session?.user?.id || '')
  const { plans, isLoading: plansLoading } = usePlans()

  const today = new Date().toISOString().slice(0, 10)

  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [logDate, setLogDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [focusLevel, setFocusLevel] = useState(3)
  const [distractions, setDistractions] = useState<string[]>([])
  const [reflection, setReflection] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleDistraction = (d: string) => {
    setDistractions(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  /** Converts a date string (YYYY-MM-DD) + time string (HH:MM) → ISO DateTime string */
  const toISO = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString()

  const handleSubmit = async () => {
    if (!selectedPlanId) {
      showToast('Please select a study plan to log against', '⚠️')
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
          distractions: distractions.join(', '),
          reflection,
        }),
      })
      if (res.ok) {
        showToast('Session logged — AI is processing your data…')
        setReflection('')
        setDistractions([])
        setSelectedPlanId('')
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to save session', '⚠️')
      }
    } catch {
      showToast('Network error', '⚠️')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-title">Log Study Session</div>
      <div className="page-sub">Honest data → better AI insights. Takes under 2 minutes.</div>
      <div className="grid-2">
        {/* Form */}
        <div className="card">
          <div className="section-title">Session Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* Plan selector */}
            <div className="form-group">
              <label className="form-label">Study Plan</label>
              {plansLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Loading plans…</div>
              ) : plans.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--terra)' }}>
                  No plans for today. <a href="/dashboard/planner" style={{ color: 'var(--terra)', fontWeight: 600 }}>Create one →</a>
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                >
                  <option value="">— Select a plan —</option>
                  {plans.map(p => (
                    <option key={p.plan_id} value={p.plan_id}>
                      {p.studyTopic?.subject?.subject_name ?? '?'} · {p.studyTopic?.topic_name ?? '?'} ({p.target_duration} min{p.time_slot ? ` @ ${p.time_slot}` : ''})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 13 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input className="form-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input className="form-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Focus Level: <span style={{ color: 'var(--terra)', fontWeight: 700 }}>{focusLevel} / 5</span></label>
              <input className="form-range" type="range" min="1" max="5" step="1" value={focusLevel} onChange={e => setFocusLevel(Number(e.target.value))} />
              <div className="range-labels"><span>Distracted</span><span>Moderate</span><span>Laser-focused</span></div>
            </div>

            <div className="form-group">
              <label className="form-label">Distractions</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                {DISTRACTIONS.map(d => (
                  <span
                    key={d}
                    className={`d-chip${distractions.includes(d) ? ' active' : ''}`}
                    onClick={() => toggleDistraction(d)}
                  >
                    {d}
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
          {logsLoading ? (
            <div style={{ color: 'var(--text-soft)', fontSize: 13, padding: '12px 0' }}>Loading sessions…</div>
          ) : logs.length === 0 ? (
            <div style={{ color: 'var(--text-soft)', fontSize: 13, fontStyle: 'italic', padding: '12px 0' }}>No sessions logged yet.</div>
          ) : (
            logs.slice(0, 6).map((log, i) => {
              const start = String(log.start_time || '').slice(11, 16)
              const effBadge = Number(log.focus_level) >= 4 ? 'sage' : Number(log.focus_level) >= 3 ? 'indigo' : 'terra'
              const analyzed = log.quality_score != null
              return (
                <div key={i} className="log-item">
                  <div style={{ minWidth: 50, textAlign: 'center' }}>
                    <div className="log-time">{start.slice(0, 2)}</div>
                    <div className="log-ampm">{Number(start.slice(0, 2)) < 12 ? 'AM' : 'PM'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="log-title">{String(log.reflection || '—').slice(0, 60) || 'Study session'}</div>
                    <div className="log-detail">
                      Focus: {Number(log.focus_level)}/5
                      {analyzed && <span style={{ marginLeft: 8, color: 'var(--sage)' }}>✦ AI: {Number(log.quality_score).toFixed(0)}%</span>}
                    </div>
                    <div className="focus-dots">
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} className={`focus-dot ${n <= Number(log.focus_level) ? 'focus-filled' : 'focus-empty'}`} />
                      ))}
                    </div>
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
