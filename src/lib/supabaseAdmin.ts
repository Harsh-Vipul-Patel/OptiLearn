import { createClient } from '@supabase/supabase-js'

// NEVER expose this to the browser
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // bypasses RLS
)
