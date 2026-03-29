import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (!error) {
          return NextResponse.redirect(`${origin}${next}`)
        }

        // If it's a non-retryable error (e.g. invalid code), break immediately
        if (error.message?.includes('invalid') || error.message?.includes('expired')) {
          break
        }
      } catch {
        // Supabase temporarily unreachable — retry
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500))
      }
    }
  }

  // Return the user to the login page with a descriptive error
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
