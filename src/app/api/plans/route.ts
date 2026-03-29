import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

import { PlansService } from '@/services/plans.service'

type SessionUser = { id: string; email?: string; name: string }

function isSessionMissingError(message: string) {
  const text = message.toLowerCase()
  return text.includes('auth session missing') || text.includes('jwt')
}

function isAuthNetworkError(message: string) {
  const text = message.toLowerCase()
  return text.includes('fetch failed') || text.includes('econnreset') || text.includes('etimedout') || text.includes('network')
}

async function getRouteSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      if (isSessionMissingError(error.message || '')) return null
      throw new Error(error.message)
    }

    if (!user) return null

    const fallbackName =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User'

    return { id: user.id, email: user.email, name: fallbackName }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isAuthNetworkError(message)) {
      throw new Error(`AUTH_NETWORK_ERROR: ${message}`)
    }
    throw error
  }
}

function handlePlansRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'

  if (message.toLowerCase().includes('auth_network_error')) {
    return NextResponse.json({ error: 'Auth service temporarily unavailable. Please retry.' }, { status: 503 })
  }

  return NextResponse.json({ error: message }, { status: 400 })
}

function normalizeTimeSlot(value?: string | null) {
  if (!value) return null

  const normalized = value.toLowerCase()
  if (normalized === 'morning' || normalized === 'afternoon' || normalized === 'evening' || normalized === 'night') {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }

  // Convert planner timeline hour (HH:MM) into enum expected by DB.
  const hour = Number(value.split(':')[0])
  if (!Number.isFinite(hour)) return null
  if (hour >= 4 && hour < 11) return 'Morning'
  if (hour >= 11 && hour < 16) return 'Afternoon'
  if (hour >= 16 && hour < 20) return 'Evening'
  return 'Night'
}

