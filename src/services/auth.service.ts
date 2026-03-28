import { createClient } from '@/lib/supabase/server'

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
    const normalizedExamType = normalizeExamType(data.exam_type)
    const normalizedPreferredTime = normalizePreferredTime(data.preferred_time)

    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', data.email)
      .single()

    if (existingUser) {
      throw new Error('User already exists')
    }

    const { data: authSignUp, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name || data.email,
        },
      },
    })

    if (signUpError) throw new Error(signUpError.message)
    const authUserId = authSignUp.user?.id
    if (!authUserId) {
      throw new Error('Auth user was not created')
    }

    const { data: user, error } = await supabase
      .from('users')
      .upsert(
        [{
          user_id: authUserId,
          email: data.email,
          name: data.name || data.email,
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
