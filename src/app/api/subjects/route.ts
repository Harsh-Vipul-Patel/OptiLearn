import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(_request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json({ subjects }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { subject_name, category } = body

  const { data: subject, error } = await supabase
    .from('subjects')
    .insert({
      user_id: user.id,
      subject_name,
      category
    })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json({ subject }, { status: 201 })
}
