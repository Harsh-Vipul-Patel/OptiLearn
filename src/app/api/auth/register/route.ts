import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const body = await request.json()
  const { email, password, name, exam_type, preferred_time } = body

  // 1. Supabase auth signup
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        exam_type,
        preferred_time
      }
    }
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }

  // Note: the `public.users` record is auto-created by the Postgres trigger
  // `on_auth_user_created` defind in migration 001.

  return Response.json(
    { message: 'Registration successful! Check your email for verification.' },
    { status: 201 }
  )
}
