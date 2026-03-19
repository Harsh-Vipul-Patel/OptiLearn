import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabase/server'

import { InsightsService } from '@/services/insights.service'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const suggestions = await InsightsService.getSuggestions(session.user.id)

    return NextResponse.json({ suggestions }, { status: 200 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 400 })
  }
}
