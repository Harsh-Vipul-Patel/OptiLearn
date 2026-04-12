'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { TargetIcon } from '@/components/ui/AppIcons'

interface ExamGoalDisplay {
  exam_goal_id: string
  subject_id: string
  exam_name: string
  exam_date: string
  target_hours: number
  subject?: {
    subject_id: string
    subject_name: string
  }
}

interface Props {
  goals: ExamGoalDisplay[]
  /** Map of subject_id → total hours studied this month */
  studiedHoursMap: Record<string, number>
  subjects: { subject_id: string; subject_name: string }[]
  onAdd: (data: { subject_id: string; exam_name: string; exam_date: string; target_hours: number }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function getDaysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.max(0, Math.ceil(diff / 86400000))
}

function getReadinessColor(pct: number): string {
  if (pct >= 80) return 'var(--sage)'
  if (pct >= 50) return 'var(--gold)'
  return 'var(--terra)'
}

function getReadinessLabel(pct: number): string {
  if (pct >= 80) return 'On Track'
  if (pct >= 50) return 'Needs Work'
  return 'Behind'
}

export function ExamReadinessCard({ goals, studiedHoursMap, subjects, onAdd, onDelete }: Props) {
  const { showToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [formSubject, setFormSubject] = useState('')
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formHours, setFormHours] = useState('40')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!formSubject || !formDate || !formHours) {
      showToast('Fill in all fields', 'warning')
      return
    }
    setSubmitting(true)
    try {
      await onAdd({
        subject_id: formSubject,
        exam_name: formName || 'Exam',
        exam_date: formDate,
        target_hours: Number(formHours),
      })
      setShowForm(false)
      setFormName('')
      setFormDate('')
      setFormHours('40')
      showToast('Exam goal added!')
    } catch {
      showToast('Failed to add exam goal', 'warning')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TargetIcon width={18} height={18} />
          Exam Readiness
        </div>
        <button
          className="insight-btn insight-btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => setShowForm(prev => !prev)}
        >
          {showForm ? 'Cancel' : '+ Add Goal'}
        </button>
      </div>

      {showForm && (
        <div style={{
          padding: 14,
          background: 'var(--cream)',
          borderRadius: 'var(--r-sm)',
          marginBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <select
            className="form-select"
            value={formSubject}
            onChange={e => setFormSubject(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
          >
            <option value="">Select subject…</option>
            {subjects.map(s => (
              <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Exam name (e.g. Final Exam)"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
            />
            <input
              type="number"
              placeholder="Target hours"
              value={formHours}
              onChange={e => setFormHours(e.target.value)}
              min="1"
              style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
            />
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save Exam Goal'}
          </button>
        </div>
      )}

      {goals.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-soft)', fontSize: 13, padding: '24px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}></div>
          No exam goals yet. Add one to track your readiness!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {goals.map(goal => {
            const daysLeft = getDaysUntil(goal.exam_date)
            const hoursStudied = studiedHoursMap[goal.subject_id] || 0
            const readinessPct = Math.min(100, Math.round((hoursStudied / Math.max(1, goal.target_hours)) * 100))
            const color = getReadinessColor(readinessPct)
            const label = getReadinessLabel(readinessPct)

            return (
              <div
                key={goal.exam_goal_id}
                style={{
                  padding: '14px 16px',
                  background: 'var(--cream)',
                  borderRadius: 'var(--r-sm)',
                  borderLeft: `4px solid ${color}`,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginBottom: 2 }}>
                      {goal.exam_name || goal.subject?.subject_name || 'Exam'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                      {goal.subject?.subject_name} · {daysLeft === 0 ? 'Today!' : `${daysLeft} days left`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{readinessPct}%</div>
                    <div style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-soft)', marginBottom: 4 }}>
                    <span>{hoursStudied.toFixed(1)}h studied</span>
                    <span>{goal.target_hours}h target</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${readinessPct}%`,
                      borderRadius: 3,
                      background: color,
                      transition: 'width .6s cubic-bezier(.22,.68,0,1.1)',
                    }} />
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(goal.exam_goal_id) }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-soft)',
                    fontSize: 14,
                    opacity: 0.4,
                    padding: '2px 6px',
                  }}
                  title="Remove exam goal"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
