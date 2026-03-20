import { NextResponse } from 'next/server'
import { createClient, getServerSession } from '@/lib/supabase/server'

import { PlansService } from '@/services/plans.service'

export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    const plans = await PlansService.getPlans(session.user.id, date)

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
      console.error('[plans/POST - user creation]', userError)
    }

    const body = await request.json()
    const { topic_id, target_duration, time_slot, plan_date, goal_type } = body

    const plan = await PlansService.createPlan({
      topic_id,
      target_duration,
      time_slot,
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
