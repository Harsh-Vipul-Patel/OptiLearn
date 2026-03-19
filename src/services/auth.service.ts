import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export class AuthService {
  static async registerUser(data: { email: string, password: string, name?: string, exam_type?: string, preferred_time?: string }) {
    const { data: existingUser } = await (await createClient())
      .from('users')
      .select('id')
      .eq('email', data.email)
      .single()

    if (existingUser) {
      throw new Error('User already exists')
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const { data: user, error } = await (await createClient())
      .from('users')
      .insert([{
        email: data.email,
        password: hashedPassword,
        name: data.name,
        exam_type: data.exam_type,
        preferred_time: data.preferred_time
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return user
  }
}
