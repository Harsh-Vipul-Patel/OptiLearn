'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertIcon,
  CheckCircleIcon,
  FlameIcon,
  FocusIcon,
  LaptopIcon,
  MoonIcon,
  PhoneIcon,
  SparklesIcon,
  StarIcon,
  TimerIcon,
} from '@/components/ui/AppIcons'

type CheckinFormData = {
  sleep_hours: number
  sleep_quality: number
  energy_level: number
  stress_level: number
  mood: string
  exercised_today: boolean
  had_meal: boolean
  screen_time_last_night: string
  notes: string
}

const STEPS = ['sleep', 'readiness', 'lifestyle', 'done'] as const
type Step = typeof STEPS[number]

const MOOD_OPTIONS = [
  { value: 'Great', label: 'Great', level: 5 },
  { value: 'Good', label: 'Good', level: 4 },
  { value: 'Okay', label: 'Okay', level: 3 },
  { value: 'Low', label: 'Low', level: 2 },
  { value: 'Bad', label: 'Bad', level: 1 },
] as const

const SCREEN_TIME_OPTIONS = [
  { value: 'Low', label: '< 1 hour' },
  { value: 'Moderate', label: '1-3 hours' },
  { value: 'High', label: '3+ hours' },
] as const

function MoodFaceIcon({ level, size = 22 }: { level: number; size?: number }) {
  const mouthPath =
    level >= 4
      ? 'M8 15c1.2 1.3 2.4 2 4 2s2.8-.7 4-2'
      : level === 3
        ? 'M8.5 15h7'
        : 'M8 17c1.2-1.3 2.4-2 4-2s2.8.7 4 2'

  const eyes =
    level <= 2
      ? <path d="M8.4 10h1.2M14.4 10h1.2" />
      : <><circle cx="9" cy="10" r="0.9" /><circle cx="15" cy="10" r="0.9" /></>

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      {eyes}
      <path d={mouthPath} />
    </svg>
  )
}

function sleepIconFor(val: number) {
  if (val <= 1) return <MoonIcon width={20} height={20} />
  if (val === 2) return <AlertIcon width={20} height={20} />
  if (val === 3) return <TimerIcon width={20} height={20} />
  if (val === 4) return <SparklesIcon width={20} height={20} />
  return <StarIcon width={20} height={20} />
}

function energyIconFor(val: number) {
  if (val <= 1) return <MoonIcon width={20} height={20} />
  if (val === 2) return <FocusIcon width={20} height={20} />
  if (val === 3) return <TimerIcon width={20} height={20} />
  if (val === 4) return <FlameIcon width={20} height={20} />
  return <SparklesIcon width={20} height={20} />
}

function stressIconFor(val: number) {
  if (val <= 1) return <CheckCircleIcon width={20} height={20} />
  if (val === 2) return <FocusIcon width={20} height={20} />
  if (val === 3) return <AlertIcon width={20} height={20} />
  if (val === 4) return <FlameIcon width={20} height={20} />
  return <AlertIcon width={20} height={20} />
}

function screenIconFor(value: 'Low' | 'Moderate' | 'High') {
  if (value === 'Low') return <MoonIcon width={18} height={18} />
  if (value === 'Moderate') return <PhoneIcon width={18} height={18} />
  return <LaptopIcon width={18} height={18} />
}

function computeReadinessScore(data: CheckinFormData): number {
  const sleepHoursNorm = Math.min(data.sleep_hours / 8, 1)
  const sleepQualityNorm = (data.sleep_quality - 1) / 4
  const energyNorm = (data.energy_level - 1) / 4
  const stressNorm = (data.stress_level - 1) / 4
  const exerciseBoost = data.exercised_today ? 0.08 : 0
  const mealBoost = data.had_meal ? 0.05 : 0
  const screenPenalty = data.screen_time_last_night === 'High' ? 0.06 : data.screen_time_last_night === 'Moderate' ? 0.02 : 0

  const raw =
    0.25 * sleepQualityNorm +
    0.20 * sleepHoursNorm +
    0.20 * energyNorm +
    0.15 * (1 - stressNorm) +
    exerciseBoost +
    mealBoost -
    screenPenalty

  return Math.min(100, Math.max(0, Math.round(raw * 100)))
}

function getReadinessLabel(score: number): { label: string; color: string; message: string } {
  if (score >= 75) return { label: 'Excellent', color: 'var(--sage)', message: 'You\'re in great shape today! Tackle your toughest topics with confidence.' }
  if (score >= 55) return { label: 'Good', color: 'var(--indigo)', message: 'Solid foundation today. A balanced mix of challenge and review will work well.' }
  if (score >= 35) return { label: 'Moderate', color: 'var(--gold)', message: 'Take it easy today. Shorter sessions with more breaks will keep you productive.' }
  return { label: 'Recovery', color: 'var(--terra)', message: 'Today\'s a rest & recharge day. Light review and self-care will set you up for tomorrow.' }
}

