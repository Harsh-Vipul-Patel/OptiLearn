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
      .from('subjects')
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
    const { subject_name, category } = body

    if (!subject_name?.trim()) {
      return NextResponse.json({ error: 'subject_name is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: subject, error } = await supabase
      .from('subjects')
      .insert([{
        user_id: session.user.id,
        subject_name: subject_name.trim(),
        category: category?.trim() || null,
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
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'subject id required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
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
