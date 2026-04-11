-- ═══════════════════════════════════════════════════
-- 011: Weak Topics View
-- Computes aggregated statistics per topic to find
-- areas lacking in confidence or efficiency.
-- ═══════════════════════════════════════════════════

-- View to aggregate efficiency per topic
CREATE OR REPLACE VIEW public.topic_efficiency_stats AS
SELECT 
  dp.topic_id,
  AVG(sla.efficiency) as avg_efficiency,
  COUNT(sl.log_id) as session_count
FROM public.study_log_analysis sla
JOIN public.study_log sl ON sl.log_id = sla.log_id
JOIN public.daily_plan dp ON dp.plan_id = sl.plan_id
GROUP BY dp.topic_id;

-- View to aggregate confidence per topic
CREATE OR REPLACE VIEW public.topic_confidence_stats AS
SELECT 
  rs.topic_id,
  AVG(rr.confidence) as avg_confidence,
  COUNT(rr.response_id) as recall_count
FROM public.recall_response rr
JOIN public.recall_session rs ON rs.session_id = rr.session_id
GROUP BY rs.topic_id;

-- Combined View for discovering weak topics
CREATE OR REPLACE VIEW public.vw_user_topic_stats AS
SELECT 
  t.user_id,
  t.topic_id,
  t.topic_name,
  COALESCE(e.avg_efficiency, 0) as avg_efficiency,
  COALESCE(c.avg_confidence, 0) as avg_confidence,
  COALESCE(e.session_count, 0) as log_count,
  COALESCE(c.recall_count, 0) as recall_count,
  -- A topic is weak if its average confidence is <= 3 (if tested) OR efficiency is < 65% (if studied)
  CASE 
    WHEN c.recall_count > 0 AND c.avg_confidence <= 3 THEN true
    WHEN e.session_count > 0 AND e.avg_efficiency < 65 THEN true
    ELSE false
  END as is_weak
FROM (
  -- Subquery because topic -> subject -> user
  SELECT st.topic_id, st.topic_name, s.user_id
  FROM public.study_topic st
  JOIN public.subject s ON s.subject_id = st.subject_id
) t
LEFT JOIN public.topic_efficiency_stats e ON e.topic_id = t.topic_id
LEFT JOIN public.topic_confidence_stats c ON c.topic_id = t.topic_id;
