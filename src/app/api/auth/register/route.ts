import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashPassword } from '@/lib/auth/password'
import { signToken, buildAuthCookie, type AuthUser } from '@/lib/auth/jwt'
import { validateEmail } from '@/lib/auth/email'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    const normalizedName = (name || '').trim()
    if (!normalizedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      return NextResponse.json({ error: emailValidation.error || 'Enter a valid email address.' }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 })
    }

    const supabase = createClient()

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', emailValidation.normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please log in.' }, { status: 409 })
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)
    const userId = crypto.randomUUID()

    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        user_id: userId,
        email: emailValidation.normalizedEmail,
        name: normalizedName,
        password_hash: passwordHash,
      }])
      .select('user_id, email, name')
      .single()

    if (error) {
      console.error('[auth/register]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Sign JWT and set cookie
    const authUser: AuthUser = { id: user.user_id, email: user.email, name: user.name }
    const token = signToken(authUser)

    const response = NextResponse.json({ user: authUser }, { status: 201 })
    response.headers.set('Set-Cookie', buildAuthCookie(token))
    return response
  } catch (error) {
    console.error('[auth/register]', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
