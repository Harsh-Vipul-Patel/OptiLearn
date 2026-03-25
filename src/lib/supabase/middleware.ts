import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function resolveSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, key }
}

/**
 * Middleware Supabase client.
 * Uses SUPABASE_URL / SUPABASE_ANON_KEY (no NEXT_PUBLIC_ prefix)
 * so credentials are never bundled into the browser JavaScript.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { url: supabaseUrl, key: supabaseKey } = resolveSupabaseServerConfig()

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh session if expired. Network issues should not break all matched routes.
  try {
    await supabase.auth.getUser()
  } catch {
    return supabaseResponse
  }

  return supabaseResponse
}
