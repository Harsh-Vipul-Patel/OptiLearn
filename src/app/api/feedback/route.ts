import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { suggestion_id, reaction } = body

  const { data: feedback, error } = await supabase
    .from('feedback')
    .insert({
      suggestion_id,
      reaction
    })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json({ feedback }, { status: 201 })
}
