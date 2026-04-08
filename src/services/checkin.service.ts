import { createClient } from '@/lib/supabase/server'

export type CheckinData = {
  sleep_hours: number
  sleep_quality: number
  energy_level: number
  stress_level: number
  mood: string
  exercised_today: boolean
  had_meal: boolean
  screen_time_last_night: string
  notes?: string
}

export type CheckinRow = CheckinData & {
  checkin_id: string
  user_id: string
  checkin_date: string
  created_at: string
}

export class CheckinService {
  /**
   * Get today's check-in for a user (returns null if not done yet).
   */
  static async getTodayCheckin(userId: string): Promise<CheckinRow | null> {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('daily_checkin')
      .select('*')
      .eq('user_id', userId)
      .eq('checkin_date', today)
      .maybeSingle()

    if (error) {
      console.warn('[CheckinService] getTodayCheckin error:', error.message)
      return null
    }

    return data as CheckinRow | null
  }

  /**
   * Create or update today's check-in for a user.
   * Uses upsert on (user_id, checkin_date) to enforce one-per-day.
   */
  static async upsertTodayCheckin(userId: string, data: CheckinData): Promise<CheckinRow> {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: checkin, error } = await supabase
      .from('daily_checkin')
      .upsert(
        [{
          user_id: userId,
          checkin_date: today,
          sleep_hours: data.sleep_hours,
          sleep_quality: data.sleep_quality,
          energy_level: data.energy_level,
          stress_level: data.stress_level,
          mood: data.mood,
          exercised_today: data.exercised_today,
          had_meal: data.had_meal,
          screen_time_last_night: data.screen_time_last_night,
          notes: data.notes || null,
        }],
        { onConflict: 'user_id,checkin_date' }
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return checkin as CheckinRow
  }

  /**
   * Get recent check-ins for trend analysis (last N days).
   */
  static async getRecentCheckins(userId: string, limit = 7): Promise<CheckinRow[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('daily_checkin')
      .select('*')
      .eq('user_id', userId)
      .order('checkin_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[CheckinService] getRecentCheckins error:', error.message)
      return []
    }

    return (data || []) as CheckinRow[]
  }
}
