import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { createClient } from '@/lib/supabase/server'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
}

export async function GET(request: Request) {
  const jwtUser = getAuthUser(request)

  if (!jwtUser) {
    return NextResponse.json({ user: null }, { status: 401, headers: NO_STORE_HEADERS })
  }

  // Fetch the latest name/email from the database so the sidebar stays in sync
  try {
    const supabase = createClient()
    const { data: dbUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('user_id', jwtUser.id)
      .maybeSingle()

    if (dbUser) {
      return NextResponse.json({
        user: {
          id: jwtUser.id,
          email: dbUser.email || jwtUser.email,
          name: dbUser.name || jwtUser.name,
        },
      }, { headers: NO_STORE_HEADERS })
    }
  } catch {
    // If DB lookup fails, fall back to JWT data
  }

  return NextResponse.json({ user: jwtUser }, { headers: NO_STORE_HEADERS })
}
