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

  /* Persist sidebar collapse state */
  useEffect(() => {
    const stored = localStorage.getItem("ol_sidebar_collapsed")
    if (stored === "true") setCollapsed(true)
    if (stored === "false") setCollapsed(false)
  }, [])

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem("ol_sidebar_collapsed", String(next))
      return next
    })
  }

  /* Auth */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSession({ user: { id: user.id, email: user.email, name: user.user_metadata?.name || 'User' } })
      } else {
        setSession(null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setSession({ user: { id: session.user.id, email: session.user.email, name: session.user.user_metadata?.name || 'User' } })
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
