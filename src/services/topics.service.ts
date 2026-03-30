import { createClient } from '@/lib/supabase/server'

export class TopicsService {
  static async getTopicsBySubject(subjectId: string) {
    const { data, error } = await createClient()
      .from('study_topic')
      .select('*')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      
    if (error) throw new Error(error.message)
    return data
  }

  static async createTopic(data: { subject_id: string, topic_name: string, complexity?: string }) {
    const { data: topic, error } = await createClient()
      .from('study_topic')
      .insert([{
        subject_id: data.subject_id,
        topic_name: data.topic_name,
        complexity: data.complexity
      }])
      .select()
      .single()
      
    if (error) throw new Error(error.message)
    return topic
  }
}
