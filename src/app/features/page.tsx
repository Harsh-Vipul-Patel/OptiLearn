'use client'

import Link from 'next/link'
import { AnalyticsIcon, BrainIcon, SparklesIcon, CalendarIcon, TargetIcon, FlameIcon, AlertIcon } from '@/components/ui/AppIcons'

export default function FeaturesPage() {
  return (
    <div className="landing-root">
      {/* Nav */}
      <nav className="landing-nav">
        <Link href="/" className="landing-logo" style={{ textDecoration: 'none' }}>OptiLearn</Link>
        <div className="landing-nav-links">
          <Link href="/features" style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra)', textDecoration: 'none' }}>Features</Link>
          <Link href="/how-it-works" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none', transition: 'color .2s' }}>How it Works</Link>
          <Link href="/about" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none', transition: 'color .2s' }}>About</Link>
        </div>
        <div className="landing-nav-cta">
          <Link href="/login" className="btn-secondary btn-sm">Log in</Link>
          <Link href="/login" className="btn-primary btn-sm">Get Started Free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="landing-hero" style={{ flexDirection: 'column', textAlign: 'center', gap: 24, paddingBottom: 80, alignItems: 'center' }}>
        <div style={{ animation: 'slideUp .55s cubic-bezier(.22,.68,0,1.1) both', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="hero-eyebrow"><SparklesIcon width={14} height={14} />Advanced Study Tools</div>
          <div className="hero-title" style={{ maxWidth: 800 }}>Everything you need to <em>excel.</em></div>
          <p style={{ fontSize: '16.5px', color: 'var(--text-mid)', lineHeight: 1.7, maxWidth: 640, margin: '24px auto 42px' }}>
            A complete suite of AI-driven study tools engineered to boost retention, maintain consistency, and prevent academic burnout before it happens.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, width: '100%', maxWidth: 1040, animation: 'fadeIn .7s .25s both', textAlign: 'left' }}>
          {[
            { title: 'Smart Study Planner', icon: <CalendarIcon width={24} height={24} />, desc: 'Map out your study blocks across custom time slots. Let the system intelligently warn you of scheduling conflicts.' },
            { title: 'AI Recommendations', icon: <BrainIcon width={24} height={24} />, desc: 'Receive personalized scheduling tips based on your peak cognitive hours and subject difficulty thresholds.' },
            { title: 'Deep Analytics', icon: <AnalyticsIcon width={24} height={24} />, desc: 'Visualize your progress. Track subject mastery and identify your weakest links through dynamic charts.' },
            { title: 'Burnout Detection', icon: <AlertIcon width={24} height={24} />, desc: 'Our algorithm monitors your study volume and intensity to flag early signs of exhaustion before you crash.' },
            { title: 'Daily Goal Tracking', icon: <TargetIcon width={24} height={24} />, desc: 'Set and crush daily milestones. Watch your execution percentage climb as you log completed sessions.' },
            { title: 'Session Logging & Streaks', icon: <FlameIcon width={24} height={24} />, desc: 'Gamify your study routine. Build impressive daily streaks and turn studying into a rewarding habit.' },
          ].map(feature => (
            <div key={feature.title} className="card-flat" style={{ padding: 28 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--terra-light)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                {feature.icon}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8, color: 'var(--text-dark)' }}>
                {feature.title}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {feature.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
