import { NextResponse, type NextRequest } from 'next/server'

const AUTH_COOKIE = 'ol_auth_token'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'session-expired')
    return NextResponse.redirect(loginUrl)
  }

  // Token exists — let the request through.
  // Full verification happens in the API route / page itself.
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
