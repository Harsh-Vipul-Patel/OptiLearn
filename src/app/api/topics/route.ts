import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { TopicsService } from '@/services/topics.service'

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subject_id')

    if (!subjectId) {
      return NextResponse.json({ error: 'Missing subject_id' }, { status: 400 })
    }

    const topics = await TopicsService.getTopicsBySubject(subjectId)
    return NextResponse.json({ topics }, { status: 200 })
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

    const body = await request.json()
    const { subject_id, topic_name, complexity } = body

    if (!subject_id || !topic_name) {
      return NextResponse.json({ error: 'Missing subject_id or topic_name' }, { status: 400 })
    }

    const topic = await TopicsService.createTopic({ subject_id, topic_name, complexity })
    return NextResponse.json({ topic }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
