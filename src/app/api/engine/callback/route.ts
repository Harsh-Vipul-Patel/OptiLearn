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

    // ── 1. Write engine scores back to StudyLog ─────────────────────
    const { error: logError } = await supabase
      .from('study_logs')
      .update({
        efficiency:    efficiency    ?? null,
        throughput:    throughput    ?? null,
        quality_score: quality_score ?? null,
        analyzed_at:   new Date().toISOString(),
      })
      .eq('id', log_id)

    if (logError) throw new Error(logError.message)

    // ── 2. Insert AI suggestions ────────────────────────────────────
    if (Array.isArray(recommendations) && recommendations.length > 0) {
      const inserts = recommendations.map((text: string) => ({
        user_id,
        log_id,
        suggestion_text: text,
      }))
      const { error: sugError } = await supabase
        .from('suggestions')
        .insert(inserts)

      if (sugError) throw new Error(sugError.message)
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
