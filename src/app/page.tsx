'use client'

import Link from 'next/link'
import { useSession, signOut } from '@/components/Providers'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.push('/dashboard')
  }, [session, router])

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#FFF8EF 0%,#FFF0DC 50%,#F5E8D6 100%)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 56px' }}>
        <div className="landing-logo">OptiLearn</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <a href="#features" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none' }}>Features</a>
          <a href="#howitworks" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none' }}>How it Works</a>
          <a href="#about" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none' }}>About</a>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login" className="btn-secondary btn-sm">Log in</Link>
          <Link href="/login" className="btn-primary btn-sm">Get Started Free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 56px 40px', gap: 72, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Left */}
        <div style={{ flex: 1, maxWidth: 560, animation: 'slideUp .55s cubic-bezier(.22,.68,0,1.1) both' }}>
          <div className="hero-eyebrow">✦ AI-Powered Study Intelligence</div>
          <div className="hero-title">Study <em>Smarter.</em><br />Burn Out <em>Never.</em></div>
          <p style={{ fontSize: '16.5px', color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 36, maxWidth: 460 }}>
            OptiLearn tracks your study sessions, learns your focus patterns, and gives you personalised AI guidance — so you hit your goals without hitting a wall.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>Start for Free</Link>
            <Link href="/login" className="btn-secondary" style={{ padding: '14px 24px', fontSize: 15 }}>View Demo →</Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
            ✓ No credit card &nbsp;·&nbsp; ✓ Works on all devices &nbsp;·&nbsp; ✓ Free forever plan
          </div>
        </div>

        {/* Right — mockup card */}
        <div style={{ flex: '0 0 420px', position: 'relative', animation: 'slideUp .55s .12s cubic-bezier(.22,.68,0,1.1) both' }}>
          <div style={{ background: 'linear-gradient(160deg,#FFFFFF 0%,#FFFBF6 100%)', borderRadius: 24, padding: 24, boxShadow: '0 4px 8px rgba(60,40,20,.06),0 16px 40px rgba(60,40,20,.12),0 40px 80px rgba(60,40,20,.10)', border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#FF5F57','#FFBD2E','#28C840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' }}>OptiLearn Dashboard</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[['5.2h','Today\'s Study','var(--terra)'],['84%','Efficiency','var(--sage)'],['12🔥','Day Streak','var(--gold)'],['3','AI Insights','var(--indigo)']].map(([v,l,c]) => (
                <div key={l} style={{ background: 'linear-gradient(145deg,#fff 0%,#FFF8F2 100%)', borderRadius: 14, padding: '12px 14px', border: '1.5px solid var(--border)', boxShadow: '0 2px 8px rgba(60,40,20,.06)' }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 8, letterSpacing: '.4px' }}>SUBJECT PROGRESS</div>
            {[['📐 Physics','68%','#4A5FA0,#7B8FCC',68],['➕ Maths','81%','var(--terra),#E89070',81],['⚗️ Chemistry','54%','var(--sage),#96C9A0',54]].map(([label,pct,grad,w]) => (
              <div key={String(label)} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
                  <span style={{ color: 'var(--text-soft)', fontSize: 11 }}>{pct}</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'var(--cream2)', overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg,${grad})` }} />
                </div>
              </div>
            ))}
            <div style={{ background: 'linear-gradient(135deg,#3D4F8C,#243070)', borderRadius: 14, padding: '12px 14px', color: 'white' }}>
              <div style={{ fontSize: 10, opacity: .6, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 4 }}>AI Insight · Live</div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, lineHeight: 1.4 }}>&quot;Physics peaks 9–11 AM. Schedule Mechanics tomorrow morning.&quot;</div>
            </div>
          </div>
          {/* Floating badges */}
          <div style={{ position: 'absolute', top: -18, right: -18, background: 'white', borderRadius: 14, padding: '10px 14px', boxShadow: '0 4px 20px rgba(60,40,20,.14)', border: '1.5px solid var(--border)', fontSize: 12, fontWeight: 600, animation: 'slideDown .5s .3s cubic-bezier(.22,.68,0,1.1) both' }}>🔥 12-day streak!</div>
          <div style={{ position: 'absolute', bottom: -14, left: -18, background: 'white', borderRadius: 14, padding: '10px 14px', boxShadow: '0 4px 20px rgba(60,40,20,.14)', border: '1.5px solid var(--border)', fontSize: 12, fontWeight: 600, animation: 'slideUp .5s .4s cubic-bezier(.22,.68,0,1.1) both' }}>✅ Burnout risk: Low</div>
        </div>
      </div>

      {/* Feature Strips */}
      <div id="features" style={{ padding: '0 56px 48px', animation: 'fadeIn .7s .25s both' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', justifyItems: 'center' }}>
          {[['📅','Smart Study Planner'],['🧠','AI Recommendations'],['📊','Deep Analytics'],['⚠️','Burnout Detection'],['🎯','Daily Goal Tracking'],['⏱️','Session Logging'],['🔥','Streak System']].map(([e,l]) => (
            <div key={String(l)} className="feature-pill"><span style={{ fontSize: 16 }}>{e}</span>{l}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
