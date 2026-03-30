import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || ''
const TOKEN_EXPIRY = '7d'
const COOKIE_NAME = 'ol_auth_token'

export type AuthUser = {
  id: string
  email: string
  name: string
}

type JwtPayload = {
  sub: string
  email: string
  name: string
  iat?: number
  exp?: number
}

/** Sign a JWT for the given user. */
export function signToken(user: AuthUser): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured')

  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name } satisfies JwtPayload,
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )
}

/** Verify a JWT and return the decoded payload, or null if invalid. */
export function verifyToken(token: string): AuthUser | null {
  if (!JWT_SECRET) return null

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    return { id: decoded.sub, email: decoded.email, name: decoded.name }
  } catch {
    return null
  }
}

/**
 * Extract and verify the auth token from the request cookies.
 * Works in API route handlers where `request` is available.
 */
export function getAuthUser(request: Request): AuthUser | null {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  if (!match) return null
  return verifyToken(match[1])
}

/**
 * Server Component / Server Action helper.
 * Reads the auth cookie from Next.js `cookies()`.
 */
export async function getServerAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/** Only set Secure flag in production (HTTPS). Localhost is HTTP, so Secure cookies are silently dropped by the browser. */
const isProduction = process.env.NODE_ENV === 'production'
const secureSuffix = isProduction ? '; Secure' : ''

/** Build Set-Cookie header value for the auth token. */
export function buildAuthCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureSuffix}`
}

/** Build Set-Cookie header value to clear the auth cookie. */
export function buildClearAuthCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureSuffix}`
}

export { COOKIE_NAME }
