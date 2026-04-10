import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'

import { InsightsService } from '@/services/insights.service'
import { CheckinService } from '@/services/checkin.service'
import { LogsService } from '@/services/logs.service'
import { triggerTodayInsights, triggerAIInsights } from '@/lib/engineClient'
import type { WellnessContext } from '@/lib/engineClient'

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todaySuggestions = await InsightsService.getTodaySuggestions(user.id, 20)
    const suggestions = todaySuggestions.length > 0
      ? todaySuggestions
      : await InsightsService.getSuggestions(user.id, 20)

    return NextResponse.json({ suggestions }, { status: 200 })
  } catch (error) {
    console.error('[insights/GET] Error:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    console.log('[insights/POST] Generating insights for user:', userId)

    // Fetch today's wellness check-in to pass as context to the engine
    let wellnessContext: WellnessContext | undefined
    try {
      const checkin = await CheckinService.getTodayCheckin(userId)
      if (checkin) {
        wellnessContext = {
          sleep_hours: checkin.sleep_hours,
          sleep_quality: checkin.sleep_quality,
          energy_level: checkin.energy_level,
          stress_level: checkin.stress_level,
          mood: checkin.mood,
          exercised_today: checkin.exercised_today,
          had_meal: checkin.had_meal,
          screen_time_last_night: checkin.screen_time_last_night,
          notes: checkin.notes,
        }
        console.log('[insights/POST] Wellness context found:', JSON.stringify({
          sleep_hours: wellnessContext.sleep_hours,
          sleep_quality: wellnessContext.sleep_quality,
          energy_level: wellnessContext.energy_level,
          mood: wellnessContext.mood,
        }))
      } else {
        console.log('[insights/POST] No wellness check-in for today')
      }
    } catch (checkinErr) {
      console.warn('[insights/POST] Could not fetch check-in:', checkinErr)
    }

    let engineResult: {
      status?: string
      recommendations?: string[]
      processed_logs?: number
      llm_used?: boolean
      insights?: Array<{ recommendations?: string[]; efficiency?: number; quality_score?: number }>
    } = {}

    try {
      engineResult = await triggerAIInsights({ user_id: userId, wellness_context: wellnessContext })
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
        engineResult = await triggerTodayInsights({ user_id: userId, wellness_context: wellnessContext })
        console.log('[insights/POST] Fallback engine response:', JSON.stringify({
          status: engineResult.status,
          processed_logs: engineResult.processed_logs,
          recommendations_count: engineResult.recommendations?.length ?? 0,
        }))
      } catch (engineErr) {
        console.error('[insights/POST] Both engine calls failed:', engineErr)
      }
    }

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

    if (allRecs.length > 0) {
      const supabase = createClient()
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const startIso = startOfDay.toISOString()

      // Keep today's insight feed coherent by replacing the current day's
      // generated batch instead of stacking multiple runs.
      const { error: cleanupErr } = await supabase
        .from('suggestion')
        .delete()
        .eq('user_id', userId)
        .gte('created_at', startIso)

      if (cleanupErr) {
        console.warn('[insights/POST] suggestion cleanup failed:', cleanupErr.message)
        const { error: legacyCleanupErr } = await supabase
          .from('suggestions')
          .delete()
          .eq('user_id', userId)
          .gte('created_at', startIso)
        if (legacyCleanupErr) {
          console.warn('[insights/POST] legacy suggestions cleanup failed:', legacyCleanupErr.message)
        }
      }

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

      // -- Phase 4: Smart Spaced Repetition --
      try {
        console.log('[insights/POST] Running Smart Spaced Repetition checks...')
        
        // Fetch user logs (already ownership filtered and merged with efficiency metrics)
        const recentLogs = await LogsService.getLogs(userId);
        
        // Consider logs from the past 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const topicsToReview = new Set<string>();

        recentLogs.forEach(log => {
          // @ts-ignore - created_at exists on log
          const logDate = new Date(log.created_at || new Date());
          if (logDate >= sevenDaysAgo) {
            const eff = Number(log.efficiency);
            // @ts-ignore - focus_level might exist
            const focus = Number(log.focus_level || 5); 

            if ((!isNaN(eff) && eff < 60) || focus < 3) {
              const topicId = log.dailyPlan?.topic_id;
              if (topicId) {
                topicsToReview.add(topicId);
              }
            }
          }
        });

        if (topicsToReview.size > 0) {
          console.log(`[insights/POST] Found ${topicsToReview.size} topics needing review.`);
          const reviewDateRaw = new Date();
          reviewDateRaw.setDate(reviewDateRaw.getDate() + 3); // 3 days spacing
          const planDateStr = reviewDateRaw.toISOString().split('T')[0];

          for (const topicId of topicsToReview) {
            // Check if already planned
            const { data: existingPlan } = await supabase
              .from('daily_plan')
              .select('plan_id')
              .eq('topic_id', topicId)
              .gte('plan_date', startIso)
              .limit(1);

            if (!existingPlan || existingPlan.length === 0) {
              console.log(`[insights/POST] Auto-scheduling spaced repetition review for topic_id ${topicId} on ${planDateStr}`);
              await supabase
                .from('daily_plan')
                .insert([{
                  topic_id: topicId,
                  target_duration: 30, // 30 mins review sprint
                  plan_date: planDateStr,
                  goal_type: 'Review (Auto-Scheduled)',
                  time_slot: 'Evening'
                }]);
            }
          }
        }
      } catch (repErr) {
        console.error('[insights/POST] Error in Spaced Repetition scheduling:', repErr);
      }
    }

    const todaySuggestions = await InsightsService.getTodaySuggestions(userId, 20)
    let suggestions = todaySuggestions.length > 0
      ? todaySuggestions
      : await InsightsService.getSuggestions(userId, 20)

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
