import { createClient } from '@/lib/supabase/server'

export class LogsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async createLog(data: any, userId: string) {
    const { data: log, error } = await (await createClient())
      .from('study_logs')
      .insert([{
        ...data,
        user_id: userId
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return log
  }

  static async getLogs(userId: string) {
    const { data, error } = await (await createClient())
      .from('study_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  }

  static async getPlanDetailsForAnalysis(planId: string) {
    const { data: plan, error } = await (await createClient())
      .from('daily_plans')
      .select(`
        target_duration,
        studyTopic:study_topics (
          complexity,
          subject:subjects (
            category
          )
        )
      `)
      .eq('id', planId)
      .single()

    if (error) throw new Error(error.message)
    return plan
  }
}
