import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const subjectId = params.id
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS ensures they can only view topics from subject they own
  const { data: topics, error } = await supabase
    .from('study_topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json({ topics }, { status: 200 })
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const subjectId = params.id
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { topic_name, complexity } = body

  const { data: topic, error } = await supabase
    .from('study_topics')
    .insert({
      subject_id: subjectId,
      topic_name,
      complexity
    })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json({ topic }, { status: 201 })
}
