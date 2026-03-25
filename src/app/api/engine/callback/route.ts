import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/engine/callback
 *
 * Called by the Python engine (Azure App Service) after it finishes analysis.
 * Authenticated via `x-engine-key` header (shared secret, never exposes user session).
 *
 * Body: {
 *   log_id: string,
 *   user_id: string,
 *   efficiency: number,
 *   throughput: number,
 *   quality_score: number,
 *   recommendations: string[]
 * }
 */
export async function POST(request: Request) {
  try {
    // ── Auth: verify engine secret ──────────────────────────────────
    const engineKey = request.headers.get('x-engine-key')
    if (!engineKey || engineKey !== process.env.ENGINE_API_KEY) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { log_id, user_id, efficiency, throughput, quality_score, recommendations } = body

    if (!log_id || !user_id) {
      return NextResponse.json({ error: 'log_id and user_id are required' }, { status: 400 })
    }

    const supabase = await createClient()

    let analysisId: string | null = null

    // ── 1. Persist analysis (supports both schema variants) ─────────────
    const analysisInsert = await supabase
      .from('study_log_analysis')
      .insert([{
        log_id,
        user_id,
        efficiency: efficiency ?? null,
        throughput: throughput ?? null,
        quality_score: quality_score ?? null,
      }])
      .select('analysis_id')
      .single()

    if (!analysisInsert.error) {
      analysisId = analysisInsert.data?.analysis_id || null
    } else {
      // Fallback for schemas where metrics live directly on study log rows.
      const metrics = {
        efficiency: efficiency ?? null,
        throughput: throughput ?? null,
        quality_score: quality_score ?? null,
        analyzed_at: new Date().toISOString(),
      }

      const updatePlural = await supabase
        .from('study_logs')
        .update(metrics)
        .eq('id', log_id)
        .eq('user_id', user_id)

      if (updatePlural.error) {
        const updateSingular = await supabase
          .from('study_log')
          .update(metrics)
          .eq('log_id', log_id)

        if (updateSingular.error) {
          console.warn('[engine/callback] analysis persistence fallback failed', updateSingular.error.message)
        }
      }
    }

    // ── 2. Insert AI suggestions ────────────────────────────────────
    if (Array.isArray(recommendations) && recommendations.length > 0) {
      const inserts = recommendations.map((text: string) => ({
        user_id,
        log_id,
        suggestion_text: text,
        suggestion_type: 'engine',
      }))

      const { error: sugError } = await supabase
        .from('suggestions')
        .insert(inserts)

      if (sugError) {
        const legacyInserts = recommendations.map((text: string) => ({
          user_id,
          analysis_id: analysisId || log_id,
          suggestion_text: text,
          suggestion_type: 'engine',
        }))

        const legacyResult = await supabase
          .from('suggestion')
          .insert(legacyInserts)

        if (legacyResult.error) throw new Error(legacyResult.error.message)
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (error) {
    console.error('[engine/callback]', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 })
  }
}
