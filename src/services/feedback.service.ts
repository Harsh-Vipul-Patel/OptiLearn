import { createClient } from '@/lib/supabase/server'

export class FeedbackService {
  static async submitFeedback(suggestionId: string, reaction: string) {
    const { data, error } = await createClient()
      .from('feedback')
      .insert([{
        suggestion_id: suggestionId,
        reaction: reaction
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }
}
