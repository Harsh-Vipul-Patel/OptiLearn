import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('topic_dependency')
      .select(`
        dependency_id,
        parent_topic:study_topic!parent_topic_id(topic_id, topic_name, subject_id),
        child_topic:study_topic!child_topic_id(topic_id, topic_name, subject_id)
      `)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ dependencies: data }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { parent_topic_id, child_topic_id } = await request.json()

    if (!parent_topic_id || !child_topic_id || parent_topic_id === child_topic_id) {
      return NextResponse.json({ error: 'Invalid dependency parameters' }, { status: 400 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('topic_dependency')
      .insert([{ user_id: user.id, parent_topic_id, child_topic_id }])
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ dependency: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dependency_id = searchParams.get('id')
    
    if (!dependency_id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const supabase = createClient()
    const { error } = await supabase
      .from('topic_dependency')
      .delete()
      .eq('dependency_id', dependency_id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
