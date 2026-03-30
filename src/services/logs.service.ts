import { createClient } from '@/lib/supabase/server'

type LogWithOwnership = {
  dailyPlan?: {
    studyTopic?: {
      subject?: {
        user_id?: string
      }
    }
  }
}

export class LogsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async createLog(data: any) {
    const { data: log, error } = await createClient()
      .from('study_log')
      .insert([data])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return log
  }

  static async getLogs(userId: string) {
    const { data, error } = await createClient()
      .from('study_log')
      .select(`
        *,
        dailyPlan:daily_plan (
          plan_id,
          plan_date,
          time_slot,
          topic_id,
          studyTopic:study_topic (
            subject_id,
            subject:subject (
              user_id,
              subject_name
            )
          )
        )
      `)
      // Filter by user through relation chain
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    // Filter in JS to ensure user_id ownership
    return (data as LogWithOwnership[] | null)?.filter((log) => log.dailyPlan?.studyTopic?.subject?.user_id === userId) || []
  }

  static async getPlanDetailsForAnalysis(planId: string) {
    const { data: plan, error } = await createClient()
      .from('daily_plan')
      .select(`
        target_duration,
        studyTopic:study_topic (
          complexity,
          subject:subject (
            subject_category
          )
        )
      `)
      .eq('plan_id', planId)
      .single()

    if (error) throw new Error(error.message)
    return plan
  }
}
