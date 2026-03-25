'use client'

import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'
import { useState } from 'react'
import { CheckCircleIcon, ThumbsUpIcon } from '@/components/ui/AppIcons'

interface InsightCardProps {
  text: string
  burnoutRisk?: string
  fatigue?: number
}

export function InsightCard({ text, burnoutRisk = 'Low', fatigue = 32 }: InsightCardProps) {
  const { showToast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  const onGenerateInsights = async () => {
    try {
      setIsGenerating(true)
      const response = await fetch('/api/insights', { method: 'GET' })
      if (!response.ok) {
        throw new Error('Insights generation request failed')
      }
      showToast('Insight generation triggered. Open Insights for updates.', 'info')
    } catch {
      showToast('Could not generate insights right now. Please try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="insight-card">
      <div className="insight-label">AI Insight · Live</div>
      <div className="insight-text">&quot;{text}&quot;</div>
      <div className="insight-actions">
        <button
          className="insight-btn insight-btn-primary"
          onClick={() => showToast('Feedback recorded — insights will improve!')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ThumbsUpIcon width={18} height={18} />
          Helpful
        </button>
        <Link href="/dashboard/insights" className="insight-btn insight-btn-ghost" style={{ textDecoration: 'none' }}>
          See all →
        </Link>
        <button
          className="insight-btn insight-btn-ghost"
          onClick={onGenerateInsights}
          disabled={isGenerating}
          style={{ opacity: isGenerating ? 0.7 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}
        >
          {isGenerating ? 'Generating...' : 'Generate Insights'}
        </button>
      </div>
      <div style={{ marginTop: 18, padding: '11px 13px', background: 'rgba(255,255,255,.1)', borderRadius: 'var(--r-sm)', fontSize: 12, opacity: .85, position: 'relative', zIndex: 1 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircleIcon width={18} height={18} />
          Burnout risk: <strong>{burnoutRisk}</strong> · Fatigue {fatigue}/100 · Streak intact!
        </span>
      </div>
    </div>
  )
}
