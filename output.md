# Coding Best Practices - 3 Example Modules

The following modules are written for the OptiLearn project style (Next.js + Supabase) and demonstrate:
- clear naming conventions
- consistent indentation and formatting
- small, focused methods
- meaningful comments only where helpful
- typed inputs and outputs for safer code

---

## Module 1: SubjectsService (`src/services/subjects.service.ts`)

```ts
import { createClient } from '@/lib/supabase/server'

type CreateSubjectInput = {
  userId: string
  name: string
  category?: string
}

type SubjectRow = {
  subject_id: string
  user_id: string
  subject_name: string
  subject_category: string | null
  created_at: string
}

// Keep error messages consistent across service methods.
function formatSupabaseError(context: string, message: string) {
  return `${context}: ${message}`
}

export class SubjectsService {
  // Fetch all subjects for one user, newest first.
  static async getSubjectsByUser(userId: string): Promise<SubjectRow[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('subject')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(formatSupabaseError('Failed to fetch subjects', error.message))
    }

    return data ?? []
  }

  // Use a typed input so callers pass only the expected fields.
  static async createSubject(input: CreateSubjectInput): Promise<SubjectRow> {
    const supabase = await createClient()

    const payload = {
      user_id: input.userId,
      subject_name: input.name,
      subject_category: input.category ?? null,
    }

    const { data, error } = await supabase
      .from('subject')
      .insert([payload])
      .select('*')
      .single()

    if (error) {
      throw new Error(formatSupabaseError('Failed to create subject', error.message))
    }

    return data
  }

  // Require both subject and owner id to avoid deleting another user's data.
  static async deleteSubject(subjectId: string, userId: string): Promise<void> {
    const supabase = await createClient()

    const { error } = await supabase
      .from('subject')
      .delete()
      .eq('subject_id', subjectId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(formatSupabaseError('Failed to delete subject', error.message))
    }
  }
}
```

---

## Module 2: PlansService (`src/services/plans.service.ts`)

```ts
import { createClient } from '@/lib/supabase/server'

type CreatePlanInput = {
  topicId: string
  targetDuration: number
  planDate: string
  timeSlot?: string
  goalType?: string
}

type PlanRow = {
  plan_id: string
  topic_id: string
  target_duration: number
  plan_date: string
  time_slot: string | null
  goal_type: string | null
}

// Keep error messages consistent across service methods.
function formatSupabaseError(context: string, message: string) {
  return `${context}: ${message}`
}

export class PlansService {
  // Optional date filter lets the same method support "today" and "all plans" screens.
  static async getPlansByDate(userId: string, planDate?: string): Promise<PlanRow[]> {
    const supabase = await createClient()

    let query = supabase
      .from('daily_plan')
      .select(`
        *,
        studyTopic:study_topic (
          *,
          subject:subject (*)
        )
      `)
      .order('time_slot', { ascending: true })

    if (planDate) {
      query = query.eq('plan_date', planDate)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(formatSupabaseError('Failed to fetch plans', error.message))
    }

    // Ownership verification is kept explicit for readability and safety.
    return (data ?? []).filter(
      (plan) => plan.studyTopic?.subject?.user_id === userId
    )
  }

  // Normalize optional fields to null for cleaner DB writes.
  static async createPlan(input: CreatePlanInput): Promise<PlanRow> {
    const supabase = await createClient()

    const payload = {
      topic_id: input.topicId,
      target_duration: input.targetDuration,
      plan_date: input.planDate,
      time_slot: input.timeSlot ?? null,
      goal_type: input.goalType ?? null,
    }

    const { data, error } = await supabase
      .from('daily_plan')
      .insert([payload])
      .select('*')
      .single()

    if (error) {
      throw new Error(formatSupabaseError('Failed to create plan', error.message))
    }

    return data
  }
}
```

---

## Module 3: LogsService (`src/services/logs.service.ts`)

```ts
import { createClient } from '@/lib/supabase/server'

type CreateStudyLogInput = {
  planId: string
  durationMinutes: number
  focusScore?: number
  notes?: string
}

type StudyLogRow = {
  log_id: string
  plan_id: string
  duration_minutes: number
  focus_score: number | null
  notes: string | null
  created_at: string
}

type LogWithOwnership = {
  dailyPlan?: {
    studyTopic?: {
      subject?: {
        user_id?: string
      }
    }
  }
}

// Keep error messages consistent across service methods.
function formatSupabaseError(context: string, message: string) {
  return `${context}: ${message}`
}

export class LogsService {
  // Create one study session log linked to a specific daily plan.
  static async createLog(input: CreateStudyLogInput): Promise<StudyLogRow> {
    const supabase = await createClient()

    const payload = {
      plan_id: input.planId,
      duration_minutes: input.durationMinutes,
      focus_score: input.focusScore ?? null,
      notes: input.notes ?? null,
    }

    const { data, error } = await supabase
      .from('study_log')
      .insert([payload])
      .select('*')
      .single()

    if (error) {
      throw new Error(formatSupabaseError('Failed to create study log', error.message))
    }

    return data
  }

  // Fetch logs with ownership relation and filter to the current user.
  static async getLogsByUser(userId: string): Promise<LogWithOwnership[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('study_log')
      .select(`
        *,
        dailyPlan:daily_plan (
          topic_id,
          studyTopic:study_topic (
            subject_id,
            subject:subject (
              user_id
            )
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(formatSupabaseError('Failed to fetch study logs', error.message))
    }

    const rows = (data ?? []) as LogWithOwnership[]
    return rows.filter((log) => log.dailyPlan?.studyTopic?.subject?.user_id === userId)
  }
}
```

---

These three modules can be submitted as examples of clean, maintainable code that follows coding best practices for readability and structure.
