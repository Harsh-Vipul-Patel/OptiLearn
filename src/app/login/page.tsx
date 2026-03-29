'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { normalizeEmail, validateEmail } from '@/lib/auth/email'
import { LockIcon, MailIcon, SparklesIcon, UserIcon, UserWaveIcon } from '@/components/ui/AppIcons'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')

  // Show a friendly error if redirected back from a failed auth callback
  useEffect(() => {
    if (searchParams.get('error') === 'auth-callback-failed') {
      setError('Sign-in failed — the authentication service may be temporarily unavailable. Please try again.')
    }
  }, [searchParams])


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

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: emailValidation.normalizedEmail, password })
    setLoading(false)

    if (signInError) {
      setError(signInError.message || 'Incorrect email or password.')
    } else {
      router.push('/dashboard')
    }
  }

  const handleRegister = async () => {
    if (loading) return

    const normalizedName = name.trim()
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedName || !normalizedEmail || !password) { setError('Please fill in all fields.'); setSuccess(''); return }

    const emailValidation = validateEmail(normalizedEmail)
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

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: emailValidation.normalizedEmail,
      password,
      options: {
        data: { name: normalizedName, full_name: normalizedName }
      }
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message || 'Registration failed.')
    } else {
      if (signUpData.session) {
        router.push('/dashboard')
      } else {
        setIsRegister(false)
        setPassword('')
        setSuccess('Account created. Please verify your email before logging in.')
      }
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    // Check if Supabase is reachable before redirecting
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const maxRetries = 3
    let reachable = false

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (res.ok) { reachable = true; break }
      } catch {
        // Supabase unreachable, retry after delay
      }
      if (attempt < maxRetries) {
        setError(`Authentication service is waking up… retrying (${attempt}/${maxRetries})`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    if (!reachable) {
      setLoading(false)
      setError('Authentication service is temporarily unavailable. Please try again in a minute.')
      return
    }

    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    if (oauthError) {
      setLoading(false)
      setError('Could not connect to Google Sign-In. Please try again.')
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
