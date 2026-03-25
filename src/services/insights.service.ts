import { createClient } from '@/lib/supabase/server'

export class InsightsService {
  static async getTodaySuggestions(userId: string, limit = 20) {
    const supabase = await createClient()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const startIso = startOfDay.toISOString()

    const { data, error } = await supabase
      .from('suggestions')
      .select('id, user_id, log_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error) {
      return data ?? []
    }

    // Backward compatibility for alternate singular naming.
    const fallback = await supabase
      .from('suggestion')
      .select('suggestion_id, user_id, analysis_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (fallback.error) throw new Error(fallback.error.message)
    return (fallback.data ?? []).map((row) => ({
      id: row.suggestion_id,
      user_id: row.user_id,
      log_id: row.analysis_id,
      suggestion_text: row.suggestion_text,
      suggestion_type: row.suggestion_type,
      created_at: row.created_at,
    }))
  }

  static async getSuggestions(userId: string, limit = 5) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('suggestions')
      .select('id, user_id, log_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error) return data ?? []

    // Backward compatibility for legacy schema/table naming.
    const legacy = await supabase
      .from('suggestion')
      .select('suggestion_id, user_id, analysis_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (legacy.error) throw new Error(legacy.error.message)

    return (legacy.data ?? []).map((row) => ({
      id: row.suggestion_id,
      user_id: row.user_id,
      log_id: row.analysis_id,
      suggestion_text: row.suggestion_text,
      suggestion_type: row.suggestion_type,
      created_at: row.created_at,
    }))
  }
}