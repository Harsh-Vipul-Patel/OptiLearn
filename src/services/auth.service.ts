import { createClient } from '@/lib/supabase/server'
import { getEmailLocalPart, getFallbackUserEmail, validateEmail } from '@/lib/auth/email'

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
    const supabase = await createClient()
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

    const { data: authSignUp, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: data.password,
      options: {
        data: {
          name: resolvedName,
          full_name: resolvedName,
        },
      },
    })

    if (signUpError) {
      const message = (signUpError.message || '').toLowerCase()
      if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
        throw new Error('User already exists')
      }
      throw new Error(signUpError.message)
    }

    const authUserId = authSignUp.user?.id
    if (!authUserId) {
      throw new Error('Account created. Please verify your email to complete signup.')
    }

    const persistedEmail = getFallbackUserEmail(authUserId, normalizedEmail)

    const { data: user, error } = await supabase
      .from('users')
      .upsert(
        [{
          user_id: authUserId,
          email: persistedEmail,
          name: resolvedName,
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
