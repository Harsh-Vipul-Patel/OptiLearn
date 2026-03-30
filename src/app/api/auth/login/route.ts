import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { signToken, buildAuthCookie, type AuthUser } from '@/lib/auth/jwt'
import { validateEmail } from '@/lib/auth/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      return NextResponse.json({ error: emailValidation.error || 'Enter a valid email address.' }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
    }

    const supabase = createClient()

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email, name, password_hash')
      .eq('email', emailValidation.normalizedEmail)
      .maybeSingle()

    if (error) {
      console.error('[auth/login] DB error:', error)
      return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }

    // For users who signed up via Google OAuth (no password set yet)
    if (!user.password_hash) {
      // This is a migrated user — let them set their password on first login
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 })
      }

      const newHash = await hashPassword(password)
      await supabase
        .from('users')
        .update({ password_hash: newHash })
        .eq('user_id', user.user_id)

      // Sign JWT and set cookie — they're now logged in with their new password
      const authUser: AuthUser = { id: user.user_id, email: user.email, name: user.name || 'User' }
      const token = signToken(authUser)

      const response = NextResponse.json({ user: authUser, message: 'Password set successfully. You are now logged in.' }, { status: 200 })
      response.headers.set('Set-Cookie', buildAuthCookie(token))
      return response
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }

    // Sign JWT and set cookie
    const authUser: AuthUser = { id: user.user_id, email: user.email, name: user.name || 'User' }
    const token = signToken(authUser)

    const response = NextResponse.json({ user: authUser }, { status: 200 })
    response.headers.set('Set-Cookie', buildAuthCookie(token))
    return response
  } catch (error) {
    console.error('[auth/login]', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
