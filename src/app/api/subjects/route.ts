import { NextResponse } from 'next/server'
import { createClient, getServerSession } from '@/lib/supabase/server'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('subject')
      .select('*')
      .eq('user_id', session.user.id)
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
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject_name, subject_category, subject_color } = body

    if (!subject_name?.trim()) {
      return NextResponse.json({ error: 'subject_name is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Keep public.users in sync for FK/RLS dependencies.
    if (session.user.email) {
      const { error: userError } = await supabase
        .from('users')
        .upsert(
          [{
            user_id: session.user.id,
            email: session.user.email,
            name: session.user.name || session.user.email || 'User',
          }],
          { onConflict: 'user_id' }
        )

      if (userError) {
        console.error('[subjects/POST - user upsert]', userError)
      }
    } else {
      console.warn('[subjects/POST] session user has no email; skipping users upsert')
    }

    const { data: subject, error } = await supabase
      .from('subject')
      .insert([{
        user_id: session.user.id,
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
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('id')
    if (!subjectId) {
      return NextResponse.json({ error: 'subject id required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('subject')
      .delete()
      .eq('subject_id', subjectId)
      .eq('user_id', session.user.id)

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
