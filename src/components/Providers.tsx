"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/* ── Auth Session ── */
type SessionUser = { id: string; email?: string; name?: string }
type SessionContextType = {
  data: { user: SessionUser } | null
}

const SessionContext = createContext<SessionContextType>({ data: null })

/* ── Sidebar ── */
type SidebarContextType = {
  collapsed: boolean
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: true,
  toggleSidebar: () => {},
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionContextType["data"]>(null)
  const [collapsed, setCollapsed] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('ol_sidebar_collapsed')
    setCollapsed(stored === 'false' ? false : true)
  }, [])

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem("ol_sidebar_collapsed", String(next))
      return next
    })
  }

  /* Auth — fetch current user from JWT cookie */
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          setSession({ user: data.user })
        } else {
          setSession(null)
        }
      })
      .catch(() => setSession(null))
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, toggleSidebar }}>
      <SessionContext.Provider value={{ data: session }}>
        {children}
      </SessionContext.Provider>
    </SidebarContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
export const useSidebar = () => useContext(SidebarContext)

export const signOut = async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  window.location.href = '/'
}
