import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  let query = supabase.from('daily_plans').select('*, study_topics(*)').eq('user_id', user.id)
  
  if (date) {
    query = query.eq('plan_date', date)
  }

  const { data: plans, error } = await query.order('time_slot', { ascending: true })

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json({ plans }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { topic_id, target_duration, time_slot, plan_date } = body

  const { data: plan, error } = await supabase
    .from('daily_plans')
    .insert({
      user_id: user.id,
      topic_id,
      target_duration,
      time_slot,
      plan_date
    })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json({ plan }, { status: 201 })
}
