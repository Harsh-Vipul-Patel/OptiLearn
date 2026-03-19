import { createClient } from '@/lib/supabase/server'

export class SubjectsService {
  static async getSubjects(userId: string) {
    const { data, error } = await (await createClient())
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      
    if (error) throw new Error(error.message)
    return data
  }

  static async createSubject(data: { user_id: string, subject_name: string, category?: string }) {
    const { data: subject, error } = await (await createClient())
      .from('subjects')
      .insert([{
        user_id: data.user_id,
        subject_name: data.subject_name,
        category: data.category
      }])
      .select()
      .single()
      
    if (error) throw new Error(error.message)
    return subject
  }

  static async deleteSubject(id: string, userId: string) {
    const { data, error } = await (await createClient())
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      
    if (error) throw new Error(error.message)
    return data
  }
}
