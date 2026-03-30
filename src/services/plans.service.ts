import { createClient } from '@/lib/supabase/server'

export class PlansService {
  static async getPlans(userId: string, date?: string | null, includeLogged = true) {
    const supabase = createClient()
    let query = supabase
      .from('daily_plan')
      .select(`
        *,
        logs:study_log (
          log_id
        ),
        studyTopic:study_topic (
          *,
          subject:subject (*)
        )
      `)
      .order('time_slot', { ascending: true })

    if (date) {
      query = query.eq('plan_date', date)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)

    const ownedPlans = data?.filter((plan) => plan.studyTopic?.subject?.user_id === userId) || []
    if (includeLogged) return ownedPlans
    return ownedPlans.filter((plan) => !Array.isArray(plan.logs) || plan.logs.length === 0)
  }

  static async createPlan(data: { topic_id: string, target_duration: number, time_slot?: string, plan_date: string, goal_type?: string, start_time?: string, end_time?: string }) {
    const { data: plan, error } = await createClient()
      .from('daily_plan')
      .insert([{
        topic_id: data.topic_id,
        target_duration: data.target_duration,
        time_slot: data.time_slot,
        plan_date: data.plan_date,
        goal_type: data.goal_type,
        start_time: data.start_time,
        end_time: data.end_time,
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return plan
  }

  static async updatePlan(
    planId: string,
    data: { topic_id: string, target_duration: number, time_slot?: string | null, plan_date: string, goal_type?: string | null, start_time?: string | null, end_time?: string | null }
  ) {
    const { data: plan, error } = await createClient()
      .from('daily_plan')
      .update({
        topic_id: data.topic_id,
        target_duration: data.target_duration,
        time_slot: data.time_slot ?? null,
        plan_date: data.plan_date,
        goal_type: data.goal_type ?? null,
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
      })
      .eq('plan_id', planId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return plan
  }
}
