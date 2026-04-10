import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'

const ENGINE_URL = process.env.ENGINE_API_URL
const ENGINE_KEY = process.env.ENGINE_API_KEY

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text } = await request.json()
    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
    }

    const res = await fetch(`${ENGINE_URL}/engine/vault/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-engine-key': ENGINE_KEY!
      },
      body: JSON.stringify({ text })
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(`Engine error: ${res.status} ${errorData.detail || ''}`)
    }

    const data = await res.json()
    return NextResponse.json(data, { status: 200 })

  } catch (error) {
    console.error('[vault/generate] Error:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 502 })
  }
}
