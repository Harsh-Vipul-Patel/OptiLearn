import useSWR from 'swr'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`)
  }
  return body
}

/**
 * Polls study logs every 10s with SWR (auto-deduplication, background refresh, error retry).
 * Returns logs + isLoading so components can show skeletons.
 */
export function useStudyLogSync(userId: string) {
  const { data, isLoading } = useSWR(
    userId ? '/api/logs' : null,
    fetcher,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: true,
    }
  )
  return {
    logs: (data?.logs ?? []) as Record<string, unknown>[],
    isLoading,
  }
}

/**
 * Polls AI suggestions every 30s. Less frequent since suggestions change less often.
 */
export function useSuggestionsSync(userId: string) {
  const { data, isLoading, mutate } = useSWR(
    userId ? '/api/insights' : null,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    }
  )
  return {
    suggestions: (data?.suggestions ?? []) as Record<string, unknown>[],
    isLoading,
    refreshSuggestions: () => mutate(),
  }
}
