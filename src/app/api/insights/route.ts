import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

import { InsightsService } from '@/services/insights.service'
import { triggerTodayInsights, triggerAIInsights } from '@/lib/engineClient'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todaySuggestions = await InsightsService.getTodaySuggestions(session.user.id, 20)
    const suggestions = todaySuggestions.length > 0
      ? todaySuggestions
      : await InsightsService.getSuggestions(session.user.id, 20)

    return NextResponse.json({ suggestions }, { status: 200 })
  } catch (error) {
    console.error('[insights/GET] Error:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}

export async function POST() {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log('[insights/POST] Generating insights for user:', userId)

    // ── 1. Call the Python engine (AI-first, fallback to regular) ─────
    let engineResult: {
      status?: string
      recommendations?: string[]
      processed_logs?: number
      llm_used?: boolean
      insights?: Array<{ recommendations?: string[]; efficiency?: number; quality_score?: number }>
    } = {}

    try {
      engineResult = await triggerAIInsights({ user_id: userId })
      console.log('[insights/POST] AI Engine response:', JSON.stringify({
        status: engineResult.status,
        processed_logs: engineResult.processed_logs,
        recommendations_count: engineResult.recommendations?.length ?? 0,
        insights_count: engineResult.insights?.length ?? 0,
        llm_used: engineResult.llm_used ?? false,
      }))
    } catch (aiErr) {
      console.warn('[insights/POST] AI endpoint failed, falling back:', aiErr)
      try {
        engineResult = await triggerTodayInsights({ user_id: userId })
        console.log('[insights/POST] Fallback engine response:', JSON.stringify({
          status: engineResult.status,
          processed_logs: engineResult.processed_logs,
          recommendations_count: engineResult.recommendations?.length ?? 0,
        }))
      } catch (engineErr) {
        console.error('[insights/POST] Both engine calls failed:', engineErr)
      }
    }

    // ── 2. Collect ALL recommendations from engine response ───────
    const allRecs: string[] = []

    if (Array.isArray(engineResult.recommendations)) {
      for (const rec of engineResult.recommendations) {
        if (rec && !allRecs.includes(rec)) allRecs.push(rec)
      }
    }

    if (Array.isArray(engineResult.insights)) {
      for (const insight of engineResult.insights) {
        if (Array.isArray(insight.recommendations)) {
          for (const rec of insight.recommendations) {
            if (rec && !allRecs.includes(rec)) allRecs.push(rec)
          }
        }
      }
    }

    // ── 2b. Default insights when engine has no data ─────────────
    if (allRecs.length === 0) {
      console.log('[insights/POST] Engine returned 0 recommendations — using starter insights')
      allRecs.push(
        '🎯 Start by logging your first study session in the Logger tab. The AI engine needs at least 1 session to generate personalized insights.',
        '⏱️ Try the Pomodoro technique: study for 25 minutes, then take a 5-minute break. This builds focus without burnout.',
        '📊 After logging 3+ sessions, the AI will identify your peak study times and recommend optimal schedules.',
        '🧠 Rate your focus level honestly when logging — this helps the engine calibrate distractions and flow-state patterns.',
        '📈 Consistency matters more than marathon sessions. Aim for regular 30–45 minute blocks across the week.',
      )
    }

    console.log('[insights/POST] Total recommendations to persist:', allRecs.length)

    // ── 3. Always persist engine recommendations to DB ─────────────
    if (allRecs.length > 0) {
      const supabase = await createClient()

      const inserts = allRecs.map((text) => ({
        user_id: userId,
        analysis_id: null,
        suggestion_text: text,
        suggestion_type: 'SubjectTip',
      }))

      const { error: insertErr } = await supabase
        .from('suggestion')
        .insert(inserts)

      if (insertErr) {
        console.warn('[insights/POST] suggestion insert failed:', insertErr.message)
        // Try legacy plural table name
        const legacyInserts = allRecs.map((text) => ({
          user_id: userId,
          log_id: null,
          suggestion_text: text,
          suggestion_type: 'SubjectTip',
        }))
        const { error: legacyErr } = await supabase.from('suggestions').insert(legacyInserts)
        if (legacyErr) {
          console.error('[insights/POST] legacy suggestions insert also failed:', legacyErr.message)
        } else {
          console.log('[insights/POST] Saved to legacy "suggestions" table')
        }
      } else {
        console.log('[insights/POST] Saved', inserts.length, 'recommendations to "suggestion" table')
      }
    }

    // ── 4. Read back persisted suggestions ──────────────────────────
    const todaySuggestions = await InsightsService.getTodaySuggestions(userId, 20)
    let suggestions = todaySuggestions.length > 0
      ? todaySuggestions
      : await InsightsService.getSuggestions(userId, 20)

    // ── 5. If DB still empty, return in-memory recs as suggestions ──
    if (suggestions.length === 0 && allRecs.length > 0) {
      console.log('[insights/POST] DB empty — returning in-memory recommendations')
      suggestions = allRecs.map((text, i) => ({
        id: `mem_${i}`,
        user_id: userId,
        log_id: null,
        suggestion_text: text,
        suggestion_type: 'SubjectTip',
        created_at: new Date().toISOString(),
      }))
    }

    return NextResponse.json({
      suggestions,
      engine_status: engineResult.status || 'unknown',
      processed_logs: engineResult.processed_logs ?? 0,
      llm_used: engineResult.llm_used ?? false,
    }, { status: 200 })
  } catch (error) {
    console.error('[insights/POST] Fatal error:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 502 })
  }
}
