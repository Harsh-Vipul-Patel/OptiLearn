'use client'

import Link from 'next/link'
import { AnalyticsIcon, BrainIcon, SparklesIcon, CalendarIcon, TargetIcon, FlameIcon, AlertIcon, TimerIcon, BookIcon, MoonIcon, CheckCircleIcon } from '@/components/ui/AppIcons'

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
          <div className="hero-eyebrow"><SparklesIcon width={14} height={14} />Adaptive Study Intelligence</div>
          <div className="hero-title" style={{ maxWidth: 800 }}>Everything you need to <em>excel.</em></div>
          <p style={{ fontSize: '16.5px', color: 'var(--text-mid)', lineHeight: 1.7, maxWidth: 640, margin: '24px auto 42px' }}>
            A complete suite of AI-driven tools — from cognitive load analysis and procrastination detection to LLM-powered recommendations that turn into real study plans with one click.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, width: '100%', maxWidth: 1040, animation: 'fadeIn .7s .25s both', textAlign: 'left' }}>
          {[
            { title: 'Smart Study Planner', icon: <CalendarIcon width={24} height={24} />, desc: 'Build daily study plans with Morning / Afternoon / Evening / Night slots, optional start & end times, difficulty tagging, and subject color coding. The database enforces overlap-free scheduling.' },
            { title: 'Session Logger', icon: <TimerIcon width={24} height={24} />, desc: 'Record exactly what happened — focus level, fatigue, distraction types (Phone, Noise, Social Media, etc.), and reflections. Every log auto-triggers the AI engine for real-time analysis.' },
            { title: 'AI Insights Engine', icon: <BrainIcon width={24} height={24} />, desc: 'A 4-node LangGraph pipeline computes 8 cross-dimensional patterns — planning accuracy, fatigue curves, deep work ratio, and more — before sending them to Groq LLaMA 3.3 70B for evidence-based, non-generic recommendations.' },
            { title: 'Insight → Action Loop', icon: <SparklesIcon width={24} height={24} />, desc: 'AI recommendations include structured plan suggestions. Click "Add to Plan" to convert an insight into an actual study schedule entry — closing the loop between analysis and action in one click.' },
            { title: 'Deep Analytics', icon: <AnalyticsIcon width={24} height={24} />, desc: 'Multi-tab dashboard with Planned vs Actual charts, Subject Priority Matrix, Focus by Day, a 4-week Activity Heatmap, and Efficiency by Weekday. Plus a 3-3-3 Weekly Digest (3 Wins, 3 Issues, 3 Actions) exportable as PDF.' },
            { title: 'Burnout & Wellness Monitor', icon: <AlertIcon width={24} height={24} />, desc: 'Daily wellness check-in captures 8 neuro-cognitive signals (sleep, energy, stress, mood, exercise, meals, screen time) to compute a Readiness Score. Burnout risk is classified from a 7-session fatigue-consistency-focus blend.' },
            { title: 'Procrastination Tracker', icon: <TargetIcon width={24} height={24} />, desc: 'A PostgreSQL view automatically detects skipped (no log) and abandoned (<50% target) sessions. Dashboard shows procrastination score, risk level, and skipped counts by subject with start-delay analysis.' },
            { title: 'Knowledge Vault', icon: <BookIcon width={24} height={24} />, desc: 'Paste study notes and AI generates flashcard Q&A pairs. Enter Active Recall Test mode to flip cards one at a time, rate confidence 1–5, and track response time per card for weak-topic analysis.' },
            { title: 'Streaks & Gamification', icon: <FlameIcon width={24} height={24} />, desc: 'Daily study streaks, goal ring progress visualization, stat cards with week-over-week deltas, and exam readiness tracking — turning every session into measurable progress toward your target.' },
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

        {/* Bottom CTA */}
        <div style={{ marginTop: 24, animation: 'fadeIn .8s .45s both' }}>
          <Link href="/login" className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>Start optimizing for free →</Link>
        </div>
      </div>
    </div>
  )
}
