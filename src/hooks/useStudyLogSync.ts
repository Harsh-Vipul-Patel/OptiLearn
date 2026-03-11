import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useStudyLogSync(userId: string) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    if (!userId) return;

    // 1. Initial fetch
    supabase.from('study_logs')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => setLogs(data ?? []))

    // 2. Subscribe to updates
    const channel = supabase
      .channel('study-logs-changes')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'study_logs',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        setLogs(prev => prev.map(log =>
          log.id === payload.new.id ? payload.new : log
        ))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return logs
}

export function useSuggestionsSync(userId: string) {
  const [suggestions, setSuggestions] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    if (!userId) return;

    // 1. Initial fetch
    supabase.from('suggestions')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => setSuggestions(data ?? []))

    // 2. Subscribe to updates
    const channel = supabase
      .channel('suggestions-feed')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'suggestions',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        setSuggestions(prev => [payload.new, ...prev])  // prepend
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return suggestions
}
