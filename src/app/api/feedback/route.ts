import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabase/server'

import { FeedbackService } from '@/services/feedback.service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { suggestion_id, reaction } = await request.json()
    
    const feedback = await FeedbackService.submitFeedback(suggestion_id, reaction)

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
