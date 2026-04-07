'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, signOut } from '@/components/Providers'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getEmailLocalPart } from '@/lib/auth/email'

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    desc: 'Your daily overview, stats & goal ring',
    icon: <DashboardIcon />,
  },
  {
    href: '/dashboard/planner',
    label: 'Study Planner',
    desc: 'Build your day, drag & drop subjects',
    icon: <PlannerIcon />,
  },
  {
    href: '/dashboard/logger',
    label: 'Log Session',
    desc: 'Record focus, fatigue & distractions',
    icon: <LoggerIcon />,
  },
  {
    href: '/dashboard/analytics',
    label: 'Analytics',
    desc: 'Charts, heatmap & weekly breakdown',
    icon: <AnalyticsIcon />,
  },
  {
    href: '/dashboard/insights',
    label: 'AI Insights',
    desc: 'Personalised recommendations & burnout alerts',
    icon: <InsightsIcon />,
  },
]

function getCurrentPageLabel(pathname: string): string {
  if (pathname === '/dashboard/profile') return 'Profile'

  const match = NAV_ITEMS
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return match?.label || 'Dashboard'
}

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])

  // Close on route change
  useEffect(() => {
    close()
  }, [pathname, close])

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const email = session?.user?.email || ''
  const emailPrefix = getEmailLocalPart(email)
  const name = session?.user?.name || emailPrefix || 'User'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const currentPage = getCurrentPageLabel(pathname)

  const handleLogout = async () => {
    setShowLogoutConfirm(false)
    await signOut()
  }

  return (
    <>
      {/* ── Centered Pill Top Bar ── */}
      <header className="topbar">
        <div className="topbar-pill">
          <button
            type="button"
            className="topbar-nav-trigger"
            onClick={toggle}
            aria-label="Open navigation menu"
            aria-expanded={open}
          >
            <span className="topbar-logo">OptiLearn</span>
            <span className="topbar-divider"/>
            <span className="topbar-page">{currentPage}</span>
          </button>
          <Link
            href="/dashboard/profile"
            className="topbar-avatar"
            title={name}
            aria-label="Open profile"
          >
            {initials}
          </Link>
        </div>
      </header>

      {/* ── Backdrop ── */}
      <div
        className={`sidebar-backdrop${open ? ' open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* ── Floating Navigation Panel ── */}
      <aside className={`sidebar-panel${open ? ' open' : ''}`}>
        {/* Header */}
        <div className="sidebar-panel-header">
          <span className="sidebar-panel-title">NAVIGATE</span>
          <button className="sidebar-panel-close" onClick={close} aria-label="Close navigation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="sidebar-panel-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-panel-item${isActive ? ' active' : ''}`}
                onClick={close}
              >
                <span className={`sidebar-panel-icon${isActive ? ' active' : ''}`}>{item.icon}</span>
                <div className="sidebar-panel-item-text">
                  <span className="sidebar-panel-item-label">{item.label}</span>
                  <span className="sidebar-panel-item-desc">{item.desc}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <button className="sidebar-panel-logout" onClick={() => setShowLogoutConfirm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Log out of OptiLearn</span>
        </button>
      </aside>

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="logout-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
          <div className="logout-confirm-card">
            <h3 id="logout-confirm-title">Are you sure you want to logout?</h3>
            <div className="logout-confirm-actions">
              <button type="button" className="logout-confirm-primary" onClick={handleLogout}>
                Logout
              </button>
              <button type="button" className="logout-confirm-secondary" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Icon Components ── */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="2"/>
      <rect x="14" y="3" width="7" height="7" rx="2"/>
      <rect x="14" y="14" width="7" height="7" rx="2"/>
      <rect x="3" y="14" width="7" height="7" rx="2"/>
    </svg>
  )
}
function PlannerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function LoggerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
  )
}
function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function InsightsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a10 10 0 0 1 10 10c0 4-2.5 7.4-6 9l-1 2H9l-1-2c-3.5-1.6-6-5-6-9A10 10 0 0 1 12 2z"/>
      <line x1="12" y1="14" x2="12" y2="18"/>
    </svg>
  )
}
