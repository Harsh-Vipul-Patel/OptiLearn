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
 * SWR hook for today's daily wellness check-in.
 * Returns the check-in data (or null if not yet done),
 * plus loading state and a mutate function for revalidation.
 */
export function useCheckin(userId: string) {
  const { data, isLoading, mutate } = useSWR(
    userId ? '/api/checkin' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  )

  return {
    checkin: data?.checkin ?? null,
    isLoading,
    refreshCheckin: () => mutate(),
  }
}
