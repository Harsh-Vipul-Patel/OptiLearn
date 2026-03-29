import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmailLocalPart, getFallbackUserEmail } from '@/lib/auth/email'

const VALID_EXAM_TYPES = new Set(['JEE', 'NEET', 'Boards', 'Others'])
const VALID_PREFERRED_TIMES = new Set(['Morning', 'Afternoon', 'Evening', 'Night'])

function normalizeExamType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const lower = raw.toLowerCase()
  if (lower === 'jee') return 'JEE'
  if (lower === 'neet') return 'NEET'
  if (lower === 'boards' || lower === 'board') return 'Boards'
  if (lower === 'others' || lower === 'other') return 'Others'

  return VALID_EXAM_TYPES.has(raw) ? raw : 'Others'
}

function normalizePreferredTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const lower = raw.toLowerCase()
  if (lower === 'morning') return 'Morning'
  if (lower === 'afternoon') return 'Afternoon'
  if (lower === 'evening') return 'Evening'
  if (lower === 'night') return 'Night'

  return VALID_PREFERRED_TIMES.has(raw) ? raw : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fallbackEmail = getFallbackUserEmail(user.id, user.email)
    const fallbackName =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      getEmailLocalPart(fallbackEmail) ||
      'User'

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
    const normalizedEmail = getFallbackUserEmail(user.id, user.email)
    const normalizedName =
      (typeof name === 'string' ? name.trim() : '') ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      getEmailLocalPart(normalizedEmail) ||
      'User'
    const normalizedExamType = normalizeExamType(exam_type)
    const normalizedPreferredTime = normalizePreferredTime(preferred_time)

    // Keep both metadata keys in sync so all auth providers resolve the same display name.
    if (normalizedName) {
      await supabase.auth.updateUser({ data: { name: normalizedName, full_name: normalizedName } })
    }

    // Upsert ensures the profile row exists even for first-time users.
    const { data: profile, error } = await supabase
      .from('users')
      .upsert(
        [{
          user_id: user.id,
          email: normalizedEmail,
          name: normalizedName,
          exam_type: normalizedExamType,
          preferred_study_time: normalizedPreferredTime,
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
