import { createClient } from '@/lib/supabase/server'

export interface ExamGoal {
  exam_goal_id: string
  user_id: string
  subject_id: string
  exam_name: string
  exam_date: string
  target_hours: number
  created_at: string
  updated_at: string
  // Joined fields
  subject?: {
    subject_id: string
    subject_name: string
  }
}

export class ExamGoalService {
  static async getGoals(userId: string): Promise<ExamGoal[]> {
    const { data, error } = await createClient()
      .from('exam_goal')
      .select(`
        *,
        subject:subject (
          subject_id,
          subject_name
        )
      `)
      .eq('user_id', userId)
      .order('exam_date', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as ExamGoal[]
  }

  static async createGoal(payload: {
    user_id: string
    subject_id: string
    exam_name: string
    exam_date: string
    target_hours: number
  }) {
    const { data, error } = await createClient()
      .from('exam_goal')
      .insert([payload])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  static async updateGoal(examGoalId: string, userId: string, payload: Partial<{
    exam_name: string
    exam_date: string
    target_hours: number
  }>) {
    const { data, error } = await createClient()
      .from('exam_goal')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('exam_goal_id', examGoalId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  static async deleteGoal(examGoalId: string, userId: string) {
    const { error } = await createClient()
      .from('exam_goal')
      .delete()
      .eq('exam_goal_id', examGoalId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }
}
