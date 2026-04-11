import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { RecallService } from '@/services/recall.service'

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { topic_id, responses } = body

    if (!topic_id || !Array.isArray(responses)) {
      return NextResponse.json({ error: 'Missing topic_id or responses array' }, { status: 400 })
    }

    const session = await RecallService.submitSession({
      user_id: user.id,
      topic_id,
      responses,
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
