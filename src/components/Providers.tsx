"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type SessionContextType = {
  data: { user: { id: string; email?: string; name?: string } } | null
}

const SessionContext = createContext<SessionContextType>({ data: null })

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionContextType["data"]>(null)
  const supabase = createClient()
  const router = useRouter()

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

  return <SessionContext.Provider value={{ data: session }}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)

export const signOut = async () => {
  const supabase = createClient()
  await supabase.auth.signOut()
  window.location.href = '/'
}
