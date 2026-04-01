'use client'

import Link from 'next/link'
import { CheckCircleIcon, SparklesIcon } from '@/components/ui/AppIcons'

export default function HowItWorksPage() {
  return (
    <div className="landing-root">
      {/* Nav */}
      <nav className="landing-nav">
        <Link href="/" className="landing-logo" style={{ textDecoration: 'none' }}>OptiLearn</Link>
        <div className="landing-nav-links">
          <Link href="/features" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none', transition: 'color .2s' }}>Features</Link>
          <Link href="/how-it-works" style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra)', textDecoration: 'none' }}>How it Works</Link>
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
          <div className="hero-eyebrow"><SparklesIcon width={14} height={14} />Simple & Seamless</div>
          <div className="hero-title" style={{ maxWidth: 800 }}>How <em>OptiLearn</em> works.</div>
          <p style={{ fontSize: '16.5px', color: 'var(--text-mid)', lineHeight: 1.7, maxWidth: 640, margin: '24px auto 42px' }}>
            Get started in under two minutes and transform the way you study forever. OptiLearn uses a four-step framework to get you optimizing your time rapidly.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32, width: '100%', maxWidth: 800, animation: 'fadeIn .7s .25s both', textAlign: 'left' }}>
          {[
            { step: '1', title: 'Add Your Subjects', desc: 'Input the subjects you are studying this semester. OptiLearn will color-code and track them intelligently.' },
            { step: '2', title: 'Plan Your Timeline', desc: 'Drag and configure study sessions directly into the timeline. Our system warns you about overlaps and adjusts your day automatically.' },
            { step: '3', title: 'Execute & Log Sessions', desc: 'When you complete a session, hit the logger to lock it in. Our analytics engine records your time, topic, and exertion limits.' },
            { step: '4', title: 'Review AI Insights', desc: 'Navigate to your dashboard to review data models identifying peak productivity times and recommendations to tackle specific weaknesses.' },
          ].map((item, index) => (
            <div key={item.title} className="card-flat" style={{ padding: '28px 32px', display: 'flex', gap: 24, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, left: -10, fontSize: 120, fontWeight: 900, color: 'var(--terra)', opacity: 0.05, lineHeight: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {item.step}
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--terra) 0%, #D37339 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flexShrink: 0, zIndex: 1, boxShadow: 'var(--shadow-terra)' }}>
                {item.step}
              </div>
              <div style={{ zIndex: 1, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6, color: 'var(--text-dark)' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: 20, animation: 'fadeIn .8s .45s both' }}>
          <Link href="/login" className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>Try the framework yourself</Link>
        </div>
      </div>
    </div>
  )
}
