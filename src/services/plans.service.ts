import { createClient } from '@/lib/supabase/server'

export class PlansService {
  static async getPlans(userId: string, date?: string | null) {
    const supabase = await createClient()
    let query = supabase
      .from('daily_plans')
      .select(`
        *,
        studyTopic:study_topics (
          *,
          subject:subjects (*)
        )
      `)
      .eq('user_id', userId)
      .order('time_slot', { ascending: true })

    if (date) {
      query = query.eq('plan_date', date)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data
  }

  static async createPlan(data: { user_id: string, topic_id: string, target_duration: number, time_slot?: string, plan_date: string }) {
    const { data: plan, error } = await (await createClient())
      .from('daily_plans')
      .insert([{
        user_id: data.user_id,
        topic_id: data.topic_id,
        target_duration: data.target_duration,
        time_slot: data.time_slot,
        plan_date: data.plan_date
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return plan
  }
}
