'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'

export interface PlanSuggestion {
  subject_hint: string
  time_slot: string
  duration_minutes: number
  reason: string
}

interface SubjectTopic {
  topic_id: string
  topic_name: string
  subject_name: string
}

interface PlanSuggestionModalProps {
  suggestion: PlanSuggestion
  insightTitle: string
  topics: SubjectTopic[]
  onClose: () => void
  onAdded: () => void
}

// Helper: get tomorrow's ISO date string
function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Helper: format a date string nicely
function formatDisplayDate(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night']
const DURATIONS = [30, 45, 60, 90, 120]

export function PlanSuggestionModal({
  suggestion,
  insightTitle,
  topics,
  onClose,
  onAdded,
}: PlanSuggestionModalProps) {
  const { showToast } = useToast()

  // Editable state — pre-filled from AI suggestion, user can override
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    topics[0]?.topic_id ?? ''
  )
  const [selectedSlot, setSelectedSlot] = useState<string>(
    TIME_SLOTS.includes(suggestion.time_slot) ? suggestion.time_slot : 'Morning'
  )
  const [selectedDuration, setSelectedDuration] = useState<number>(
    DURATIONS.includes(suggestion.duration_minutes)
      ? suggestion.duration_minutes
      : 60
  )
  const [planDate, setPlanDate] = useState<string>(getTomorrow())
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!selectedTopicId) {
      showToast('Please select a topic.', 'error')
      return
    }

    try {
      setIsAdding(true)
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopicId,
          target_duration: selectedDuration,
          time_slot: selectedSlot,
          plan_date: planDate,
          goal_type: 'AI_Suggested',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Could not add plan')
      }

      showToast(
        `Added ${selectedDuration} min ${selectedSlot} session to ${formatDisplayDate(planDate)}!`,
        'info'
      )
      onAdded()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showToast(msg, 'error')
    } finally {
      setIsAdding(false)
    }
  }

  // Find subject hint match in topics list for smarter default
  const hintLower = suggestion.subject_hint.toLowerCase()
  const hintMatch = topics.find(
    (t) =>
      t.subject_name.toLowerCase().includes(hintLower) ||
      t.topic_name.toLowerCase().includes(hintLower)
  )
  // Set smart default once on mount
  useState(() => {
    if (hintMatch && !selectedTopicId) {
      setSelectedTopicId(hintMatch.topic_id)
    }
  })

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          animation: 'fadeIn .18s ease both',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: '26px 28px',
            width: '100%',
            maxWidth: 440,
            boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
            animation: 'slideUp .22s cubic-bezier(.22,.68,0,1.1) both',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--indigo)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                AI Plan Suggestion
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.35 }}>
                {insightTitle}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-soft)', fontSize: 20, padding: '2px 6px', lineHeight: 1 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* AI reason */}
          {suggestion.reason && (
            <div style={{
              background: 'rgba(74,95,160,0.07)',
              border: '1px solid rgba(74,95,160,0.18)',
              borderRadius: 'var(--r-sm)',
              padding: '9px 12px',
              fontSize: '12.5px',
              color: 'var(--text-mid)',
              marginBottom: 18,
              lineHeight: 1.55,
            }}>
              {suggestion.reason}
            </div>
          )}

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Topic */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Topic
              </label>
              {topics.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-soft)' }}>No topics found. Create one in the Planner first.</div>
              ) : (
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    borderRadius: 'var(--r-sm)',
                    border: '1.5px solid var(--border)',
                    background: 'var(--cream)',
                    color: 'var(--text-dark)',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {topics.map((t) => (
                    <option key={t.topic_id} value={t.topic_id}>
                      {t.subject_name} — {t.topic_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Date
              </label>
              <input
                type="date"
                value={planDate}
                min={getTomorrow()}
                onChange={(e) => setPlanDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  borderRadius: 'var(--r-sm)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--cream)',
                  color: 'var(--text-dark)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '10.5px', color: 'var(--text-soft)', marginTop: 3 }}>
                AI suggested: tomorrow ({formatDisplayDate(getTomorrow())})
              </div>
            </div>

            {/* Time Slot + Duration in a row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Time Slot
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 20,
                        border: '1.5px solid',
                        borderColor: selectedSlot === slot ? 'var(--indigo)' : 'var(--border)',
                        background: selectedSlot === slot ? 'rgba(74,95,160,0.12)' : 'transparent',
                        color: selectedSlot === slot ? 'var(--indigo)' : 'var(--text-soft)',
                        fontSize: '11.5px',
                        fontWeight: selectedSlot === slot ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Duration
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDuration(d)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 20,
                        border: '1.5px solid',
                        borderColor: selectedDuration === d ? 'var(--indigo)' : 'var(--border)',
                        background: selectedDuration === d ? 'rgba(74,95,160,0.12)' : 'transparent',
                        color: selectedDuration === d ? 'var(--indigo)' : 'var(--text-soft)',
                        fontSize: '11.5px',
                        fontWeight: selectedDuration === d ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding || topics.length === 0}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: 'var(--indigo)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: isAdding || topics.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isAdding || topics.length === 0 ? 0.7 : 1,
                transition: 'opacity .15s',
              }}
            >
              {isAdding ? 'Adding…' : '+ Add to Plan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '11px 20px',
                borderRadius: 'var(--r-sm)',
                border: '1.5px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-soft)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
