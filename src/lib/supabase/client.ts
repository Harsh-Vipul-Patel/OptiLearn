import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Client-side Supabase client for direct DB queries (if needed).
 * Auth is handled by our JWT system, not Supabase Auth.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
