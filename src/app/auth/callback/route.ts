// This route has been replaced by JWT-based auth.
// Google OAuth now uses /api/auth/google instead of a redirect callback.
// This file can be safely deleted.
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.redirect(new URL('/login', 'https://project-k4xf1.vercel.app'))
}
