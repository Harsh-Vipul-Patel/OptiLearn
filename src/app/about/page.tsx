'use client'

import Link from 'next/link'
import { SparklesIcon, CheckCircleIcon } from '@/components/ui/AppIcons'

export default function AboutPage() {
  return (
    <div className="landing-root">
      {/* Nav */}
      <nav className="landing-nav">
        <Link href="/" className="landing-logo" style={{ textDecoration: 'none' }}>OptiLearn</Link>
        <div className="landing-nav-links">
          <Link href="/features" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none', transition: 'color .2s' }}>Features</Link>
          <Link href="/how-it-works" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none', transition: 'color .2s' }}>How it Works</Link>
          <Link href="/about" style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra)', textDecoration: 'none' }}>About</Link>
        </div>
        <div className="landing-nav-cta">
          <Link href="/login" className="btn-secondary btn-sm">Log in</Link>
          <Link href="/login" className="btn-primary btn-sm">Get Started Free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="landing-hero" style={{ flexDirection: 'column', textAlign: 'center', gap: 24, paddingBottom: 80, alignItems: 'center' }}>
        <div style={{ animation: 'slideUp .55s cubic-bezier(.22,.68,0,1.1) both', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="hero-eyebrow"><SparklesIcon width={14} height={14} />Our Mission</div>
          <div className="hero-title" style={{ maxWidth: 800 }}>Built to fight <em>burnout.</em></div>
          <p style={{ fontSize: '16.5px', color: 'var(--text-mid)', lineHeight: 1.7, maxWidth: 640, margin: '24px auto 42px' }}>
            We started OptiLearn because we were tired of tools that just tracked time. We wanted a system that tracked energy, prevented burnout, and respected students' health.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 800px)', width: '100%', maxWidth: 800, animation: 'fadeIn .7s .25s both', textAlign: 'left' }}>
          <div className="card-flat" style={{ padding: '36px 42px' }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 16, color: 'var(--text-dark)' }}>
              The Story
            </h3>
            <p style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 20 }}>
              Students around the world grind through massive study blocks daily. However, the existing productivity tools treat people like machines — optimizing for maximum hours rather than effective results. 
            </p>
            <p style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 20 }}>
              OptiLearn flips the script. We use deep analytics and smart AI modeling to map out your cognitive performance throughout the day. Instead of demanding more endless hours, our algorithms suggest the best moments to focus on high-difficulty tasks while leaving room for low-intensity reviews during slumps.
            </p>
            <div style={{ display: 'flex', gap: 20, marginTop: 40, padding: '24px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--sage)' }}>
                  <CheckCircleIcon width={18} height={18} />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Focus on Health</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Preventing exhaustion is our number one priority.</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--terra)' }}>
                  <CheckCircleIcon width={18} height={18} />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Driven by Data</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Everything we recommend is backed by your own real study metrics.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, animation: 'fadeIn .8s .45s both' }}>
          <Link href="/login" className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>Join our growing community</Link>
        </div>
      </div>
    </div>
  )
}
