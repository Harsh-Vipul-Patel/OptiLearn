import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, type AuthUser } from '@/lib/auth/jwt'

import { PlansService } from '@/services/plans.service'

function normalizeTimeSlot(value?: string | null) {
  if (!value) return null

  const normalized = value.toLowerCase()
  if (normalized === 'morning' || normalized === 'afternoon' || normalized === 'evening' || normalized === 'night') {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }

  const hour = Number(value.split(':')[0])
  if (!Number.isFinite(hour)) return null
  if (hour >= 4 && hour < 11) return 'Morning'
  if (hour >= 11 && hour < 16) return 'Afternoon'
  if (hour >= 16 && hour < 20) return 'Evening'
  return 'Night'
}

function parseClockToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const timeSource = trimmed.includes('T') ? trimmed.split('T')[1] : trimmed
  const withoutZulu = timeSource.replace('Z', '')
  const withoutOffset = withoutZulu.split('+')[0].split('-')[0]
  const parts = withoutOffset.split(':')
  if (parts.length < 2) return null

  const hour = Number(parts[0])
  const minute = Number(parts[1])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  return hour * 60 + minute
}

function hasMinuteOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

function getRouteUser(request: Request): AuthUser | null {
  return getAuthUser(request)
}

export async function GET(request: Request) {
  try {
    const user = getRouteUser(request)
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const user = getRouteUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()

    const body = await request.json()
    const { topic_id, target_duration, time_slot, plan_date, goal_type, start_time, end_time } = body

    if (!topic_id || !target_duration || !plan_date) {
      return NextResponse.json({ error: 'topic_id, target_duration and plan_date are required' }, { status: 400 })
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

    if (start_time && end_time) {
      const requestedStart = parseClockToMinutes(start_time)
      const requestedEnd = parseClockToMinutes(end_time)

      if (requestedStart === null || requestedEnd === null) {
        return NextResponse.json({ error: 'Invalid start_time or end_time format' }, { status: 400 })
      }

      if (requestedStart >= requestedEnd) {
        return NextResponse.json({ error: 'end_time must be later than start_time' }, { status: 400 })
      }

      const { data: sameDatePlans, error: fetchErr } = await supabase
        .from('daily_plan')
        .select('plan_id, start_time, end_time')
        .eq('plan_date', plan_date)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null)

      if (fetchErr) throw new Error(fetchErr.message)

      const hasOverlap = (sameDatePlans || []).some((existing) => {
        const existingStart = parseClockToMinutes(existing.start_time)
        const existingEnd = parseClockToMinutes(existing.end_time)
        if (existingStart === null || existingEnd === null) return false

        return hasMinuteOverlap(requestedStart, requestedEnd, existingStart, existingEnd)
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = getRouteUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
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

    if (bodyStartTime && bodyEndTime) {
      const requestedStart = parseClockToMinutes(bodyStartTime)
      const requestedEnd = parseClockToMinutes(bodyEndTime)

      if (requestedStart === null || requestedEnd === null) {
        return NextResponse.json({ error: 'Invalid start_time or end_time format' }, { status: 400 })
      }

      if (requestedStart >= requestedEnd) {
        return NextResponse.json({ error: 'end_time must be later than start_time' }, { status: 400 })
      }

      const { data: sameDatePlans, error: fetchErr } = await supabase
        .from('daily_plan')
        .select('plan_id, start_time, end_time')
        .eq('plan_date', plan_date)
        .neq('plan_id', plan_id)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null)

      if (fetchErr) throw new Error(fetchErr.message)

      const hasOverlap = (sameDatePlans || []).some((existing) => {
        const existingStart = parseClockToMinutes(existing.start_time)
        const existingEnd = parseClockToMinutes(existing.end_time)
        if (existingStart === null || existingEnd === null) return false

        return hasMinuteOverlap(requestedStart, requestedEnd, existingStart, existingEnd)
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
