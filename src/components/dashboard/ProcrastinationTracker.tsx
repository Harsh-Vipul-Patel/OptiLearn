'use client'

import Link from 'next/link'
import type { SkippedPlan } from '@/hooks/useProcrastination'

interface ProcrastinationTrackerProps {
  skipped: SkippedPlan[]
  score: number
  risk: 'Low' | 'Medium' | 'High'
  viewReady: boolean
  isLoading: boolean
}

const RISK_CONFIG = {
  Low:    { color: 'var(--sage)',   bg: 'rgba(107,155,122,0.12)', label: 'Low Risk',    textColor: '#3d7a52' },
  Medium: { color: 'var(--gold)',   bg: 'rgba(212,168,67,0.12)',  label: 'Moderate',   textColor: '#8a6800' },
  High:   { color: 'var(--terra)',  bg: 'rgba(201,107,58,0.12)',  label: 'High Risk',   textColor: '#c04f20' },
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function ProcrastinationTracker({
  skipped,
  score,
  risk,
  viewReady,
  isLoading,
}: ProcrastinationTrackerProps) {
  const cfg = RISK_CONFIG[risk]

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Procrastination Tracker
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 20,
            background: cfg.bg,
            color: cfg.textColor,
            border: `1px solid ${cfg.color}40`,
            letterSpacing: '0.02em',
          }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-soft)', fontWeight: 500 }}>
            Procrastination Score
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: cfg.textColor }}>{score}%</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 6,
            background: 'var(--border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${score}%`,
              borderRadius: 6,
              background: score >= 60
                ? 'linear-gradient(90deg, var(--gold), var(--terra))'
                : score >= 30
                  ? 'linear-gradient(90deg, var(--sage), var(--gold))'
                  : 'var(--sage)',
              transition: 'width 0.6s cubic-bezier(.22,.68,0,1.2)',
            }}
          />
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--text-soft)', marginTop: 3 }}>
          {skipped.length} skipped / abandoned {skipped.length === 1 ? 'session' : 'sessions'} detected
        </div>
      </div>

      {/* Skipped plan list */}
      {!viewReady && !isLoading && (
        <div style={{ padding: '10px 0', fontSize: '12px', color: 'var(--text-soft)', textAlign: 'center' }}>
          Run the DB migration to enable procrastination detection →{' '}
          <Link href="/dashboard/planner" style={{ color: 'var(--indigo)', textDecoration: 'none', fontWeight: 600 }}>
            Open Planner
          </Link>
        </div>
      )}

      {viewReady && skipped.length === 0 && !isLoading && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(107,155,122,0.07)',
          borderRadius: 'var(--r-sm)',
          fontSize: '12.5px',
          color: 'var(--text-soft)',
          textAlign: 'center',
        }}>
          No procrastinated sessions detected. Great consistency!
        </div>
      )}

      {isLoading && (
        <div style={{ padding: '10px 0', fontSize: '12px', color: 'var(--text-soft)', textAlign: 'center' }}>
          Checking past plans…
        </div>
      )}

      {skipped.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 200, overflowY: 'auto' }}>
          {skipped.slice(0, 6).map((plan) => (
            <div
              key={plan.plan_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 'var(--r-sm)',
                background: plan.procrastination_status === 'skipped'
                  ? 'rgba(201,107,58,0.07)'
                  : 'rgba(212,168,67,0.07)',
                borderLeft: `3px solid ${plan.procrastination_status === 'skipped' ? 'var(--terra)' : 'var(--gold)'}`,
              }}
            >
              {/* Subject color dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: plan.color || 'var(--text-soft)',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {plan.subject_name} — {plan.topic_name}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-soft)' }}>
                  {formatDate(plan.plan_date)} · {plan.time_slot || 'No slot'} · {plan.target_duration} min
                </div>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: plan.procrastination_status === 'skipped'
                    ? 'rgba(201,107,58,0.15)'
                    : 'rgba(212,168,67,0.15)',
                  color: plan.procrastination_status === 'skipped' ? 'var(--terra)' : '#8a6800',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {plan.procrastination_status}
              </span>
              <Link
                href={`/dashboard/planner?prefill_topic_id=${plan.plan_id}&prefill_date=tomorrow`}
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'var(--indigo)',
                  textDecoration: 'none',
                  flexShrink: 0,
                  padding: '2px 7px',
                  border: '1px solid var(--indigo)',
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                Reschedule →
              </Link>
            </div>
          ))}
        </div>
      )}

      {skipped.length > 6 && (
        <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--text-soft)', textAlign: 'center' }}>
          +{skipped.length - 6} more in planner history
        </div>
      )}
    </div>
  )
}
