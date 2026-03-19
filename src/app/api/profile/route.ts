import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error

    // If public.users.name is blank, fall back to auth metadata (e.g. from signup form)
    if (profile && !profile.name) {
      profile.name = user.user_metadata?.name || user.user_metadata?.full_name || ''
    }

    return NextResponse.json({ profile }, { status: 200 })
  } catch (error) {
    console.error('[profile/GET]', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, exam_type, preferred_time } = await request.json()

    // Optionally update auth user meta-data
    if (name) {
      await supabase.auth.updateUser({ data: { name } })
    }

    // Update public.users
    const { data: profile, error } = await supabase
      .from('users')
      .update({ name, exam_type, preferred_time })
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ profile }, { status: 200 })
  } catch (error) {
    console.error('[profile/PUT]', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
