import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { getEmailLocalPart, getFallbackUserEmail } from '@/lib/auth/email'

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('subject')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[subjects/GET]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ subjects: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error('[subjects/GET] unexpected:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject_name, subject_category, subject_color } = body

    if (!subject_name?.trim()) {
      return NextResponse.json({ error: 'subject_name is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Keep public.users in sync for FK dependencies.
    const normalizedEmail = getFallbackUserEmail(user.id, user.email)
    const normalizedName = (user.name || '').trim() || getEmailLocalPart(normalizedEmail) || 'User'
    const { error: userError } = await supabase
      .from('users')
      .upsert(
        [{
          user_id: user.id,
          email: normalizedEmail,
          name: normalizedName,
        }],
        { onConflict: 'user_id' }
      )

    if (userError) {
      console.error('[subjects/POST - user upsert]', userError)
    }

    const { data: subject, error } = await supabase
      .from('subject')
      .insert([{
        user_id: user.id,
        subject_name: subject_name.trim(),
        subject_category: subject_category?.trim() || null,
        subject_color: typeof subject_color === 'string' ? subject_color.trim() : null,
      }])
      .select()
      .single()

    if (error) {
      console.error('[subjects/POST]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ subject }, { status: 201 })
  } catch (error) {
    console.error('[subjects/POST] unexpected:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('id')
    if (!subjectId) {
      return NextResponse.json({ error: 'subject id required' }, { status: 400 })
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('subject')
      .delete()
      .eq('subject_id', subjectId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[subjects/DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[subjects/DELETE] unexpected:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
