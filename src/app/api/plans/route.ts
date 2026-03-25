import { NextResponse } from 'next/server'
import { createClient, getServerSession } from '@/lib/supabase/server'

import { PlansService } from '@/services/plans.service'

function normalizeTimeSlot(value?: string | null) {
  if (!value) return null

  const normalized = value.toLowerCase()
  if (normalized === 'morning' || normalized === 'afternoon' || normalized === 'evening' || normalized === 'night') {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }

  // Convert planner timeline hour (HH:MM) into enum expected by DB.
  const hour = Number(value.split(':')[0])
  if (!Number.isFinite(hour)) return null
  if (hour >= 5 && hour < 12) return 'Morning'
  if (hour >= 12 && hour < 17) return 'Afternoon'
  if (hour >= 17 && hour < 22) return 'Evening'
  return 'Night'
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const includeLoggedParam = searchParams.get('include_logged')
    const includeLogged = includeLoggedParam == null ? true : includeLoggedParam === 'true'

    const plans = await PlansService.getPlans(session.user.id, date, includeLogged)

    return NextResponse.json({ plans }, { status: 200 })
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

    const body = await request.json()
    const { topic_id, target_duration, time_slot, plan_date, goal_type } = body

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
      if (subjectFallback.user_id !== session.user.id) {
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

    // Prevent duplicate plan entries for the same topic/date/time slot.
    let duplicateQuery = supabase
      .from('daily_plan')
      .select('plan_id')
      .eq('topic_id', resolvedTopicId)
      .eq('plan_date', plan_date)

    if (normalizedTimeSlot) {
      duplicateQuery = duplicateQuery.eq('time_slot', normalizedTimeSlot)
    } else {
      duplicateQuery = duplicateQuery.is('time_slot', null)
    }

    const duplicateCheck = await duplicateQuery.limit(1).maybeSingle()
    if (duplicateCheck.error && duplicateCheck.error.code !== 'PGRST116') {
      throw new Error(duplicateCheck.error.message)
    }

    if (duplicateCheck.data?.plan_id) {
      return NextResponse.json({ error: 'Plan already exists for this topic and time slot' }, { status: 409 })
    }

    const plan = await PlansService.createPlan({
      topic_id: resolvedTopicId,
      target_duration,
      time_slot: normalizedTimeSlot || undefined,
      plan_date,
      goal_type
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
