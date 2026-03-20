import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export interface PlanWithDetails {
  plan_id: string
  plan_date: string
  time_slot: string | null
  target_duration: number
  studyTopic: {
    topic_id: string
    topic_name: string
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
export function usePlans(date?: string) {
  const today = date || new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const { data, error, isLoading, mutate } = useSWR<{ plans: PlanWithDetails[] }>(
    `/api/plans?date=${today}`,
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
