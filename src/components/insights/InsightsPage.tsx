'use client'

import { useSession } from '@/components/Providers'
import { useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { useCheckin } from '@/hooks/useCheckin'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ReactNode, useMemo, useState } from 'react'
import { ThumbsDownIcon, ThumbsUpIcon } from '@/components/ui/AppIcons'
import { CheckCircleIcon, SparklesIcon } from '@/components/ui/AppIcons'
import { DailyCheckinModal } from '@/components/dashboard/DailyCheckinModal'

type SuggestionRow = {
  id?: string
  suggestion_id?: string
  suggestion_text?: string
  suggestion_type?: string
  created_at?: string
}

type FeedbackState = 'like' | 'dislike' | 'pending'

function formatInsightTime(createdAt?: string) {
  if (!createdAt) return 'Now'
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return 'Now'
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function badgeFromReaction(reaction: FeedbackState): { badge: 'sage' | 'terra' | 'gold', label: string } {
  if (reaction === 'like') return { badge: 'sage', label: 'Liked' }
  if (reaction === 'dislike') return { badge: 'terra', label: 'Dismissed' }
  return { badge: 'gold', label: 'Pending' }
}

export function InsightsPage() {
  const { data: session } = useSession()
  const { suggestions, refreshSuggestions, isLoading } = useSuggestionsSync(session?.user?.id || '')
  const { checkin, refreshCheckin, isLoading: checkinLoading } = useCheckin(session?.user?.id || '')
  const { showToast } = useToast()
  const [feedbackBySuggestion, setFeedbackBySuggestion] = useState<Record<string, FeedbackState>>({})
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false)
  const [showCheckinModal, setShowCheckinModal] = useState(false)

  // Check-in is pending when: not loading, no check-in found, user is logged in
  const checkinPending = !checkinLoading && !checkin && !!session?.user?.id
  const checkinCompleted = !checkinLoading && !!checkin && !!session?.user?.id

  const normalized = useMemo(() => {
    return (suggestions as SuggestionRow[])
      .map((item) => {
        const id = item.id ?? item.suggestion_id
        const rawText = item.suggestion_text?.trim() || ''
        let text = rawText
        let type = item.suggestion_type || 'General'
        let title = ''
        let finding = ''
        let action = ''
        let isPlan = false
        
        try {
          const obj = JSON.parse(rawText)
          if (obj.action || obj.finding) {
            type = obj.type || type
            title = obj.title || ''
            finding = obj.finding || ''
            action = obj.action || ''
            isPlan = type.toLowerCase() === 'planning' || rawText.includes('📋')
            text = action || finding || rawText
          } else {
             isPlan = rawText.startsWith('📋') || type.toLowerCase().includes('plan')
          }
        } catch {
          isPlan = rawText.startsWith('📋') || type.toLowerCase().includes('plan')
        }

        return {
          id,
          text,
          rawText,
          type: isPlan ? '📋 Plan' : type,
          title,
          finding,
          action,
          isPlan,
          created_at: item.created_at,
        }
      })
      .filter((item) => item.text.length > 0)
  }, [suggestions])

  const top = normalized[0]
  const supportingInsights = normalized.slice(1, 3)
  const tipInsights = normalized.slice(3, 6)

  const onFeedback = async (suggestionId: string | undefined, reaction: 'like' | 'dislike') => {
    if (!suggestionId) {
      showToast('This suggestion cannot be rated yet.', 'info')
      return
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: suggestionId, reaction }),
      })

      if (!response.ok) {
        throw new Error('Feedback request failed')
      }

      setFeedbackBySuggestion((prev) => ({ ...prev, [suggestionId]: reaction }))
      showToast(reaction === 'like' ? 'Feedback recorded. Thanks!' : 'Dismissed', 'info')
    } catch {
      showToast('Could not save feedback. Please try again.', 'error')
    }
  }

  const onGenerateInsights = async () => {
    if (!session?.user?.id) {
      showToast('Please log in to generate insights.', 'error')
      return
    }

    try {
      setIsGeneratingInsights(true)
      console.log('[InsightsPage] Sending POST /api/insights...')
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      console.log('[InsightsPage] POST response:', response.status, data)

      if (!response.ok) {
        throw new Error(data?.error || 'Insight generation failed')
      }

      await refreshSuggestions()
      showToast(
        `Insights generated! ${data.processed_logs ?? 0} logs processed, ${(data.suggestions ?? []).length} recommendations.`,
        'info'
      )
    } catch (err) {
      console.error('[InsightsPage] POST error:', err)
      showToast('Could not generate insights right now. Please try again.', 'error')
    } finally {
      setIsGeneratingInsights(false)
    }
  }

  const handleCheckinComplete = () => {
    setShowCheckinModal(false)
    refreshCheckin()
    showToast('Check-in saved! Generate insights now for personalised planning suggestions.', 'info')
  }

  const topText = top?.text || 'No AI insights yet. Log a study session to generate personalized recommendations.'

  return (
    <div>
      {/* Check-in Modal (triggered from insights page) */}
      {showCheckinModal && (
        <DailyCheckinModal
          onComplete={handleCheckinComplete}
          onSkip={() => setShowCheckinModal(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <div className="page-title" style={{ marginBottom: 0 }}>AI Insights</div>
        <button
          className="insight-btn insight-btn-primary"
          type="button"
          onClick={onGenerateInsights}
          disabled={isGeneratingInsights || isLoading}
          style={{ opacity: isGeneratingInsights || isLoading ? 0.7 : 1, cursor: isGeneratingInsights || isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isGeneratingInsights ? 'Generating...' : 'Generate Insight'}
        </button>
      </div>
      <div className="page-sub">Personalised, non-judgmental guidance based on your actual study data.</div>

      {/* Pending check-in banner */}
      {checkinPending && (
        <div className="checkin-pending-banner">
          <div className="checkin-pending-banner-icon is-pending">
            <SparklesIcon width={24} height={24} />
          </div>
          <div className="checkin-pending-banner-content">
            <div className="checkin-pending-banner-title">Daily check-in pending</div>
            <div className="checkin-pending-banner-sub">
              Complete your wellness check-in to get personalised planning suggestions based on how you&apos;re feeling today.
            </div>
          </div>
          <button className="checkin-pending-banner-btn" onClick={() => setShowCheckinModal(true)}>
            Fill Check-in →
          </button>
        </div>
      )}

      {/* Completed check-in banner */}
      {checkinCompleted && (
        <div className="checkin-pending-banner is-complete">
          <div className="checkin-pending-banner-icon is-complete">
            <CheckCircleIcon width={24} height={24} />
          </div>
          <div className="checkin-pending-banner-content">
            <div className="checkin-pending-banner-title">Pre check-in filled</div>
            <div className="checkin-pending-banner-sub">
              Your daily check-in is complete. Insights generated now will use your current wellness context.
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="insight-card">
          <div className="insight-label">Today&apos;s Top Insight {top?.title ? `— ${top.title}` : ''}</div>
          <div className="insight-text">
            {top?.finding && <div style={{marginBottom: 8, fontSize: '14px'}}>{top.finding}</div>}
            {top?.action ? <div style={{fontWeight: 600, color: 'rgba(255, 220, 170, .95)'}}>👉 {top.action}</div> : <div>&quot;{topText}&quot;</div>}
          </div>
          <div className="insight-actions">
            <button className="insight-btn insight-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => onFeedback(top?.id, 'like')}><ThumbsUpIcon width={16} height={16} />Helpful</button>
            <button className="insight-btn insight-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => onFeedback(top?.id, 'dislike')}><ThumbsDownIcon width={16} height={16} />Not now</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {supportingInsights.length > 0 ? (
            supportingInsights.map((item, index) => (
              <SmallInsight
                key={item.id || `${item.text}-${index}`}
                icon={index === 0 ? <TimerIcon /> : <SwapIcon />}
                title={item.type}
                color={index === 0 ? 'var(--terra)' : 'var(--gold)'}
                item={item}
                onLike={() => onFeedback(item.id, 'like')}
                onDislike={() => onFeedback(item.id, 'dislike')}
              />
            ))
          ) : (
            <SmallInsight
              icon={<TimerIcon />}
              title="Awaiting Insights"
              color="var(--terra)"
              item={{ text: "Generate your first recommendation by logging a completed study session." }}
            />
          )}
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        {tipInsights.length > 0 ? (
          tipInsights.map((item, index) => (
            <InsightTip
              key={item.id || `${item.text}-${index}`}
              icon={index === 0 ? <AlertIcon /> : index === 1 ? <BookIcon /> : <StarIcon />}
              title={item.type}
              item={item}
              badge={index === 0 ? 'terra' : index === 1 ? 'indigo' : 'sage'}
              badgeLabel={index === 0 ? 'Priority' : index === 1 ? 'Practice' : 'Progress'}
            />
          ))
        ) : (
          <InsightTip
            icon={<AlertIcon />}
            title="No Pattern Yet"
            item={{ text: "Add a few more logs to unlock stronger trend-based coaching." }}
            badge="gold"
            badgeLabel="In Progress"
          />
        )}
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Insight History</div>
          <Badge variant="indigo">{normalized.length} total</Badge>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {normalized.length > 0 ? (
            normalized.map((item, index) => {
              const reaction = item.id ? (feedbackBySuggestion[item.id] || 'pending') : 'pending'
              const badgeMeta = badgeFromReaction(reaction)

              return (
                <div key={item.id || `${item.text}-${index}`} style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '10px 13px', background: item.isPlan ? 'linear-gradient(160deg, #F0F4FF 0%, #FAFBFF 100%)' : 'var(--cream)', borderRadius: 'var(--r-sm)', borderLeft: item.isPlan ? '3px solid var(--indigo)' : 'none' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-soft)', minWidth: 58 }}>{formatInsightTime(item.created_at)}</div>
                  <div style={{ flex: 1, fontSize: '12.5px', color: 'var(--text-mid)' }}>
                    {item.finding && <div style={{marginBottom: 4, color: 'var(--text-soft)'}}>{item.finding}</div>}
                    {item.action ? <div style={{fontWeight: 500, color: 'var(--indigo)'}}>👉 {item.action}</div> : item.text}
                  </div>
                  {item.isPlan && <Badge variant="indigo">Plan</Badge>}
                  <Badge variant={badgeMeta.badge}>{badgeMeta.label}</Badge>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '12px 13px', background: 'var(--cream)', borderRadius: 'var(--r-sm)', fontSize: '12.5px', color: 'var(--text-soft)' }}>
              No insights yet. Complete a study session and wait for analysis to appear here.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function SmallInsight({ icon, title, color, item, onLike, onDislike }: { icon: ReactNode; title: string; color: string; item: any; onLike?: () => void; onDislike?: () => void }) {
  const { showToast } = useToast()
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid var(--border)', background: 'linear-gradient(160deg, #FFFFFF 0%, #FFF8F2 100%)', color: 'var(--text-mid)' }}>{icon}</div>
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color, marginBottom: 4 }}>{item?.title || title}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-mid)', lineHeight: 1.5 }}>
            {item?.finding && <div style={{marginBottom: 4, color: 'var(--text-soft)'}}>{item.finding}</div>}
            {item?.action ? <div style={{fontWeight: 500, color: 'var(--indigo)'}}>👉 {item.action}</div> : item?.text}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 9, display: 'flex', gap: 7 }}>
        <button className="insight-btn" style={{ background: color, color: 'white', padding: '5px 12px', display: 'inline-flex', alignItems: 'center' }} onClick={onLike || (() => showToast('Feedback recorded!', 'info'))}><ThumbsUpIcon width={16} height={16} /></button>
        <button className="insight-btn insight-btn-ghost" style={{ color: 'var(--text-soft)', borderColor: 'var(--border)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center' }} onClick={onDislike || (() => showToast('Dismissed', 'info'))}><ThumbsDownIcon width={16} height={16} /></button>
      </div>
    </div>
  )
}

function InsightTip({ icon, title, item, badge, badgeLabel }: { icon: ReactNode; title: string; item: any; badge: 'terra' | 'indigo' | 'sage' | 'gold'; badgeLabel: string }) {
  return (
    <div className="card">
      <div style={{ width: 34, height: 34, marginBottom: 9, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border)', background: 'linear-gradient(160deg, #FFFFFF 0%, #FFF8F2 100%)', color: 'var(--text-mid)' }}>{icon}</div>
      <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: 6 }}>{item?.title || title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-soft)', lineHeight: 1.6 }}>
        {item?.finding && <div style={{marginBottom: 4}}>{item.finding}</div>}
        {item?.action ? <div style={{fontWeight: 500, color: 'var(--indigo)'}}>👉 {item.action}</div> : item?.text}
      </div>
      <div style={{ marginTop: 9 }}><Badge variant={badge}>{badgeLabel}</Badge></div>
    </div>
  )
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13l3-2" />
      <path d="M9 2h6" />
      <path d="M12 5v2" />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M17 3l4 4-4 4" />
      <path d="M3 7h18" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M21 17H3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M12 3l9 16H3L12 3z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r="1" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.5.5H6.5A2.5 2.5 0 0 1 4 17.5v-11z" />
      <path d="M8 4v16" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
      <path d="M12 3l2.8 5.7L21 9.6l-4.5 4.4 1.1 6.3L12 17.4 6.4 20.3 7.5 14 3 9.6l6.2-.9L12 3z" />
    </svg>
  )
}
