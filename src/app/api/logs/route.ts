import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { triggerEngineAnalysis } from '@/lib/engineClient'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data: log, error } = await supabase
    .from('study_logs')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 400 })

  // We need to fetch the related plan, topic, and subject to get complexity and category
  const { data: plan } = await supabase
    .from('daily_plans')
    .select(`
      target_duration,
      study_topics (
        complexity,
        subjects (
          category
        )
      )
    `)
    .eq('id', log.plan_id)
    .single()

  if (plan && plan.study_topics && plan.study_topics.subjects) {
    // Fire-and-forget engine analysis
    triggerEngineAnalysis({
      log_id: log.id,
      plan_id: log.plan_id,
      start_time: log.start_time,
      end_time: log.end_time,
      focus_level: log.focus_level,
      distractions: log.distractions || '',
      reflection: log.reflection || '',
      target_duration: plan.target_duration,
      subject_category: plan.study_topics.subjects.category || 'General',
      topic_complexity: plan.study_topics.complexity || 'Medium'
    }).catch(console.error)
  }

  return Response.json({ log_id: log.id }, { status: 201 })
}
