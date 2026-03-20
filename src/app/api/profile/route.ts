import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fallbackName =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User'
    const fallbackEmail = user.email || `${user.id}@local.invalid`

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error

    let resolvedProfile = profile

    if (!resolvedProfile) {
      const { data: createdProfile, error: createError } = await supabase
        .from('users')
        .upsert(
          [{
            user_id: user.id,
            email: fallbackEmail,
            name: fallbackName,
          }],
          { onConflict: 'user_id' }
        )
        .select('*')
        .single()

      if (createError) throw createError
      resolvedProfile = createdProfile
    }

    // If public.users.name is blank, fall back to auth metadata (e.g. from signup form)
    if (resolvedProfile && !resolvedProfile.name) {
      resolvedProfile.name = fallbackName
    }

    if (resolvedProfile) {
      resolvedProfile.preferred_time = resolvedProfile.preferred_study_time || ''
    }

    return NextResponse.json({ profile: resolvedProfile }, { status: 200 })
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
    const normalizedName = (name || '').trim() || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
    const normalizedEmail = user.email || `${user.id}@local.invalid`

    // Optionally update auth user meta-data
    if (normalizedName) {
      await supabase.auth.updateUser({ data: { name: normalizedName } })
    }

    // Upsert ensures the profile row exists even for first-time users.
    const { data: profile, error } = await supabase
      .from('users')
      .upsert(
        [{
          user_id: user.id,
          email: normalizedEmail,
          name: normalizedName,
          exam_type,
          preferred_study_time: preferred_time || null,
        }],
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) throw error

    if (profile) {
      profile.preferred_time = profile.preferred_study_time || ''
    }

    return NextResponse.json({ profile }, { status: 200 })
  } catch (error) {
    console.error('[profile/PUT]', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
