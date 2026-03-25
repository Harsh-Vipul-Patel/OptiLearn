import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function resolveSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, key }
}

/**
 * Server-side Supabase client.
 * Uses SUPABASE_URL / SUPABASE_ANON_KEY (no NEXT_PUBLIC_ prefix)
 * so these values are never bundled into the browser JavaScript.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const { url: supabaseUrl, key: supabaseKey } = resolveSupabaseServerConfig()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase server configuration is missing')
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  })
}

export async function getServerSession() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const fallbackName =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User'
    return { user: { id: user.id, email: user.email, name: fallbackName } }
  } catch {
    return null
  }
}
