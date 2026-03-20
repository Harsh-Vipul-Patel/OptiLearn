import { createClient } from '@/lib/supabase/server'

export class PlansService {
  static async getPlans(userId: string, date?: string | null) {
    const supabase = await createClient()
    let query = supabase
      .from('daily_plan')
      .select(`
        *,
        studyTopic:study_topic (
          *,
          subject:subject (*)
        )
      `)
      // Join through study_topic -> subject to filter by user_id
      .order('time_slot', { ascending: true })

    if (date) {
      query = query.eq('plan_date', date)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data
  }

  static async createPlan(data: { topic_id: string, target_duration: number, time_slot?: string, plan_date: string, goal_type?: string }) {
    const { data: plan, error } = await (await createClient())
      .from('daily_plan')
      .insert([{
        topic_id: data.topic_id,
        target_duration: data.target_duration,
        time_slot: data.time_slot,
        plan_date: data.plan_date,
        goal_type: data.goal_type
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return plan
  }
}
