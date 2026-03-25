"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

/* ── Auth Session ── */
type SessionContextType = {
  data: { user: { id: string; email?: string; name?: string } } | null
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
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('ol_sidebar_collapsed')
    // Intentional post-hydration sync from persisted client preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(stored === 'false' ? false : true)
  }, [])

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem("ol_sidebar_collapsed", String(next))
      return next
    })
  }

  const resolveDisplayName = (user: { email?: string; user_metadata?: Record<string, unknown> }) => {
    const meta = user.user_metadata || {}
    const metaName = (meta.name as string | undefined)?.trim()
    const metaFullName = (meta.full_name as string | undefined)?.trim()
    const emailPrefix = (user.email || '').split('@')[0]?.trim()
    return metaName || metaFullName || emailPrefix || 'User'
  }

  /* Auth */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSession({ user: { id: user.id, email: user.email, name: resolveDisplayName(user) } })
      } else {
        setSession(null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setSession({ user: { id: session.user.id, email: session.user.email, name: resolveDisplayName(session.user) } })
      } else {
        setSession(null)
      }
      router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

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
  const supabase = createClient()
  await supabase.auth.signOut()
  window.location.href = '/'
}
