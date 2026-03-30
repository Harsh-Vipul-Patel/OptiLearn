import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signToken, buildAuthCookie, type AuthUser } from '@/lib/auth/jwt'
import crypto from 'crypto'

interface GoogleTokenPayload {
  sub: string
  email: string
  email_verified: boolean | string
  name: string
  picture?: string
  aud?: string
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)

    if (!res.ok) {
      const text = await res.text()
      console.error('[auth/google] Google token verification HTTP error:', res.status, text)
      return null
    }

    const payload = await res.json()
    console.log('[auth/google] Google token payload:', JSON.stringify({
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
      aud: payload.aud?.substring(0, 20) + '...',
    }))

    // Verify the token is for our app
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (clientId && payload.aud !== clientId) {
      console.error('[auth/google] Token audience mismatch. Expected:', clientId?.substring(0, 20) + '...', 'Got:', payload.aud?.substring(0, 20) + '...')
      return null
    }

    const emailVerified = payload.email_verified === 'true' || payload.email_verified === true
    if (!emailVerified) {
      console.error('[auth/google] Email not verified')
      return null
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: emailVerified,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
    }
  } catch (error) {
    console.error('[auth/google] Token verification exception:', error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id_token } = body

    if (!id_token) {
      return NextResponse.json({ error: 'Google ID token is required' }, { status: 400 })
    }

    // Verify the Google ID token
    const googleUser = await verifyGoogleToken(id_token)
    if (!googleUser) {
      return NextResponse.json({ error: 'Could not verify Google account. Please try again.' }, { status: 401 })
    }

    const supabase = createClient()
    const normalizedEmail = googleUser.email.toLowerCase().trim()

    // Find existing user by email (preserves old data)
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('user_id, email, name')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (lookupError) {
      console.error('[auth/google] User lookup failed:', lookupError)
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    let authUser: AuthUser

    if (existingUser) {
      // Existing user — use their existing data
      authUser = {
        id: existingUser.user_id,
        email: existingUser.email,
        name: existingUser.name || googleUser.name,
      }

      // Update name from Google if the DB name is empty
      if (!existingUser.name || existingUser.name === 'User') {
        await supabase
          .from('users')
          .update({ name: googleUser.name })
          .eq('user_id', existingUser.user_id)

        authUser.name = googleUser.name
      }
    } else {
      // New user — create from Google profile
      const userId = crypto.randomUUID()

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          user_id: userId,
          email: normalizedEmail,
          name: googleUser.name,
          password_hash: null,
        }])
        .select('user_id, email, name')
        .single()

      if (insertError) {
        console.error('[auth/google] User creation insert error:', insertError)
        return NextResponse.json({ error: 'Could not create account. Please try again.' }, { status: 500 })
      }

      authUser = { id: newUser.user_id, email: newUser.email, name: newUser.name }
    }

    // Sign JWT and set cookie
    const token = signToken(authUser)

    const response = NextResponse.json({ user: authUser }, { status: 200 })
    response.headers.set('Set-Cookie', buildAuthCookie(token))
    return response
  } catch (error) {
    console.error('[auth/google] Unhandled error:', error)
    return NextResponse.json({ error: 'Google sign-in failed. Please try again.' }, { status: 500 })
  }
}
