import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export interface ExamGoalWithSubject {
  exam_goal_id: string
  user_id: string
  subject_id: string
  exam_name: string
  exam_date: string
  target_hours: number
  created_at: string
  updated_at: string
  subject?: {
    subject_id: string
    subject_name: string
  }
}

export function useExamGoals(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ goals: ExamGoalWithSubject[] }>(
    userId ? '/api/exam-goals' : null,
    fetcher,
    { revalidateOnFocus: true }
  )

  return {
    goals: data?.goals ?? [],
    isLoading,
    error,
    mutate,
  }
}
