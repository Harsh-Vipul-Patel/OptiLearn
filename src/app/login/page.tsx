'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message || 'Incorrect email or password.')
    } else {
      router.push('/dashboard')
    }
  }

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError('')
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message || 'Registration failed.')
    } else {
      router.push('/dashboard')
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })
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
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 6 }}>
          {isRegister ? 'Create your account 🎓' : 'Welcome back 👋'}
        </div>
        <div style={{ fontSize: '13.5px', color: 'var(--text-soft)', marginBottom: 28, lineHeight: 1.5 }}>
          {isRegister ? 'Join thousands of students studying smarter.' : 'Log in to your study dashboard and keep the streak alive.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRegister && (
            <div className="login-input-wrap">
              <span className="login-input-icon">👤</span>
              <input className="login-input" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="login-input-wrap">
            <span className="login-input-icon">✉</span>
            <input className="login-input" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="login-input-wrap">
            <span className="login-input-icon">🔒</span>
            <input className="login-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} onKeyDown={e => e.key === 'Enter' && (isRegister ? handleRegister() : handleLogin())} />
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }} onClick={isRegister ? handleRegister : handleLogin} disabled={loading}>
            {loading ? 'Please wait…' : isRegister ? 'Create Account →' : 'Log In →'}
          </button>

          {error && (
            <div style={{ fontSize: 13, color: '#D04040', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div className="login-divider"><span>or continue with</span></div>

          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGoogle}>
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-soft)' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={() => { setIsRegister(!isRegister); setError('') }} style={{ color: 'var(--terra)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
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
