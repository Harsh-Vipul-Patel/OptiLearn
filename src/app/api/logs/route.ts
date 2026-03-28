import { NextResponse } from 'next/server'
import { createClient, getServerSession } from '@/lib/supabase/server'

import { LogsService } from '@/services/logs.service'
import { triggerEngineAnalysis } from '@/lib/engineClient'

const isLevelInRange = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5

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
        console.error('[logs/POST - user upsert]', userError)
      }
    } else {
      console.warn('[logs/POST] session user has no email; skipping users upsert')
    }

    const body = await request.json()

    const focusLevel = Number(body?.focus_level)
    const fatigueLevel = Number(body?.fatigue_level)

    if (!body?.plan_id || !body?.start_time || !body?.end_time) {
      return NextResponse.json({ error: 'Missing required fields: plan_id, start_time, end_time' }, { status: 400 })
    }

    if (!isLevelInRange(focusLevel) || !isLevelInRange(fatigueLevel)) {
      return NextResponse.json({ error: 'focus_level and fatigue_level must be integers between 1 and 5' }, { status: 400 })
    }

    const now = new Date()
    const sessionStartTime = new Date(body.start_time)
    const sessionEndTime = new Date(body.end_time)

    if (Number.isNaN(sessionStartTime.getTime()) || Number.isNaN(sessionEndTime.getTime())) {
      return NextResponse.json({ error: 'Invalid start_time or end_time' }, { status: 400 })
    }

    if (sessionStartTime >= sessionEndTime) {
      return NextResponse.json({ error: 'end_time must be later than start_time' }, { status: 400 })
    }

    // Validate: Session should not be in the future
    if (sessionStartTime > now) {
      return NextResponse.json({ error: 'Cannot log a session that starts in the future' }, { status: 400 })
    }

    // Validate: Session end time should not be in the future
    if (sessionEndTime > now) {
      return NextResponse.json({ error: 'Session end time cannot be in the future' }, { status: 400 })
    }

    // Validate: Check if another session is already logged for the same time slot
    const { data: plan, error: planError } = await supabase
      .from('daily_plan')
      .select('plan_id, plan_date, time_slot')
      .eq('plan_id', body.plan_id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const userLogs = await LogsService.getLogs(session.user.id)
    const hasOverlap = userLogs.some((entry) => {
      const existingStart = new Date(String((entry as { start_time?: string }).start_time || ''))
      const existingEnd = new Date(String((entry as { end_time?: string }).end_time || ''))
      if (Number.isNaN(existingStart.getTime()) || Number.isNaN(existingEnd.getTime())) return false
      return sessionStartTime < existingEnd && existingStart < sessionEndTime
    })

    if (hasOverlap) {
      return NextResponse.json({ error: 'This session overlaps with an already logged session' }, { status: 409 })
    }

    const payload = {
      plan_id: body.plan_id,
      start_time: body.start_time,
      end_time: body.end_time,
      focus_level: focusLevel,
      fatigue_level: fatigueLevel,
      distractions: body.distractions ?? '',
      reflection: body.reflection ?? null,
    }

    const log = await LogsService.createLog(payload)

    // Fire-and-forget engine analysis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planDetails: any = await LogsService.getPlanDetailsForAnalysis(log.plan_id)

    if (planDetails && planDetails.studyTopic && planDetails.studyTopic.subject) {
      const startTimeISO = new Date(log.start_time).toISOString()
      const endTimeISO = new Date(log.end_time).toISOString()

      triggerEngineAnalysis({
        log_id: log.log_id,
        user_id: session.user.id,
        plan_id: log.plan_id,
        start_time: startTimeISO,
        end_time: endTimeISO,
        focus_level: log.focus_level,
        distractions: log.distractions || '',
        reflection: log.reflection || '',
        target_duration: planDetails.target_duration,
        subject_category: planDetails.studyTopic.subject.subject_category || 'General',
        topic_complexity: planDetails.studyTopic.complexity || 'Medium'
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
