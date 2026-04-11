import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('study_topic')
      .select('topic_id, topic_name, subject:subject!inner(subject_id, subject_name, user_id)')
      .eq('subject.user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Flatten for simple UI consumption
    const topics = (data ?? []).map((t: any) => ({
      topic_id: t.topic_id,
      topic_name: t.topic_name,
      subject_name: Array.isArray(t.subject) ? t.subject[0].subject_name : t.subject?.subject_name
    }))

    return NextResponse.json({ topics }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
