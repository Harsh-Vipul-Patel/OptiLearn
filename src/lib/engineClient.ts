// src/lib/engineClient.ts
const ENGINE_URL = process.env.ENGINE_API_URL
const ENGINE_KEY = process.env.ENGINE_API_KEY

export interface AnalyzePayload {
  log_id: string;
  user_id: string;
  plan_id: string;
  start_time: string;
  end_time: string;
  focus_level: number;
  distractions: string;
  reflection: string;
  target_duration: number;
  subject_category: string;
  topic_complexity: string;
}

export async function triggerEngineAnalysis(payload: AnalyzePayload) {
  const res = await fetch(`${ENGINE_URL}/engine/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-engine-key': ENGINE_KEY!
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`Engine error: ${res.status}`)
  return res.json()
}