export async function GET(request: Request) {
  try {
    const user = await getRouteSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const includeLoggedParam = searchParams.get('include_logged')
    const includeLogged = includeLoggedParam == null ? true : includeLoggedParam === 'true'

    const plans = await PlansService.getPlans(user.id, date, includeLogged)

    return NextResponse.json({ plans }, { status: 200 })
  } catch (error) {
    return handlePlansRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRouteSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    const body = await request.json()
    const { topic_id, target_duration, time_slot, plan_date, goal_type, start_time, end_time } = body

    if (!topic_id || !target_duration || !plan_date) {
      return NextResponse.json({ error: 'topic_id, target_duration and plan_date are required' }, { status: 400 })
    }

    let resolvedTopicId = topic_id as string

    // Planner quick-add can send a subject id in topic_id.
    // If so, resolve or create a default topic for that subject.
    const { data: subjectFallback, error: subjectLookupError } = await supabase
      .from('subject')
      .select('subject_id, user_id')
      .eq('subject_id', topic_id)
      .maybeSingle()

    if (subjectLookupError && subjectLookupError.code !== 'PGRST116') {
      throw new Error(subjectLookupError.message)
    }

    if (subjectFallback) {
      if (subjectFallback.user_id !== user.id) {
        return NextResponse.json({ error: 'Invalid subject ownership' }, { status: 403 })
      }

      const { data: existingTopic, error: existingTopicError } = await supabase
        .from('study_topic')
        .select('topic_id')
        .eq('subject_id', subjectFallback.subject_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (existingTopicError && existingTopicError.code !== 'PGRST116') {
        throw new Error(existingTopicError.message)
      }

      if (existingTopic?.topic_id) {
        resolvedTopicId = existingTopic.topic_id
      } else {
        const { data: createdTopic, error: createTopicError } = await supabase
          .from('study_topic')
          .insert([
            {
              subject_id: subjectFallback.subject_id,
              topic_name: 'General Study',
              complexity: 'Medium',
            },
          ])
          .select('topic_id')
          .single()

        if (createTopicError) {
          throw new Error(createTopicError.message)
        }

        resolvedTopicId = createdTopic.topic_id
      }
    }

    const normalizedTimeSlot = normalizeTimeSlot(time_slot)

    // Prevent overlapping time ranges across ANY plan on the same date.
    // A topic can have multiple plans — only the time range must not overlap.
    if (start_time && end_time) {
      const { data: sameDatePlans, error: fetchErr } = await supabase
        .from('daily_plan')
        .select('plan_id, start_time, end_time')
        .eq('plan_date', plan_date)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null)

      if (fetchErr) throw new Error(fetchErr.message)

      const hasOverlap = (sameDatePlans || []).some((existing) => {
        // Two ranges overlap when: start1 < end2 AND start2 < end1
        return existing.start_time < end_time && start_time < existing.end_time
      })

      if (hasOverlap) {
        return NextResponse.json(
          { error: 'This time range overlaps with another planned session' },
          { status: 409 }
        )
      }
    }

    const plan = await PlansService.createPlan({
      topic_id: resolvedTopicId,
      target_duration,
      time_slot: normalizedTimeSlot || undefined,
      plan_date,
      goal_type,
      start_time: start_time || undefined,
      end_time: end_time || undefined,
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    return handlePlansRouteError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getRouteSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const { plan_id, topic_id, target_duration, time_slot, plan_date, goal_type } = body

    if (!plan_id || !topic_id || !target_duration || !plan_date) {
      return NextResponse.json({ error: 'plan_id, topic_id, target_duration and plan_date are required' }, { status: 400 })
    }

    const { data: planOwnership, error: planOwnershipError } = await supabase
      .from('daily_plan')
      .select(`
        plan_id,
        logs:study_log (log_id),
        studyTopic:study_topic (
          topic_id,
          subject:subject (user_id)
        )
      `)
      .eq('plan_id', plan_id)
      .maybeSingle()

    if (planOwnershipError && planOwnershipError.code !== 'PGRST116') {
      throw new Error(planOwnershipError.message)
    }

    if (!planOwnership?.plan_id) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const studyTopic = Array.isArray(planOwnership.studyTopic)
      ? planOwnership.studyTopic[0]
      : planOwnership.studyTopic
    const subjectOwner = Array.isArray(studyTopic?.subject)
      ? studyTopic.subject[0]
      : studyTopic?.subject

    if (subjectOwner?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (Array.isArray(planOwnership.logs) && planOwnership.logs.length > 0) {
      return NextResponse.json({ error: 'Cannot update a plan that already has a logged session' }, { status: 409 })
    }

    let resolvedTopicId = topic_id as string

    const { data: subjectFallback, error: subjectLookupError } = await supabase
      .from('subject')
      .select('subject_id, user_id')
      .eq('subject_id', topic_id)
      .maybeSingle()

    if (subjectLookupError && subjectLookupError.code !== 'PGRST116') {
      throw new Error(subjectLookupError.message)
    }

    if (subjectFallback) {
      if (subjectFallback.user_id !== user.id) {
        return NextResponse.json({ error: 'Invalid subject ownership' }, { status: 403 })
      }

      const { data: existingTopic, error: existingTopicError } = await supabase
        .from('study_topic')
        .select('topic_id')
        .eq('subject_id', subjectFallback.subject_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (existingTopicError && existingTopicError.code !== 'PGRST116') {
        throw new Error(existingTopicError.message)
      }

      if (existingTopic?.topic_id) {
        resolvedTopicId = existingTopic.topic_id
      } else {
        const { data: createdTopic, error: createTopicError } = await supabase
          .from('study_topic')
          .insert([
            {
              subject_id: subjectFallback.subject_id,
              topic_name: 'General Study',
              complexity: 'Medium',
            },
          ])
          .select('topic_id')
          .single()

        if (createTopicError) {
          throw new Error(createTopicError.message)
        }

        resolvedTopicId = createdTopic.topic_id
      }
    }

    const normalizedTimeSlot = normalizeTimeSlot(time_slot)
    const { start_time: bodyStartTime, end_time: bodyEndTime } = body

    // Prevent overlapping time ranges across ANY plan on the same date (excluding self).
    if (bodyStartTime && bodyEndTime) {
      const { data: sameDatePlans, error: fetchErr } = await supabase
        .from('daily_plan')
        .select('plan_id, start_time, end_time')
        .eq('plan_date', plan_date)
        .neq('plan_id', plan_id)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null)

      if (fetchErr) throw new Error(fetchErr.message)

      const hasOverlap = (sameDatePlans || []).some((existing) => {
        return existing.start_time < bodyEndTime && bodyStartTime < existing.end_time
      })

      if (hasOverlap) {
        return NextResponse.json(
          { error: 'This time range overlaps with another planned session' },
          { status: 409 }
        )
      }
    }

    const plan = await PlansService.updatePlan(plan_id, {
      topic_id: resolvedTopicId,
      target_duration,
      time_slot: normalizedTimeSlot,
      plan_date,
      goal_type: goal_type ?? null,
      start_time: bodyStartTime || null,
      end_time: bodyEndTime || null,
    })

    return NextResponse.json({ plan }, { status: 200 })
  } catch (error) {
    return handlePlansRouteError(error)
  }
}
