'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { normalizeEmail, validateEmail } from '@/lib/auth/email'
import { LockIcon, MailIcon, SparklesIcon, UserIcon, UserWaveIcon } from '@/components/ui/AppIcons'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')

  // Show a friendly error if redirected back from a failed auth
  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'auth-callback-failed') {
      setError('Sign-in failed. Please try again.')
    } else if (err === 'session-expired') {
      setError('Your session has expired. Please log in again.')
    }
  }, [searchParams])

  // Load Google Identity Services script
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  const handleLogin = async () => {
    if (loading) return

    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !password) { setError('Please fill in all fields.'); setSuccess(''); return }

    const emailValidation = validateEmail(normalizedEmail)
    if (!emailValidation.isValid) {
      setError(emailValidation.error || 'Enter a valid email address.')
      setSuccess('')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValidation.normalizedEmail, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Incorrect email or password.')
      } else if (data.message && data.message.includes('Password set')) {
        // Google user just set their password for the first time
        setSuccess(data.message)
        setTimeout(() => { window.location.href = '/dashboard' }, 1500)
      } else {
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (loading) return

    const normalizedName = name.trim()
    const normalizedEmailVal = normalizeEmail(email)

    if (!normalizedName || !normalizedEmailVal || !password) { setError('Please fill in all fields.'); setSuccess(''); return }

    const emailValidation = validateEmail(normalizedEmailVal)
    if (!emailValidation.isValid) {
      setError(emailValidation.error || 'Enter a valid email address.')
      setSuccess('')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      setSuccess('')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalizedName, email: emailValidation.normalizedEmail, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed.')
      } else {
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      setError('Google sign-in is not configured.')
      setLoading(false)
      return
    }

    try {
      // Use Google Identity Services to get an ID token via popup
      const google = (window as unknown as { google?: { accounts: { id: { initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void; prompt: () => void } } } }).google

      if (!google) {
        setError('Google sign-in is loading. Please try again in a moment.')
        setLoading(false)
        return
      }

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_token: response.credential }),
            })

            const data = await res.json()

            if (!res.ok) {
              setError(data.error || 'Google sign-in failed.')
              setLoading(false)
            } else {
              window.location.href = '/dashboard'
            }
          } catch {
            setError('Network error during Google sign-in.')
            setLoading(false)
          }
        },
      })

      google.accounts.id.prompt()

      // If the prompt doesn't show (e.g. user dismissed it before), use the button flow
      setTimeout(() => {
        if (loading) setLoading(false)
      }, 10000)
    } catch {
      setError('Google sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-back-wrap">
        <Link href="/" className="login-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </Link>
      </div>
      <div className="login-card">
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--terra)', marginBottom: 6 }}>OptiLearn</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          {isRegister ? <SparklesIcon width={23} height={23} /> : <UserWaveIcon width={23} height={23} />}
          {isRegister ? 'Create your account' : 'Welcome back'}
        </div>
        <div style={{ fontSize: '13.5px', color: 'var(--text-soft)', marginBottom: 28, lineHeight: 1.5 }}>
          {isRegister ? 'Join thousands of students studying smarter.' : 'Log in to your study dashboard and keep the streak alive.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRegister && (
            <div className="login-input-wrap">
              <span className="login-input-icon"><UserIcon width={14} height={14} /></span>
              <input className="login-input" type="text" placeholder="Full name" value={name} onChange={e => { setName(e.target.value); if (error) setError(''); if (success) setSuccess('') }} autoComplete="name" />
            </div>
          )}
          <div className="login-input-wrap">
            <span className="login-input-icon"><MailIcon width={14} height={14} /></span>
            <input className="login-input" type="email" placeholder="Email address" value={email} onChange={e => { setEmail(e.target.value); if (error) setError(''); if (success) setSuccess('') }} onBlur={() => setEmail(current => normalizeEmail(current))} autoComplete="email" inputMode="email" autoCapitalize="none" />
          </div>
          <div className="login-input-wrap">
            <span className="login-input-icon"><LockIcon width={14} height={14} /></span>
            <input className="login-input" type="password" placeholder="Password" value={password} onChange={e => { setPassword(e.target.value); if (error) setError(''); if (success) setSuccess('') }} autoComplete={isRegister ? 'new-password' : 'current-password'} onKeyDown={e => e.key === 'Enter' && (isRegister ? handleRegister() : handleLogin())} />
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }} onClick={isRegister ? handleRegister : handleLogin} disabled={loading}>
            {loading ? 'Please wait…' : isRegister ? 'Create Account →' : 'Log In →'}
          </button>

          {error && (
            <div style={{ fontSize: 13, color: '#D04040', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ fontSize: 13, color: '#24745A', textAlign: 'center' }}>
              {success}
            </div>
          )}

          <div className="login-divider"><span>or continue with</span></div>

          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGoogle} disabled={loading}>
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-soft)' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess('') }} style={{ color: 'var(--terra)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
            {isRegister ? 'Log in' : 'Sign up free'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
