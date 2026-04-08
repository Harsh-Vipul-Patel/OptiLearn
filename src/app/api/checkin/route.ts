import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { CheckinService } from '@/services/checkin.service'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
}

/**
 * GET /api/checkin — Returns today's check-in for the authenticated user.
 * Returns { checkin: null } if not yet completed today.
 */
export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const checkin = await CheckinService.getTodayCheckin(user.id)
    return NextResponse.json({ checkin }, { status: 200, headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[checkin/GET]', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400, headers: NO_STORE_HEADERS })
  }
}

/**
 * POST /api/checkin — Create or update today's wellness check-in.
 * Body: { sleep_hours, sleep_quality, energy_level, stress_level, mood, exercised_today, had_meal, screen_time_last_night, notes? }
 */
export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const body = await request.json()

    // Validate required fields
    const {
      sleep_hours,
      sleep_quality,
      energy_level,
      stress_level,
      mood,
      exercised_today,
      had_meal,
      screen_time_last_night,
      notes,
    } = body

    if (sleep_hours === undefined || sleep_hours === null) {
      return NextResponse.json({ error: 'sleep_hours is required' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (!sleep_quality || sleep_quality < 1 || sleep_quality > 5) {
      return NextResponse.json({ error: 'sleep_quality must be between 1 and 5' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (!energy_level || energy_level < 1 || energy_level > 5) {
      return NextResponse.json({ error: 'energy_level must be between 1 and 5' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (!stress_level || stress_level < 1 || stress_level > 5) {
      return NextResponse.json({ error: 'stress_level must be between 1 and 5' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const validMoods = ['Great', 'Good', 'Okay', 'Low', 'Bad']
    if (!mood || !validMoods.includes(mood)) {
      return NextResponse.json({ error: 'mood must be one of: Great, Good, Okay, Low, Bad' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const validScreenTime = ['Low', 'Moderate', 'High']
    if (!screen_time_last_night || !validScreenTime.includes(screen_time_last_night)) {
      return NextResponse.json({ error: 'screen_time_last_night must be one of: Low, Moderate, High' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const checkin = await CheckinService.upsertTodayCheckin(user.id, {
      sleep_hours: Number(sleep_hours),
      sleep_quality: Number(sleep_quality),
      energy_level: Number(energy_level),
      stress_level: Number(stress_level),
      mood,
      exercised_today: Boolean(exercised_today),
      had_meal: Boolean(had_meal),
      screen_time_last_night,
      notes: notes || undefined,
    })

    return NextResponse.json({ checkin }, { status: 201, headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[checkin/POST]', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400, headers: NO_STORE_HEADERS })
  }
}
