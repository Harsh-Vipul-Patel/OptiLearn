import { createClient } from '@/lib/supabase/server'

export class InsightsService {
  static async getSuggestions(userId: string, limit = 5) {
    const { data, error } = await (await createClient())
      .from('suggestion')
      .select('suggestion_id:*, user_id, analysis_id, suggestion_text, suggestion_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data
  }
}