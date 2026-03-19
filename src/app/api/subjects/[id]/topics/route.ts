import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabase/server'
import { TopicsService } from '@/services/topics.service'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subjectId } = await params
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership of the subject
    const supabase = await createClient()
    const { data: subject } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .single()
      
    if (!subject || subject.user_id !== session.user.id) {
       return NextResponse.json({ error: 'Unauthorized or Subject not found' }, { status: 403 })
    }

    const topics = await TopicsService.getTopicsBySubject(subjectId)

    return NextResponse.json({ topics }, { status: 200 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subjectId } = await params
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const supabase = await createClient()
    const { data: subject } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .single()
      
    if (!subject || subject.user_id !== session.user.id) {
       return NextResponse.json({ error: 'Unauthorized or Subject not found' }, { status: 403 })
    }

    const body = await request.json()
    const { topic_name, complexity } = body

    const topic = await TopicsService.createTopic({
      subject_id: subjectId,
      topic_name,
      complexity
    })

    return NextResponse.json({ topic }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
