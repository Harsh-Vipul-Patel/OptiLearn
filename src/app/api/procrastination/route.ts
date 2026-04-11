import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/jwt'

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()

    // Query the procrastination view
    const { data, error } = await supabase
      .from('vw_procrastination_stats')
      .select('*')
      .eq('user_id', user.id)
      .in('procrastination_status', ['skipped', 'abandoned'])
      .order('plan_date', { ascending: false })
      .limit(20)

    if (error) {
      // Graceful fallback if the view hasn't been created yet
      console.warn('[procrastination] View not ready:', error.message)
      return NextResponse.json(
        { skipped: [], score: 0, risk: 'Low', viewReady: false },
        { status: 200 }
      )
    }

    const skipped = data ?? []

    // Compute score: get total past plan count for ratio
    const { count: totalCount } = await supabase
      .from('vw_procrastination_stats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const total = totalCount ?? skipped.length
    const score = total > 0 ? Math.round((skipped.length / total) * 100) : 0
    const risk: 'Low' | 'Medium' | 'High' =
      score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low'

    return NextResponse.json({ skipped, score, risk, viewReady: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
