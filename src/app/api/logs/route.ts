import { NextResponse } from 'next/server'
import { createClient, getServerSession } from '@/lib/supabase/server'

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

    const supabase = await createClient()

    // Ensure user exists in public.users table
    const { error: userError } = await supabase
      .from('users')
      .insert([{ 
        user_id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email || 'User'
      }])
      .select()
      .single()

    if (userError && !userError.message.includes('violates unique constraint')) {
      console.error('[logs/POST - user creation]', userError)
    }

    const body = await request.json()
    const log = await LogsService.createLog(body)

    // Fire-and-forget engine analysis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan: any = await LogsService.getPlanDetailsForAnalysis(log.plan_id)

    if (plan && plan.studyTopic && plan.studyTopic.subject) {
      triggerEngineAnalysis({
        log_id: log.log_id,
        user_id: session.user.id,
        plan_id: log.plan_id,
        start_time: log.start_time.toISOString(),
        end_time: log.end_time.toISOString(),
        focus_level: log.focus_level,
        distractions: log.distractions || '',
        reflection: log.reflection || '',
        target_duration: plan.target_duration,
        subject_category: plan.studyTopic.subject.subject_category || 'General',
        topic_complexity: plan.studyTopic.complexity || 'Medium'
      }).catch(console.error)
    }

    return NextResponse.json({ log_id: log.log_id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
