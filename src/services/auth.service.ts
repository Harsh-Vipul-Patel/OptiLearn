import { createClient } from '@/lib/supabase/server'
import { getEmailLocalPart, getFallbackUserEmail, validateEmail } from '@/lib/auth/email'
import { hashPassword } from '@/lib/auth/password'
import crypto from 'crypto'

function normalizeExamType(value?: string): string | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  const lower = raw.toLowerCase()
  if (lower === 'jee') return 'JEE'
  if (lower === 'neet') return 'NEET'
  if (lower === 'boards' || lower === 'board') return 'Boards'
  if (lower === 'others' || lower === 'other') return 'Others'
  return 'Others'
}

function normalizePreferredTime(value?: string): string | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  const lower = raw.toLowerCase()
  if (lower === 'morning') return 'Morning'
  if (lower === 'afternoon') return 'Afternoon'
  if (lower === 'evening') return 'Evening'
  if (lower === 'night') return 'Night'
  return null
}

export class AuthService {
  static async registerUser(data: { email: string, password: string, name?: string, exam_type?: string, preferred_time?: string }) {
    const supabase = createClient()
    const normalizedName = (data.name || '').trim()
    const emailValidation = validateEmail(data.email)

    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error || 'Enter a valid email address.')
    }

    if (!data.password) {
      throw new Error('Password is required')
    }

    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    const normalizedEmail = emailValidation.normalizedEmail
    const resolvedName = normalizedName || getEmailLocalPart(normalizedEmail) || normalizedEmail
    const normalizedExamType = normalizeExamType(data.exam_type)
    const normalizedPreferredTime = normalizePreferredTime(data.preferred_time)

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUserError && existingUserError.code !== 'PGRST116') {
      throw new Error(existingUserError.message)
    }

    if (existingUser) {
      throw new Error('User already exists')
    }

    const passwordHash = await hashPassword(data.password)
    const userId = crypto.randomUUID()

    const persistedEmail = getFallbackUserEmail(userId, normalizedEmail)

    const { data: user, error } = await supabase
      .from('users')
      .upsert(
        [{
          user_id: userId,
          email: persistedEmail,
          name: resolvedName,
          password_hash: passwordHash,
          exam_type: normalizedExamType,
          preferred_study_time: normalizedPreferredTime,
        }],
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return user
  }
}
