import { createClient } from '@/lib/supabase/server'

export class SubjectsService {
  static async getSubjects(userId: string) {
    const { data, error } = await (await createClient())
      .from('subject')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      
    if (error) throw new Error(error.message)
    return data
  }

  static async createSubject(data: { user_id: string, subject_name: string, subject_category?: string, subject_color?: string }) {
    const { data: subject, error } = await (await createClient())
      .from('subject')
      .insert([{
        user_id: data.user_id,
        subject_name: data.subject_name,
        subject_category: data.subject_category,
        subject_color: data.subject_color
      }])
      .select()
      .single()
      
    if (error) throw new Error(error.message)
    return subject
  }

  static async deleteSubject(subjectId: string, userId: string) {
    const { data, error } = await (await createClient())
      .from('subject')
      .delete()
      .eq('subject_id', subjectId)
      .eq('user_id', userId)
      
    if (error) throw new Error(error.message)
    return data
  }
}
