'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { ProgressBar } from '@/components/ui/ProgressBar'

interface SubjectProgress {
  name: string
  icon?: ReactNode
  color: string
  hours: string
  pct: number
}

interface GoalRingCardProps {
  hoursStudied: number
  goalHours: number
  subjects: SubjectProgress[]
  readinessScore?: number | null
  readinessLabel?: string
  readinessColor?: string
}

export function GoalRingCard({
  hoursStudied,
  goalHours,
  subjects,
  readinessScore,
  readinessLabel,
  readinessColor,
}: GoalRingCardProps) {
  const ringRef = useRef<SVGCircleElement>(null)
  const pct = Math.min(hoursStudied / goalHours, 1)
  const circ = 2 * Math.PI * 64

  useEffect(() => {
    const el = ringRef.current
    if (!el) return
    el.style.strokeDasharray = String(circ)
    el.style.strokeDashoffset = String(circ)
    const t = setTimeout(() => {
      el.style.strokeDashoffset = String(circ * (1 - pct))
    }, 250)
    return () => clearTimeout(t)
  }, [pct, circ])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '22px 18px' }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-soft)', letterSpacing: '.6px' }}>TODAY&apos;S GOAL</div>
        {typeof readinessScore === 'number' && readinessLabel ? (
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: readinessColor || 'var(--text-main)',
              background: `${readinessColor || '#4A5FA0'}14`,
              border: `1px solid ${readinessColor || '#4A5FA0'}35`,
              borderRadius: 999,
              padding: '4px 8px',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            aria-label={`Readiness score ${readinessScore}`}
            title={`Readiness ${readinessScore} (${readinessLabel})`}
          >
            <span>Readiness {readinessScore}</span>
          </div>
        ) : null}
      </div>
      <div className="ring-wrap">
        <svg className="ring-svg" viewBox="0 0 156 156">
          <circle className="ring-track" cx="78" cy="78" r="64" />
          <circle
            ref={ringRef}
            className="ring-fill"
            cx="78" cy="78" r="64"
            stroke="url(#rg)"
          />
          <defs>
            <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#C96B3A" />
              <stop offset="50%"  stopColor="#D4A843" />
              <stop offset="100%" stopColor="#6B9B7A" />
            </linearGradient>
          </defs>
        </svg>
        <div className="ring-center">
          <div className="ring-value">{hoursStudied}h</div>
          <div className="ring-target">of <strong>{goalHours}h</strong> goal</div>
          <div className="ring-pct">{Math.round(pct * 100)}%</div>
        </div>
      </div>
      <div style={{ width: '100%' }}>
        {subjects.map((s) => (
          <div key={s.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3, marginTop: 7 }}>
              <span style={{ color: s.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {s.icon ? <span style={{ display: 'inline-flex' }}>{s.icon}</span> : null}
                {s.name}
              </span>
              <span style={{ color: 'var(--text-soft)' }}>{s.hours}</span>
            </div>
            <ProgressBar value={s.pct} color={s.color} />
          </div>
        ))}
      </div>
    </div>
  )
}
