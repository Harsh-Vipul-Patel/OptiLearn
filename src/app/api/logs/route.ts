import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabase/server'

import { LogsService } from '@/services/logs.service'
import { triggerEngineAnalysis } from '@/lib/engineClient'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logs = await LogsService.getLogs(session.user.id)

    return NextResponse.json({ logs }, { status: 200 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const log = await LogsService.createLog(body, session.user.id)

    // Fire-and-forget engine analysis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan: any = await LogsService.getPlanDetailsForAnalysis(log.plan_id)

    if (plan && plan.studyTopic && plan.studyTopic.subject) {
      triggerEngineAnalysis({
        log_id: log.id,
        user_id: session.user.id,
        plan_id: log.plan_id,
        start_time: log.start_time.toISOString(),
        end_time: log.end_time.toISOString(),
        focus_level: log.focus_level,
        distractions: log.distractions || '',
        reflection: log.reflection || '',
        target_duration: plan.target_duration,
        subject_category: plan.studyTopic.subject.category || 'General',
        topic_complexity: plan.studyTopic.complexity || 'Medium'
      }).catch(console.error)
    }

    return NextResponse.json({ log_id: log.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
