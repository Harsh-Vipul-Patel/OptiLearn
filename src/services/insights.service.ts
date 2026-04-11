import { createClient } from '@/lib/supabase/server'

export class InsightsService {
  static async getTodaySuggestions(userId: string, limit = 20) {
    const supabase = createClient()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const startIso = startOfDay.toISOString()

    const { data, error } = await supabase
      .from('suggestion')
      .select('suggestion_id, user_id, analysis_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error) {
      return (data ?? []).map((row) => ({
        id: row.suggestion_id,
        user_id: row.user_id,
        log_id: row.analysis_id,
        suggestion_text: row.suggestion_text,
        suggestion_type: row.suggestion_type,
        created_at: row.created_at,
      }))
    }

    // Backward compatibility for alternate plural naming.
    const fallback = await supabase
      .from('suggestions')
      .select('id, user_id, log_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (fallback.error) throw new Error(fallback.error.message)
    return (fallback.data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      log_id: row.log_id,
      suggestion_text: row.suggestion_text,
      suggestion_type: row.suggestion_type,
      created_at: row.created_at,
    }))
  }

  static async getSuggestions(userId: string, limit = 5) {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('suggestion')
      .select('suggestion_id, user_id, analysis_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error) {
      return (data ?? []).map((row) => ({
        id: row.suggestion_id,
        user_id: row.user_id,
        log_id: row.analysis_id,
        suggestion_text: row.suggestion_text,
        suggestion_type: row.suggestion_type,
        created_at: row.created_at,
      }))
    }

    // Backward compatibility for legacy schema/table naming.
    const legacy = await supabase
      .from('suggestions')
      .select('id, user_id, log_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (legacy.error) throw new Error(legacy.error.message)

    return (legacy.data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      log_id: row.log_id,
      suggestion_text: row.suggestion_text,
      suggestion_type: row.suggestion_type,
      created_at: row.created_at,
    }))
  }

  static async getWeakTopics(userId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('vw_user_topic_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('is_weak', true)

    if (error) {
      // Return empty if the view migration hasn't been run yet (graceful fallback)
      console.warn('getWeakTopics failed (maybe view not created yet?):', error)
      return []
    }

    return data ?? []
  }
}