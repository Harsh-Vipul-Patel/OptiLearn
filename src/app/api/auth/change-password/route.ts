import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters long.' }, { status: 400 })
    }

    const supabase = createClient()

    // Fetch current password hash
    const { data: dbUser, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('[auth/change-password] DB fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to verify account.' }, { status: 500 })
    }

    if (!dbUser) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    // If user already has a password, verify the current one
    if (dbUser.password_hash) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required.' }, { status: 400 })
      }

      const isValid = await verifyPassword(currentPassword, dbUser.password_hash)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
      }
    }
    // If no password_hash (Google-only user), allow setting password without current password

    const newHash = await hashPassword(newPassword)

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[auth/change-password] DB update error:', updateError)
      return NextResponse.json({ error: 'Failed to update password.' }, { status: 500 })
    }

    return NextResponse.json({
      message: dbUser.password_hash ? 'Password changed successfully.' : 'Password set successfully. You can now log in with email and password.',
      hadPassword: !!dbUser.password_hash,
    }, { status: 200 })
  } catch (error) {
    console.error('[auth/change-password]', error)
    return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 })
  }
}
