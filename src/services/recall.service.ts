import { createClient } from '@/lib/supabase/server'

export interface RecallResponse {
  flashcard_q: string
  flashcard_a: string
  confidence: number // 1-5
  is_correct: boolean
  response_time_ms?: number
}

export interface RecallSessionPayload {
  user_id: string
  topic_id: string
  responses: RecallResponse[]
}

export class RecallService {
  /**
   * Logs a completed recall session with confidence responses.
   * Uses a two-step process since RPCs aren't strictly required yet:
   * 1. Create the session
   * 2. Insert all responses linked to the session
   */
  static async submitSession(payload: RecallSessionPayload) {
    const supabase = await createClient()

    // 1. Create the session
    const { data: sessionData, error: sessionError } = await supabase
      .from('recall_session')
      .insert([{ user_id: payload.user_id, topic_id: payload.topic_id }])
      .select()
      .single()

    if (sessionError || !sessionData) {
      throw new Error(sessionError?.message || 'Failed to create recall session')
    }

    // 2. Map and insert the responses
    if (payload.responses.length > 0) {
      const responseRows = payload.responses.map(r => ({
        session_id: sessionData.session_id,
        flashcard_q: r.flashcard_q,
        flashcard_a: r.flashcard_a,
        confidence: r.confidence,
        is_correct: r.is_correct,
        response_time_ms: r.response_time_ms || null
      }))

      const { error: responseError } = await supabase
        .from('recall_response')
        .insert(responseRows)

      if (responseError) {
        throw new Error(responseError.message)
      }
    }

    return sessionData
  }

  /**
   * Fetches latest recall stats for a specific topic across all sessions.
   * Useful for the "Retention Score" and "Weak Topic Detector" features.
   */
  static async getTopicRecallStats(userId: string, topicId: string) {
    const supabase = await createClient()

    // Get all sessions for this topic
    const { data: sessions, error: sessionError } = await supabase
      .from('recall_session')
      .select('session_id, created_at')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })

    if (sessionError) throw new Error(sessionError.message)
    if (!sessions || sessions.length === 0) return null

    const sessionIds = sessions.map(s => s.session_id)

    // Get responses for these sessions
    const { data: responses, error: responseError } = await supabase
      .from('recall_response')
      .select('confidence, is_correct, session_id')
      .in('session_id', sessionIds)

    if (responseError) throw new Error(responseError.message)

    return {
      sessions,
      responses: responses || []
    }
  }
}
