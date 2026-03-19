'use client'

import { useState } from 'react'
import { useSession, signOut } from '@/components/Providers'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    section: 'Overview',
    links: [
      { href: '/dashboard',           label: 'Dashboard',     icon: <DashboardIcon /> },
      { href: '/dashboard/planner',   label: 'Study Planner', icon: <PlannerIcon /> },
      { href: '/dashboard/logger',    label: 'Log Session',   icon: <LoggerIcon /> },
    ],
  },
  {
    section: 'Insights',
    links: [
      { href: '/dashboard/analytics', label: 'Analytics',   icon: <AnalyticsIcon /> },
      { href: '/dashboard/insights',  label: 'AI Insights',  icon: <InsightsIcon /> },
    ],
  },
]

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const name    = session?.user?.name  || 'Student'
  const email   = session?.user?.email || ''
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  const close = () => setOpen(false)

  return (
    <>
      {/* ── Hamburger (mobile only) ── */}
      <button
        className="sidebar-hamburger"
        onClick={() => setOpen(o => !o)}
        aria-label="Open navigation menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open
            ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
          }
        </svg>
      </button>

      {/* ── Backdrop (mobile) ── */}
      <div
        className={`sidebar-backdrop${open ? ' open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        {/* Logo */}
        <div className="logo">
          <div className="logo-mark">OptiLearn</div>
          <div className="logo-sub">Study Intelligence</div>
        </div>

        {/* Nav */}
        <nav className="nav">
          {NAV_ITEMS.map((group) => (
            <div key={group.section}>
              <span className="nav-section">{group.section}</span>
              {group.links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${pathname === item.href ? ' active' : ''}`}
                  onClick={close}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User card */}
        <Link href="/dashboard/profile" className="user-card" onClick={close} style={{ textDecoration: 'none' }}>
          <div className="avatar">{initials}</div>
          <div>
            <div className="user-name">{name}</div>
            <div className="user-exam">{email}</div>
          </div>
        </Link>

        {/* Logout */}
        <button className="sidebar-logout" onClick={() => signOut()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Log out
        </button>
      </aside>
    </>
  )
}

/* ── Icon Components ── */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
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

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
