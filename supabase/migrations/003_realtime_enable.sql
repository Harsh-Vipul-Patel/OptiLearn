-- 8.1 Enable Realtime on Tables (Migration 003)
-- Enable Realtime for the tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;
