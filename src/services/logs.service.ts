import { createClient } from '@/lib/supabase/server'

type LogWithOwnership = {
  log_id?: string
  id?: string
  efficiency?: number | string | null
  throughput?: number | string | null
  quality_score?: number | string | null
  analyzed_at?: string | null
  dailyPlan?: {
    studyTopic?: {
      subject?: {
        user_id?: string
      }
    }
  }
}

type AnalysisMetrics = {
  log_id?: string | null
  efficiency?: number | null
  throughput?: number | null
  quality_score?: number | null
  analyzed_at?: string | null
}

type LegacyLogMetrics = {
  id?: string | null
  efficiency?: number | null
  throughput?: number | null
  quality_score?: number | null
  analyzed_at?: string | null
}

const getLogId = (log: { log_id?: string; id?: string }) => String(log.log_id || log.id || '')

const mergeMetrics = (
  log: LogWithOwnership,
  metrics?: { efficiency?: number | null; throughput?: number | null; quality_score?: number | null; analyzed_at?: string | null }
): LogWithOwnership => {
  if (!metrics) return log

  return {
    ...log,
    efficiency: metrics.efficiency ?? log.efficiency ?? null,
    throughput: metrics.throughput ?? log.throughput ?? null,
    quality_score: metrics.quality_score ?? log.quality_score ?? null,
    analyzed_at: metrics.analyzed_at ?? log.analyzed_at ?? null,
  }
}

export class LogsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async createLog(data: any) {
    const { data: log, error } = await createClient()
      .from('study_log')
      .insert([data])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return log
  }

  static async getLogs(userId: string) {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('study_log')
      .select(`
        *,
        dailyPlan:daily_plan (
          plan_id,
          plan_date,
          time_slot,
          topic_id,
          studyTopic:study_topic (
            subject_id,
            subject:subject (
              user_id,
              subject_name
            )
          )
        )
      `)
      // Filter by user through relation chain
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    // Filter in JS to ensure user_id ownership
    const ownedLogs = (data as LogWithOwnership[] | null)?.filter((log) => log.dailyPlan?.studyTopic?.subject?.user_id === userId) || []

    if (ownedLogs.length === 0) {
      return []
    }

    const logIds = ownedLogs
      .map((log) => getLogId(log))
      .filter((value) => value.length > 0)

    if (logIds.length === 0) {
      return ownedLogs
    }

    const metricsByLogId = new Map<string, { efficiency?: number | null; throughput?: number | null; quality_score?: number | null; analyzed_at?: string | null }>()

    const analysisResult = await supabase
      .from('study_log_analysis')
      .select('log_id, efficiency, throughput, quality_score, analyzed_at')
      .in('log_id', logIds)
      .order('analyzed_at', { ascending: false })

    if (!analysisResult.error) {
      for (const row of (analysisResult.data ?? []) as AnalysisMetrics[]) {
        const key = String(row.log_id || '')
        if (!key || metricsByLogId.has(key)) continue
        metricsByLogId.set(key, {
          efficiency: row.efficiency ?? null,
          throughput: row.throughput ?? null,
          quality_score: row.quality_score ?? null,
          analyzed_at: row.analyzed_at ?? null,
        })
      }
    }

    const legacyResult = await supabase
      .from('study_logs')
      .select('id, efficiency, throughput, quality_score, analyzed_at')
      .in('id', logIds)

    if (!legacyResult.error) {
      for (const row of (legacyResult.data ?? []) as LegacyLogMetrics[]) {
        const key = String(row.id || '')
        if (!key) continue

        const existing = metricsByLogId.get(key)
        metricsByLogId.set(key, {
          efficiency: existing?.efficiency ?? row.efficiency ?? null,
          throughput: existing?.throughput ?? row.throughput ?? null,
          quality_score: existing?.quality_score ?? row.quality_score ?? null,
          analyzed_at: existing?.analyzed_at ?? row.analyzed_at ?? null,
        })
      }
    }

    return ownedLogs.map((log) => mergeMetrics(log, metricsByLogId.get(getLogId(log))))
  }

  static async getPlanDetailsForAnalysis(planId: string) {
    const { data: plan, error } = await createClient()
      .from('daily_plan')
      .select(`
        target_duration,
        studyTopic:study_topic (
          complexity,
          subject:subject (
            subject_category
          )
        )
      `)
      .eq('plan_id', planId)
      .single()

    if (error) throw new Error(error.message)
    return plan
  }
}