export function DailyCheckinModal({
  onComplete,
  onSkip,
}: {
  onComplete: (data: CheckinFormData) => void
  onSkip: () => void
}) {
  const [step, setStep] = useState<Step>('sleep')
  const [form, setForm] = useState<CheckinFormData>({
    sleep_hours: 7,
    sleep_quality: 3,
    energy_level: 3,
    stress_level: 2,
    mood: 'Okay',
    exercised_today: false,
    had_meal: false,
    screen_time_last_night: 'Moderate',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const stepIndex = STEPS.indexOf(step)
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  const goNext = () => {
    const nextIdx = stepIndex + 1
    if (nextIdx < STEPS.length) {
      setStep(STEPS[nextIdx])
    }
  }

  const goBack = () => {
    const prevIdx = stepIndex - 1
    if (prevIdx >= 0) {
      setStep(STEPS[prevIdx])
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onComplete(form)
      }
    } catch (e) {
      console.error('[DailyCheckinModal] submit error:', e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const readiness = computeReadinessScore(form)
  const readinessInfo = getReadinessLabel(readiness)

  return createPortal(
    <div className="checkin-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSkip() }}>
      <div className="checkin-modal">
        {/* Header */}
        <div className="checkin-header">
          <div className="checkin-header-content">
            <span className="checkin-header-icon"><SparklesIcon width={24} height={24} /></span>
            <div>
              <div className="checkin-header-title">
                Good Morning!
              </div>
              <div className="checkin-header-sub">
                Quick check-in to personalise your study plan today
              </div>
            </div>
          </div>
          <button className="checkin-skip" onClick={onSkip} title="Skip for now">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="checkin-progress-bar">
          <div className="checkin-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-soft)', marginBottom: 16, padding: '0 2px' }}>
          <span style={{ fontWeight: step === 'sleep' ? 700 : 400, color: step === 'sleep' ? 'var(--terra)' : undefined }}>Sleep</span>
          <span style={{ fontWeight: step === 'readiness' ? 700 : 400, color: step === 'readiness' ? 'var(--terra)' : undefined }}>Readiness</span>
          <span style={{ fontWeight: step === 'lifestyle' ? 700 : 400, color: step === 'lifestyle' ? 'var(--terra)' : undefined }}>Lifestyle</span>
          <span style={{ fontWeight: step === 'done' ? 700 : 400, color: step === 'done' ? 'var(--terra)' : undefined }}>Done</span>
        </div>

        {/* Steps */}
        <div className="checkin-step-container">
          {step === 'sleep' && (
            <div className="checkin-step">
              <div className="checkin-question">How did you sleep last night?</div>

              <div className="checkin-field">
                <label className="checkin-label">Hours of sleep</label>
                <div className="checkin-slider-row">
                  <input
                    type="range"
                    min="0"
                    max="14"
                    step="0.5"
                    value={form.sleep_hours}
                    onChange={(e) => setForm({ ...form, sleep_hours: Number(e.target.value) })}
                    className="checkin-slider"
                  />
                  <span className="checkin-slider-value">{form.sleep_hours}h</span>
                </div>
              </div>

              <div className="checkin-field">
                <label className="checkin-label">Sleep quality</label>
                <div className="checkin-rating-row">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      className={`checkin-rating-btn ${form.sleep_quality === val ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, sleep_quality: val })}
                    >
                      <span className="checkin-rating-icon">{sleepIconFor(val)}</span>
                      <span className="checkin-rating-label">
                        {val === 1 ? 'Terrible' : val === 2 ? 'Poor' : val === 3 ? 'Fair' : val === 4 ? 'Good' : 'Great'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'readiness' && (
            <div className="checkin-step">
              <div className="checkin-question">How are you feeling right now?</div>

              <div className="checkin-field">
                <label className="checkin-label">Energy level</label>
                <div className="checkin-rating-row">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      className={`checkin-rating-btn ${form.energy_level === val ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, energy_level: val })}
                    >
                      <span className="checkin-rating-icon">{energyIconFor(val)}</span>
                      <span className="checkin-rating-label">
                        {val === 1 ? 'Drained' : val === 2 ? 'Low' : val === 3 ? 'Okay' : val === 4 ? 'Good' : 'Charged'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="checkin-field">
                <label className="checkin-label">Stress level</label>
                <div className="checkin-rating-row">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      className={`checkin-rating-btn ${form.stress_level === val ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, stress_level: val })}
                    >
                      <span className="checkin-rating-icon">{stressIconFor(val)}</span>
                      <span className="checkin-rating-label">
                        {val === 1 ? 'Calm' : val === 2 ? 'Mild' : val === 3 ? 'Some' : val === 4 ? 'High' : 'Extreme'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="checkin-field">
                <label className="checkin-label">Overall mood</label>
                <div className="checkin-mood-row">
                  {MOOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`checkin-mood-btn ${form.mood === opt.value ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, mood: opt.value })}
                    >
                      <span className="checkin-mood-icon"><MoodFaceIcon level={opt.level} size={22} /></span>
                      <span style={{ fontSize: 10.5 }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'lifestyle' && (
            <div className="checkin-step">
              <div className="checkin-question">A few more things…</div>

              <div className="checkin-toggle-group">
                <button
                  className={`checkin-toggle-btn ${form.exercised_today ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, exercised_today: !form.exercised_today })}
                >
                  <span className="checkin-toggle-icon"><FlameIcon width={18} height={18} /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {form.exercised_today ? 'Yes, I exercised!' : 'Did you exercise today?'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>Even a short walk counts</div>
                  </div>
                  <div className={`checkin-toggle-indicator ${form.exercised_today ? 'on' : ''}`}>
                    <div className="checkin-toggle-thumb" />
                  </div>
                </button>

                <button
                  className={`checkin-toggle-btn ${form.had_meal ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, had_meal: !form.had_meal })}
                >
                  <span className="checkin-toggle-icon"><StarIcon width={18} height={18} /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {form.had_meal ? 'Yes, I ate!' : 'Had breakfast/meal?'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>Fuel for your brain</div>
                  </div>
                  <div className={`checkin-toggle-indicator ${form.had_meal ? 'on' : ''}`}>
                    <div className="checkin-toggle-thumb" />
                  </div>
                </button>
              </div>

              <div className="checkin-field">
                <label className="checkin-label">Screen time before bed last night</label>
                <div className="checkin-screen-row">
                  {SCREEN_TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`checkin-screen-btn ${form.screen_time_last_night === opt.value ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, screen_time_last_night: opt.value })}
                    >
                      <span className="checkin-screen-icon">{screenIconFor(opt.value)}</span>
                      <span style={{ fontWeight: 600, fontSize: 12.5 }}>{opt.value}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="checkin-field">
                <label className="checkin-label">Anything else on your mind? <span style={{ fontWeight: 400, color: 'var(--text-soft)' }}>(optional)</span></label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g., exam tomorrow, feeling anxious about physics…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ resize: 'none', fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="checkin-step" style={{ textAlign: 'center' }}>
              <div className="checkin-readiness-ring">
                <svg viewBox="0 0 120 120" width="120" height="120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--cream2)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    stroke={readinessInfo.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(readiness / 100) * 327} 327`}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dasharray 1s ease' }}
                  />
                </svg>
                <div className="checkin-readiness-value">{readiness}</div>
                <div className="checkin-readiness-label">Readiness</div>
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 14, color: readinessInfo.color }}>
                {readinessInfo.label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 6, lineHeight: 1.6, maxWidth: 320, margin: '6px auto 0' }}>
                {readinessInfo.message}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="checkin-footer">
          {step !== 'sleep' && step !== 'done' && (
            <button className="btn-secondary btn-sm" onClick={goBack}>← Back</button>
          )}
          {step === 'sleep' && (
            <button className="checkin-skip-text" onClick={onSkip}>Skip for now</button>
          )}
          <div style={{ flex: 1 }} />
          {step !== 'done' && (
            <button className="btn-primary btn-sm" onClick={goNext}>
              Next →
            </button>
          )}
          {step === 'done' && (
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isSubmitting ? 'Saving…' : '✨ Start My Day'}
            </button>
          )}
        </div>

        {/* Encourage filling */}
        {step === 'sleep' && (
          <div className="checkin-footer-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Filling this helps us give you better, personalised study insights!
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/**
 * Small inline readiness card shown on the dashboard after check-in.
 */
export function ReadinessCard({ checkin }: { checkin: { sleep_hours: number; sleep_quality: number; energy_level: number; stress_level: number; mood: string; exercised_today: boolean; had_meal: boolean; screen_time_last_night: string } }) {
  const score = computeReadinessScore({
    ...checkin,
    notes: '',
  })
  const info = getReadinessLabel(score)

  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="stat-icon" style={{ background: `linear-gradient(160deg, ${info.color}18 0%, ${info.color}08 100%)`, borderColor: `${info.color}30` }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" width="20" height="20">
          <path d="M12 3a9 9 0 110 18 9 9 0 010-18z" />
          <path d="M12 7v5l3 3" />
        </svg>
      </div>
      <div className="stat-value" style={{ color: info.color }}>{score}</div>
      <div className="stat-label">Readiness Score</div>
      <div className="stat-delta" style={{ color: info.color }}>{info.label}</div>
    </div>
  )
}
