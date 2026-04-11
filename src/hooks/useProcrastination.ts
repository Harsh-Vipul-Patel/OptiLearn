import useSWR from 'swr'

export interface SkippedPlan {
  plan_id: string
  plan_date: string
  time_slot: string | null
  target_duration: number
  topic_name: string
  subject_name: string
  subject_id: string
  color: string | null
  procrastination_status: 'skipped' | 'abandoned'
}

export interface ProcrastinationData {
  skipped: SkippedPlan[]
  score: number
  risk: 'Low' | 'Medium' | 'High'
  viewReady: boolean
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.error || 'Request failed')
    return body as ProcrastinationData
  })

export function useProcrastination(userId: string) {
  const { data, isLoading, mutate } = useSWR<ProcrastinationData>(
    userId ? '/api/procrastination' : null,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
    }
  )

  return {
    skipped: data?.skipped ?? [],
    score: data?.score ?? 0,
    risk: data?.risk ?? 'Low',
    viewReady: data?.viewReady ?? false,
    isLoading,
    refresh: () => mutate(),
  }
}
