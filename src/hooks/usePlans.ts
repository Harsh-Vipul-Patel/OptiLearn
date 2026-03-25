import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export interface PlanWithDetails {
  plan_id: string
  plan_date: string
  time_slot: string | null
  target_duration: number
  logs?: Array<{ log_id: string }>
  studyTopic: {
    topic_id: string
    topic_name: string
    complexity: string
    subject: {
      subject_id: string
      subject_name: string
      subject_category: string | null
    }
  }
}

/**
 * Fetches today's (or a given date's) DailyPlans with subject+topic names included.
 * Used by LoggerPage to populate the plan selector dropdown.
 */
export function usePlans(date?: string, includeLogged = true) {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  params.set('include_logged', includeLogged ? 'true' : 'false')
  const query = params.toString() ? `?${params.toString()}` : ''
  const { data, error, isLoading, mutate } = useSWR<{ plans: PlanWithDetails[] }>(
    `/api/plans${query}`,
    fetcher,
    { revalidateOnFocus: true }
  )

  return {
    plans: data?.plans ?? [],
    isLoading,
    error,
    mutate,
  }
}
