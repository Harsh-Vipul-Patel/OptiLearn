-- ═══════════════════════════════════════════════════
-- 013: Procrastination Stats View
-- Computes skipped or abandoned study sessions based on
-- past plan dates and overlapping actual study durations.
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vw_procrastination_stats AS
SELECT 
  dp.plan_id,
  s.user_id,
  dp.plan_date,
  dp.time_slot,
  dp.target_duration,
  st.topic_name,
  s.subject_name,
  s.subject_id,
  s.subject_color as color,
  CASE 
    WHEN sl.log_id IS NULL THEN 'skipped'
    WHEN (EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60) < (dp.target_duration * 0.5) THEN 'abandoned'
    ELSE 'completed'
  END as procrastination_status
FROM public.daily_plan dp
LEFT JOIN public.study_topic st ON st.topic_id = dp.topic_id
LEFT JOIN public.subject s ON s.subject_id = st.subject_id
LEFT JOIN public.study_log sl ON sl.plan_id = dp.plan_id
WHERE dp.plan_date < CURRENT_DATE
  -- Only include past plans that were actually skipped or abandoned to save query cost
  AND (
    sl.log_id IS NULL 
    OR (EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60) < (dp.target_duration * 0.5)
  );
