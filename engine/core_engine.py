"""
🧠 STUDYFLOW AI ANALYTICS & RECOMMENDATION ENGINE
==================================================

This is the CORE ALGORITHM - where the magic happens.

Integrates Cognitive Tensor Dynamics with your database schema to:
1. Analyze study sessions (STUDY_LOG)
2. Generate personalized suggestions (SUGGESTION)
3. Optimize study plans (DAILY_PLAN)
4. Predict optimal time slots and durations
5. Provide real-time feedback

Author: StudyFlow AI Team
Version: 1.0.0
"""

import numpy as np
from typing import Any, Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from enum import Enum
import logging
import os

import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EngineDataError(Exception):
    """Raised when required study context cannot be fetched from the database."""


class SupabaseRepository:
    """Fetches study context rows from Supabase PostgREST."""

    def __init__(self, supabase_url: str, service_key: str, timeout_seconds: float = 15.0):
        self.supabase_url = (supabase_url or '').rstrip('/')
        self.service_key = service_key or ''
        self.timeout_seconds = timeout_seconds

    @classmethod
    def from_env(cls) -> "SupabaseRepository":
        return cls(
            supabase_url=os.environ.get('SUPABASE_URL', ''),
            service_key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''),
        )

    @property
    def configured(self) -> bool:
        return bool(self.supabase_url and self.service_key)

    def _headers(self) -> Dict[str, str]:
        return {
            'apikey': self.service_key,
            'Authorization': f'Bearer {self.service_key}',
            'Accept': 'application/json',
        }

    def _query_one(self, table: str, select: str, filters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.configured:
            raise EngineDataError('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')

        params: Dict[str, str] = {
            'select': select,
            'limit': '1',
        }
        for key, value in filters.items():
            if value is None:
                continue
            params[key] = f'eq.{value}'

        url = f"{self.supabase_url}/rest/v1/{table}"

        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.get(url, headers=self._headers(), params=params)

        if response.status_code == 404:
            return None

        if response.status_code >= 400:
            logger.warning('Supabase query failed for %s: HTTP %s', table, response.status_code)
            return None

        rows = response.json()
        if not rows:
            return None

        return rows[0]

    def _query_many(self, table: str, select: str, filters: Dict[str, Any], limit: int = 1000) -> List[Dict[str, Any]]:
        if not self.configured:
            raise EngineDataError('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')

        params: Dict[str, str] = {
            'select': select,
            'limit': str(limit),
        }
        for key, value in filters.items():
            if value is None:
                continue
            params[key] = str(value)

        url = f"{self.supabase_url}/rest/v1/{table}"

        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.get(url, headers=self._headers(), params=params)

        if response.status_code == 404:
            return []

        if response.status_code >= 400:
            logger.warning('Supabase query failed for %s: HTTP %s', table, response.status_code)
            return []

        rows = response.json()
        if not rows:
            return []

        return rows

    def _post_rows(
        self,
        table: str,
        rows: List[Dict[str, Any]],
        *,
        upsert_on: Optional[str] = None,
        return_rows: bool = True,
    ) -> List[Dict[str, Any]]:
        if not rows:
            return []

        if not self.configured:
            raise EngineDataError('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')

        url = f"{self.supabase_url}/rest/v1/{table}"
        params: Dict[str, str] = {}
        if upsert_on:
            params['on_conflict'] = upsert_on

        headers = self._headers()
        prefer_parts = ['return=representation' if return_rows else 'return=minimal']
        if upsert_on:
            prefer_parts.append('resolution=merge-duplicates')
        headers['Prefer'] = ','.join(prefer_parts)
        headers['Content-Type'] = 'application/json'

        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(url, headers=headers, params=params, json=rows)

        if response.status_code >= 400:
            raise EngineDataError(f'Failed to persist rows in {table}: HTTP {response.status_code}')

        if not return_rows:
            return []

        body = response.json()
        return body if isinstance(body, list) else []

    def _delete_where(self, table: str, filters: Dict[str, Any]) -> None:
        if not self.configured:
            raise EngineDataError('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')

        params: Dict[str, str] = {}
        for key, value in filters.items():
            if value is None:
                continue
            params[key] = str(value)

        url = f"{self.supabase_url}/rest/v1/{table}"
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.delete(
                url,
                headers={**self._headers(), 'Prefer': 'return=minimal'},
                params=params,
            )

        if response.status_code >= 400:
            raise EngineDataError(f'Failed deleting rows from {table}: HTTP {response.status_code}')

    @staticmethod
    def _pick(row: Dict[str, Any], *keys: str) -> Any:
        for key in keys:
            if key in row and row[key] is not None:
                return row[key]
        return None

    @staticmethod
    def _parse_dt(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if not value:
            raise EngineDataError('Missing datetime value in study log')

        text = str(value)
        if text.endswith('Z'):
            text = text[:-1] + '+00:00'
        return datetime.fromisoformat(text)

    def _fetch_with_table_fallback(
        self,
        candidates: List[Tuple[str, str]],
        filters: Dict[str, Any],
    ) -> Tuple[str, Dict[str, Any]]:
        for table, select in candidates:
            row = self._query_one(table=table, select=select, filters=filters)
            if row:
                return table, row

        raise EngineDataError('No matching row found across schema variants')

    def _query_many_with_table_fallback(
        self,
        candidates: List[Tuple[str, str]],
        filters: Dict[str, Any],
        limit: int = 1000,
    ) -> Tuple[Optional[str], List[Dict[str, Any]]]:
        for table, select in candidates:
            rows = self._query_many(table=table, select=select, filters=filters, limit=limit)
            if rows:
                return table, rows
        return None, []

    def _fetch_by_id_candidates(
        self,
        candidates: List[Tuple[str, str]],
        id_value: Any,
        id_columns: List[str],
    ) -> Tuple[str, Dict[str, Any]]:
        for column in id_columns:
            try:
                return self._fetch_with_table_fallback(candidates=candidates, filters={column: id_value})
            except EngineDataError:
                continue

        raise EngineDataError(f'Unable to resolve row by id={id_value}')

    def fetch_study_session_context(self, log_id: str, user_id: str) -> Dict[str, Any]:
        log_table, log_row = self._fetch_by_id_candidates(
            candidates=[
                ('study_log', 'log_id,plan_id,start_time,end_time,focus_level,distractions,reflection,actual_duration'),
                ('study_logs', 'id,plan_id,user_id,start_time,end_time,focus_level,distractions,reflection'),
            ],
            id_value=log_id,
            id_columns=['log_id', 'id'],
        )

        row_user_id = self._pick(log_row, 'user_id')
        if row_user_id and str(row_user_id) != str(user_id):
            raise EngineDataError('Study log does not belong to provided user')

        plan_id = self._pick(log_row, 'plan_id')
        if not plan_id:
            raise EngineDataError('Study log has no plan_id')

        _, plan_row = self._fetch_by_id_candidates(
            candidates=[
                ('daily_plan', 'plan_id,topic_id,target_duration,time_slot,plan_date'),
                ('daily_plans', 'id,topic_id,target_duration,time_slot,plan_date'),
            ],
            id_value=plan_id,
            id_columns=['plan_id', 'id'],
        )

        topic_id = self._pick(plan_row, 'topic_id')
        if not topic_id:
            raise EngineDataError('Daily plan has no topic_id')

        _, topic_row = self._fetch_by_id_candidates(
            candidates=[
                ('study_topic', 'topic_id,subject_id,complexity,topic_name'),
                ('study_topics', 'id,subject_id,complexity,topic_name'),
            ],
            id_value=topic_id,
            id_columns=['topic_id', 'id'],
        )

        subject_id = self._pick(topic_row, 'subject_id')
        if not subject_id:
            raise EngineDataError('Study topic has no subject_id')

        _, subject_row = self._fetch_by_id_candidates(
            candidates=[
                ('subject', 'subject_id,user_id,subject_name,subject_category'),
                ('subjects', 'id,user_id,subject_name,subject_category'),
            ],
            id_value=subject_id,
            id_columns=['subject_id', 'id'],
        )

        subject_user_id = self._pick(subject_row, 'user_id')
        if subject_user_id and str(subject_user_id) != str(user_id):
            raise EngineDataError('Subject ownership check failed for provided user')

        target_duration = self._pick(log_row, 'target_duration', 'actual_duration')
        if target_duration is None:
            target_duration = self._pick(plan_row, 'target_duration')

        study_log = {
            'LogID': self._pick(log_row, 'log_id', 'id') or log_id,
            'PlanID': plan_id,
            'StartTime': self._parse_dt(self._pick(log_row, 'start_time')),
            'EndTime': self._parse_dt(self._pick(log_row, 'end_time')),
            'FocusLevel': int(self._pick(log_row, 'focus_level') or 3),
            'Distractions': str(self._pick(log_row, 'distractions') or ''),
            'Reflection': str(self._pick(log_row, 'reflection') or ''),
            'TargetDuration': int(target_duration or 60),
        }

        return {
            'study_log': study_log,
            'subject_category': self._pick(subject_row, 'subject_category', 'category') or 'General',
            'topic_complexity': self._pick(topic_row, 'complexity') or Complexity.MEDIUM.value,
            'source_table': log_table,
        }

    def fetch_today_log_ids_for_user(self, user_id: str, now_utc: Optional[datetime] = None) -> List[str]:
        """
        Resolve today's study logs for a user through ownership chain:
        subject(user_id) -> study_topic -> daily_plan -> study_log.
        """
        now_utc = now_utc or datetime.utcnow()
        day_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        _, subjects = self._query_many_with_table_fallback(
            candidates=[
                ('subject', 'subject_id'),
                ('subjects', 'id'),
            ],
            filters={'user_id': f'eq.{user_id}'},
        )
        subject_ids = [
            str(self._pick(item, 'subject_id', 'id'))
            for item in subjects
            if self._pick(item, 'subject_id', 'id')
        ]
        if not subject_ids:
            return []

        subject_csv = ','.join(subject_ids)
        _, topics = self._query_many_with_table_fallback(
            candidates=[
                ('study_topic', 'topic_id'),
                ('study_topics', 'id'),
            ],
            filters={'subject_id': f'in.({subject_csv})'},
        )
        topic_ids = [
            str(self._pick(item, 'topic_id', 'id'))
            for item in topics
            if self._pick(item, 'topic_id', 'id')
        ]
        if not topic_ids:
            return []

        topic_csv = ','.join(topic_ids)
        _, plans = self._query_many_with_table_fallback(
            candidates=[
                ('daily_plan', 'plan_id'),
                ('daily_plans', 'id'),
            ],
            filters={'topic_id': f'in.({topic_csv})'},
        )
        plan_ids = [
            str(self._pick(item, 'plan_id', 'id'))
            for item in plans
            if self._pick(item, 'plan_id', 'id')
        ]
        if not plan_ids:
            return []

        plan_csv = ','.join(plan_ids)
        _, logs = self._query_many_with_table_fallback(
            candidates=[
                ('study_log', 'log_id,start_time,end_time'),
                ('study_logs', 'id,start_time,end_time'),
            ],
            filters={'plan_id': f'in.({plan_csv})'},
            limit=4000,
        )

        today_ids: List[str] = []
        for item in logs:
            start_value = item.get('start_time')
            if not start_value:
                continue
            try:
                started = self._parse_dt(start_value)
            except Exception:
                continue

            started_naive = started.replace(tzinfo=None) if started.tzinfo else started
            row_log_id = self._pick(item, 'log_id', 'id')
            if day_start <= started_naive < day_end and row_log_id:
                today_ids.append(str(row_log_id))

        return today_ids

    def upsert_analysis_and_suggestions(self, user_id: str, result: Dict[str, Any]) -> Dict[str, Any]:
        log_id = result.get('LogID')
        if not log_id:
            raise EngineDataError('Missing LogID in analysis result')

        skills = result.get('SkillBreakdown') or {}

        analysis_row = {
            'log_id': log_id,
            'user_id': user_id,
            'efficiency': result.get('Efficiency'),
            'throughput': result.get('Throughput'),
            'effective_time': result.get('EffectiveTime'),
            'distraction_penalty': result.get('DistractionPenalty'),
            'flow_multiplier': result.get('FlowMultiplier'),
            'quality_score': result.get('QualityScore'),
            'skill_gf': skills.get('Gf'),
            'skill_gc': skills.get('Gc'),
            'skill_gv': skills.get('Gv'),
            'skill_gs': skills.get('Gs'),
            'skill_gwm': skills.get('Gwm'),
            'skill_glr': skills.get('Glr'),
            'skill_gcr': skills.get('Gcr'),
            'is_burnout_alert': bool(result.get('QualityScore', 0) < 40),
            'recommendations': result.get('Recommendations', []),
            'analyzed_at': datetime.utcnow().isoformat(),
        }

        analysis_id: Optional[str] = None
        inserted_count = 0

        # Prefer normalized analysis table when available.
        try:
            analysis_rows = self._post_rows(
                table='study_log_analysis',
                rows=[analysis_row],
                upsert_on='log_id',
                return_rows=True,
            )

            if not analysis_rows:
                raise EngineDataError('Unable to retrieve persisted analysis row')

            analysis_id = analysis_rows[0].get('analysis_id')
            if not analysis_id:
                raise EngineDataError('Persisted analysis row missing analysis_id')

            self._delete_where('suggestion', {'analysis_id': f'eq.{analysis_id}'})

            raw_recommendations = result.get('Recommendations', []) or []
            suggestion_rows = [
                {
                    'user_id': user_id,
                    'analysis_id': analysis_id,
                    'suggestion_text': text,
                    'suggestion_type': self._classify_suggestion_type(text),
                    'is_burnout_alert': 'burnout' in text.lower() or 'fatigue' in text.lower(),
                }
                for text in raw_recommendations
            ]

            inserted = self._post_rows(
                table='suggestion',
                rows=suggestion_rows,
                return_rows=True,
            ) if suggestion_rows else []
            inserted_count = len(inserted)
        except EngineDataError:
            # Fallback schema: persist metrics directly on study_logs/study_log and write suggestions table.
            metrics_row = {
                'efficiency': result.get('Efficiency'),
                'throughput': result.get('Throughput'),
                'quality_score': result.get('QualityScore'),
                'analyzed_at': datetime.utcnow().isoformat(),
            }

            updated = False
            for table, id_column in [('study_logs', 'id'), ('study_log', 'log_id')]:
                try:
                    url = f"{self.supabase_url}/rest/v1/{table}"
                    params = {
                        id_column: f'eq.{log_id}',
                        'user_id': f'eq.{user_id}',
                    }
                    with httpx.Client(timeout=self.timeout_seconds) as client:
                        response = client.patch(
                            url,
                            headers={
                                **self._headers(),
                                'Prefer': 'return=minimal',
                                'Content-Type': 'application/json',
                            },
                            params=params,
                            json=metrics_row,
                        )

                    if response.status_code < 400:
                        updated = True
                        break
                except Exception:
                    continue

            if not updated:
                logger.warning('Could not update fallback study log metrics for log_id=%s', log_id)

            raw_recommendations = result.get('Recommendations', []) or []
            suggestions_plural_rows = [
                {
                    'user_id': user_id,
                    'log_id': log_id,
                    'suggestion_text': text,
                    'suggestion_type': self._classify_suggestion_type(text),
                }
                for text in raw_recommendations
            ]

            try:
                self._delete_where('suggestions', {'log_id': f'eq.{log_id}'})
                inserted = self._post_rows(
                    table='suggestions',
                    rows=suggestions_plural_rows,
                    return_rows=True,
                ) if suggestions_plural_rows else []
                inserted_count = len(inserted)
            except EngineDataError:
                inserted_count = 0

        return {
            'analysis_id': analysis_id or str(log_id),
            'suggestion_count': inserted_count,
        }

    def fetch_recent_sessions_for_user(self, user_id: str, days: int = 30, limit: int = 60) -> List[Dict[str, Any]]:
        """
        Returns recent session records for one user using ownership chain.
        """
        if days <= 0:
            return []

        since = datetime.utcnow() - timedelta(days=days)

        _, subjects = self._query_many_with_table_fallback(
            candidates=[
                ('subject', 'subject_id'),
                ('subjects', 'id'),
            ],
            filters={'user_id': f'eq.{user_id}'},
            limit=500,
        )
        subject_ids = [
            str(self._pick(item, 'subject_id', 'id'))
            for item in subjects
            if self._pick(item, 'subject_id', 'id')
        ]
        if not subject_ids:
            return []

        _, topic_rows = self._query_many_with_table_fallback(
            candidates=[
                ('study_topic', 'topic_id,subject_id'),
                ('study_topics', 'id,subject_id'),
            ],
            filters={'subject_id': f'in.({",".join(subject_ids)})'},
            limit=2000,
        )
        topic_ids = [
            str(self._pick(item, 'topic_id', 'id'))
            for item in topic_rows
            if self._pick(item, 'topic_id', 'id')
        ]
        if not topic_ids:
            return []

        _, plan_rows = self._query_many_with_table_fallback(
            candidates=[
                ('daily_plan', 'plan_id,topic_id,time_slot'),
                ('daily_plans', 'id,topic_id,time_slot'),
            ],
            filters={'topic_id': f'in.({",".join(topic_ids)})'},
            limit=4000,
        )
        if not plan_rows:
            return []

        plan_meta: Dict[str, Dict[str, Any]] = {}
        for row in plan_rows:
            pid = self._pick(row, 'plan_id', 'id')
            if pid:
                plan_meta[str(pid)] = {
                    'topic_id': row.get('topic_id'),
                    'time_slot': row.get('time_slot'),
                }

        log_table, logs = self._query_many_with_table_fallback(
            candidates=[
                (
                    'study_log',
                    'log_id,plan_id,start_time,end_time,focus_level,distractions,reflection',
                ),
                (
                    'study_logs',
                    'id,plan_id,start_time,end_time,focus_level,distractions,reflection',
                ),
            ],
            filters={'plan_id': f'in.({",".join(plan_meta.keys())})'},
            limit=6000,
        )

        analysis_by_log_id: Dict[str, float] = {}
        if log_table == 'study_log' and logs:
            log_ids = [str(self._pick(row, 'log_id', 'id')) for row in logs if self._pick(row, 'log_id', 'id')]
            if log_ids:
                analysis_rows = self._query_many(
                    table='study_log_analysis',
                    select='log_id,efficiency',
                    filters={'log_id': f'in.({",".join(log_ids)})'},
                    limit=6000,
                )
                for row in analysis_rows:
                    row_log_id = row.get('log_id')
                    if row_log_id is not None and row.get('efficiency') is not None:
                        analysis_by_log_id[str(row_log_id)] = float(row.get('efficiency'))

        sessions: List[Dict[str, Any]] = []
        for row in logs:
            plan_id = row.get('plan_id')
            if not plan_id:
                continue
            meta = plan_meta.get(str(plan_id))
            if not meta:
                continue

            start_raw = row.get('start_time')
            end_raw = row.get('end_time')
            if not start_raw or not end_raw:
                continue

            try:
                start_dt = self._parse_dt(start_raw)
                end_dt = self._parse_dt(end_raw)
            except Exception:
                continue

            start_naive = start_dt.replace(tzinfo=None) if start_dt.tzinfo else start_dt
            if start_naive < since:
                continue

            row_log_id = self._pick(row, 'log_id', 'id')
            sessions.append({
                'LogID': row_log_id,
                'PlanID': plan_id,
                'StartTime': start_dt,
                'EndTime': end_dt,
                'TimeSlot': meta.get('time_slot') or 'Morning',
                'FocusLevel': int(row.get('focus_level') or 3),
                'Distractions': str(row.get('distractions') or ''),
                'Reflection': str(row.get('reflection') or ''),
                'Efficiency': float(
                    analysis_by_log_id.get(str(row_log_id), 0)
                ),
            })

        sessions.sort(key=lambda item: item.get('StartTime') or datetime.min, reverse=True)
        return sessions[:limit]

    @staticmethod
    def _classify_suggestion_type(text: str) -> str:
        lower = (text or '').lower()
        if 'burnout' in lower or 'risk' in lower or 'declining' in lower:
            return 'RiskAlert'
        if 'break' in lower or 'rest' in lower:
            return 'Rest'
        if 'excellent' in lower or 'great' in lower:
            return 'PositiveReinforcement'
        if 'schedule' in lower or 'morning' in lower or 'afternoon' in lower:
            return 'TimeSlot'
        if 'minute' in lower or 'duration' in lower:
            return 'Duration'
        if 'chunk' in lower or 'pomodoro' in lower:
            return 'TaskChunking'
        return 'SubjectTip'


class InsightExtractor:
    """
    Extracts pattern-level insights from current + historical sessions.
    """

    def __init__(self, user_id: str, min_sessions_for_patterns: int = 5):
        self.user_id = user_id
        self.min_sessions_for_patterns = min_sessions_for_patterns

    def extract_session_insights(self, current_session: Dict[str, Any], historical_sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        insights: Dict[str, Any] = {
            'meta': {
                'user_id': self.user_id,
                'session_count': len(historical_sessions) + 1,
                'analysis_type': 'pattern_based' if len(historical_sessions) >= self.min_sessions_for_patterns else 'baseline',
            }
        }

        insights['distraction_analysis'] = self._analyze_distraction_patterns(current_session, historical_sessions)
        insights['performance_correlations'] = self._find_performance_drivers(historical_sessions)
        insights['temporal_patterns'] = self._extract_temporal_insights(current_session, historical_sessions)
        insights['efficiency_trajectory'] = self._analyze_efficiency_trend(current_session, historical_sessions)
        insights['recommended_interventions'] = self._generate_intervention_vectors(insights)

        return insights

    @staticmethod
    def _split_distractions(raw: str) -> List[str]:
        if not raw:
            return []
        return [item.strip().upper() for item in str(raw).split(',') if item.strip()]

    def _analyze_distraction_patterns(self, current_session: Dict[str, Any], historical_sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        current_distractions = set(self._split_distractions(current_session.get('Distractions', '')))

        if not historical_sessions:
            return {
                'current_distractions': list(current_distractions),
                'pattern_detected': False,
                'insight': 'baseline_observation',
            }

        distraction_by_timeslot: Dict[str, Dict[str, int]] = {}
        distraction_by_efficiency: Dict[str, List[float]] = {}

        for session in historical_sessions:
            timeslot = str(session.get('TimeSlot') or 'Unknown')
            efficiency = float(session.get('Efficiency', 0) or 0)
            for dist in self._split_distractions(session.get('Distractions', '')):
                if dist not in distraction_by_timeslot:
                    distraction_by_timeslot[dist] = {}
                distraction_by_timeslot[dist][timeslot] = distraction_by_timeslot[dist].get(timeslot, 0) + 1
                distraction_by_efficiency.setdefault(dist, []).append(efficiency)

        patterns: Dict[str, Any] = {}
        for dist in current_distractions:
            slot_counts = distraction_by_timeslot.get(dist)
            if not slot_counts:
                continue

            most_common_slot = max(slot_counts.items(), key=lambda item: item[1])
            total = sum(slot_counts.values())
            patterns[dist] = {
                'frequency': total,
                'primary_timeslot': most_common_slot[0],
                'timeslot_concentration': (most_common_slot[1] / total) if total > 0 else 0,
                'avg_efficiency_when_present': float(np.mean(distraction_by_efficiency.get(dist, [0]))),
            }

        insight_text = None
        priority = 'low'

        if patterns:
            worst = max(
                patterns.items(),
                key=lambda item: item[1]['frequency'] * (1 - item[1]['avg_efficiency_when_present'] / 100),
            )
            dist_name, dist_data = worst
            if dist_data['timeslot_concentration'] > 0.6:
                insight_text = (
                    f"{dist_name} distraction is concentrated in {dist_data['primary_timeslot']} "
                    f"sessions ({dist_data['timeslot_concentration'] * 100:.0f}% of occurrences)"
                )
                priority = 'high'
            elif dist_data['frequency'] > len(historical_sessions) * 0.5:
                insight_text = (
                    f"{dist_name} is a chronic issue ({dist_data['frequency']}/{len(historical_sessions)} sessions), "
                    f"reducing efficiency to {dist_data['avg_efficiency_when_present']:.0f}% average"
                )
                priority = 'critical'

        return {
            'current_distractions': list(current_distractions),
            'pattern_detected': len(patterns) > 0,
            'patterns': patterns,
            'primary_insight': insight_text,
            'intervention_priority': priority,
        }

    def _find_performance_drivers(self, historical_sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        if len(historical_sessions) < 5:
            return {'sufficient_data': False}

        correlations: Dict[str, Any] = {}

        # Build timeslot averages directly from all sessions to avoid
        # contradictory signals where the same slot appears in both high/low buckets.
        slot_efficiencies: Dict[str, List[float]] = {}
        for session in historical_sessions:
            slot = str(session.get('TimeSlot') or 'Unknown')
            eff = float(session.get('Efficiency', 0) or 0)
            slot_efficiencies.setdefault(slot, []).append(eff)

        # Require at least 2 samples per slot for stability.
        slot_averages = {
            slot: float(np.mean(values))
            for slot, values in slot_efficiencies.items()
            if len(values) >= 2
        }

        if len(slot_averages) >= 2:
            best = max(slot_averages.items(), key=lambda item: item[1])
            worst = min(slot_averages.items(), key=lambda item: item[1])
            if best[0] != worst[0]:
                correlations['timeslot_driver'] = {
                    'best_timeslot': best[0],
                    'worst_timeslot': worst[0],
                    'best_avg_efficiency': best[1],
                    'worst_avg_efficiency': worst[1],
                    'delta': best[1] - worst[1],
                    'best_sample_size': len(slot_efficiencies.get(best[0], [])),
                    'worst_sample_size': len(slot_efficiencies.get(worst[0], [])),
                }

        return {
            'sufficient_data': True,
            'correlations': correlations,
        }

    def _extract_temporal_insights(self, current_session: Dict[str, Any], historical_sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        if len(historical_sessions) < 7:
            return {'sufficient_data': False}

        day_stats: Dict[str, List[float]] = {}
        for session in historical_sessions:
            started = session.get('StartTime')
            if not isinstance(started, datetime):
                continue
            day_name = started.strftime('%A')
            day_stats.setdefault(day_name, []).append(float(session.get('Efficiency', 0) or 0))

        day_averages = {day: float(np.mean(values)) for day, values in day_stats.items() if values}
        if len(day_averages) < 3:
            return {'sufficient_data': False}

        best_day = max(day_averages.items(), key=lambda item: item[1])
        worst_day = min(day_averages.items(), key=lambda item: item[1])

        current_start = current_session.get('StartTime')
        if not isinstance(current_start, datetime):
            current_start = datetime.utcnow()

        return {
            'day_of_week': {
                'best_day': best_day[0],
                'best_avg': best_day[1],
                'worst_day': worst_day[0],
                'worst_avg': worst_day[1],
                'delta': best_day[1] - worst_day[1],
                'current_day': current_start.strftime('%A'),
            }
        }

    def _analyze_efficiency_trend(self, current_session: Dict[str, Any], historical_sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        if len(historical_sessions) < 5:
            return {'sufficient_data': False}

        points: List[Tuple[datetime, float]] = []
        for session in historical_sessions:
            started = session.get('StartTime')
            if isinstance(started, datetime):
                started_naive = started.replace(tzinfo=None) if started.tzinfo else started
                points.append((started_naive, float(session.get('Efficiency', 0) or 0)))

        if len(points) < 5:
            return {'sufficient_data': False}

        points.sort(key=lambda item: item[0])
        base_day = points[0][0]
        x = np.array([(item[0] - base_day).days for item in points], dtype=float)
        y = np.array([item[1] for item in points], dtype=float)

        slope, intercept = np.polyfit(x, y, 1)
        now_days = (datetime.utcnow() - base_day).days
        predicted_next_week = float(slope * (now_days + 7) + intercept)
        weekly_change = float(slope * 7)

        return {
            'sufficient_data': True,
            'current_efficiency': float(current_session.get('Efficiency', 0) or 0),
            'trend_slope': float(slope),
            'weekly_change_rate': weekly_change,
            'predicted_next_week': predicted_next_week,
            'trajectory': 'improving' if slope > 0 else 'declining',
            'urgency': 'high' if abs(weekly_change) > 5 else 'normal',
        }

    def _generate_intervention_vectors(self, insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        interventions: List[Dict[str, Any]] = []

        dis = insights.get('distraction_analysis', {})
        if dis.get('pattern_detected') and dis.get('patterns'):
            for dist, data in dis['patterns'].items():
                if float(data.get('timeslot_concentration', 0)) > 0.6:
                    interventions.append({
                        'type': 'distraction_mitigation',
                        'priority': 'high',
                        'problem': f"{dist} concentrated in {data.get('primary_timeslot', 'unknown')}",
                        'solution_vector': f"Use blockers for {dist} during {data.get('primary_timeslot', 'that')} sessions",
                        'expected_improvement': f"+{(100 - float(data.get('avg_efficiency_when_present', 0))):.0f}% efficiency potential",
                    })

        perf = insights.get('performance_correlations', {}).get('correlations', {})
        if 'timeslot_driver' in perf:
            driver = perf['timeslot_driver']
            best_slot = str(driver.get('best_timeslot') or '')
            worst_slot = str(driver.get('worst_timeslot') or '')
            if best_slot and worst_slot and best_slot != worst_slot and float(driver.get('delta', 0)) > 20:
                interventions.append({
                    'type': 'schedule_optimization',
                    'priority': 'critical',
                    'problem': f"{worst_slot} sessions are underperforming",
                    'solution_vector': f"Shift hard topics to {best_slot}",
                    'expected_improvement': f"+{driver.get('delta', 0):.0f}% efficiency",
                })

        traj = insights.get('efficiency_trajectory', {})
        if traj.get('trajectory') == 'declining' and traj.get('urgency') == 'high':
            interventions.append({
                'type': 'trajectory_correction',
                'priority': 'critical',
                'problem': f"Efficiency declining {abs(float(traj.get('weekly_change_rate', 0))):.1f}%/week",
                'solution_vector': 'Run one-week reset: shorter sessions, stricter distraction controls, daily reflection',
                'timeframe': 'This week',
            })

        priority_rank = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        interventions.sort(key=lambda item: priority_rank.get(str(item.get('priority', 'low')), 3))
        return interventions[:5]

    @staticmethod
    def _recommendation_category(text: str) -> str:
        lower = text.lower()
        if 'declining' in lower or 'trending down' in lower or 'improving' in lower:
            return 'trend'
        if 'perform best during' in lower or 'sessions are underperforming' in lower or 'shift hard topics' in lower:
            return 'timeslot'
        if 'schedule harder topics on' in lower or 'sessions avg' in lower:
            return 'day_of_week'
        if 'average efficiency is' in lower or 'over your last' in lower:
            return 'summary'
        return 'general'

    def _merge_recommendations(self, primary: List[str], secondary: List[str], limit: int = 7) -> List[str]:
        merged: List[str] = []
        seen_text = set()
        seen_category = set()

        def add_text(text: str, keep_one_per_category: bool) -> None:
            normalized = text.strip()
            if not normalized:
                return
            if normalized in seen_text:
                return
            category = self._recommendation_category(normalized)
            if keep_one_per_category and category != 'general' and category in seen_category:
                return
            merged.append(normalized)
            seen_text.add(normalized)
            if category != 'general':
                seen_category.add(category)

        for item in primary:
            add_text(item, keep_one_per_category=True)
            if len(merged) >= limit:
                return merged[:limit]

        for item in secondary:
            add_text(item, keep_one_per_category=True)
            if len(merged) >= limit:
                return merged[:limit]

        return merged[:limit]


# ============================================================================
# ENUMS - Match Database Constraints
# ============================================================================

class TimeSlot(Enum):
    """Database constraint: CHECK (TimeSlot IN ('Morning', 'Afternoon', 'Evening', 'Night'))"""
    MORNING = "Morning"
    AFTERNOON = "Afternoon"
    EVENING = "Evening"
    NIGHT = "Night"


class Complexity(Enum):
    """Database constraint: CHECK (Complexity IN ('Easy', 'Medium', 'Hard'))"""
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class FocusLevel(Enum):
    """Database constraint: CHECK (FocusLevel BETWEEN 1 AND 5)"""
    VERY_LOW = 1
    LOW = 2
    MEDIUM = 3
    HIGH = 4
    VERY_HIGH = 5


class DistractionType(Enum):
    """Distraction types with research-backed penalty coefficients"""
    PHONE = 0.25  # 25% cognitive capacity loss
    SOCIAL_MEDIA = 0.30  # 30% capacity loss
    NOISE = 0.20  # 20% capacity loss
    TIRED = 0.35  # 35% capacity loss
    HUNGER = 0.15  # 15% capacity loss
    MULTITASKING = 0.40  # 40% capacity loss
    INTERRUPTIONS = 0.28  # 28% capacity loss


# ============================================================================
# COGNITIVE SKILL DIMENSIONS (CHC Theory)
# ============================================================================

class CognitiveSkill(Enum):
    """Based on Cattell-Horn-Carroll Theory of Intelligence"""
    FLUID_REASONING = "Gf"        # Novel problem solving
    CRYSTALLIZED_INTEL = "Gc"     # Knowledge retrieval
    VISUAL_SPATIAL = "Gv"         # Spatial processing
    PROCESSING_SPEED = "Gs"       # Cognitive fluency
    WORKING_MEMORY = "Gwm"        # Short-term retention
    LONG_TERM_MEMORY = "Glr"      # Information storage
    CREATIVITY = "Gcr"            # Synthesis & innovation


# ============================================================================
# SUBJECT COGNITIVE PROFILES
# ============================================================================

SUBJECT_PROFILES = {
    # Mathematics subjects
    "Mathematics": {
        CognitiveSkill.FLUID_REASONING: 0.90,
        CognitiveSkill.VISUAL_SPATIAL: 0.60,
        CognitiveSkill.PROCESSING_SPEED: 0.70,
        CognitiveSkill.WORKING_MEMORY: 0.75,
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.65,
        CognitiveSkill.LONG_TERM_MEMORY: 0.60,
        CognitiveSkill.CREATIVITY: 0.55,
    },
    
    # Physics subjects
    "Physics": {
        CognitiveSkill.VISUAL_SPATIAL: 0.95,
        CognitiveSkill.FLUID_REASONING: 0.90,
        CognitiveSkill.WORKING_MEMORY: 0.70,
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.75,
        CognitiveSkill.PROCESSING_SPEED: 0.65,
        CognitiveSkill.CREATIVITY: 0.70,
        CognitiveSkill.LONG_TERM_MEMORY: 0.60,
    },
    
    # Chemistry subjects
    "Chemistry": {
        CognitiveSkill.VISUAL_SPATIAL: 0.85,
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.80,
        CognitiveSkill.WORKING_MEMORY: 0.75,
        CognitiveSkill.FLUID_REASONING: 0.70,
        CognitiveSkill.LONG_TERM_MEMORY: 0.70,
        CognitiveSkill.PROCESSING_SPEED: 0.60,
        CognitiveSkill.CREATIVITY: 0.65,
    },
    
    # Biology subjects
    "Biology": {
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.90,
        CognitiveSkill.LONG_TERM_MEMORY: 0.85,
        CognitiveSkill.VISUAL_SPATIAL: 0.70,
        CognitiveSkill.WORKING_MEMORY: 0.65,
        CognitiveSkill.FLUID_REASONING: 0.60,
        CognitiveSkill.PROCESSING_SPEED: 0.55,
        CognitiveSkill.CREATIVITY: 0.50,
    },
    
    # Programming subjects
    "Programming": {
        CognitiveSkill.FLUID_REASONING: 0.90,
        CognitiveSkill.PROCESSING_SPEED: 0.85,
        CognitiveSkill.WORKING_MEMORY: 0.80,
        CognitiveSkill.CREATIVITY: 0.75,
        CognitiveSkill.VISUAL_SPATIAL: 0.65,
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.70,
        CognitiveSkill.LONG_TERM_MEMORY: 0.60,
    },
    
    # Languages
    "Languages": {
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.90,
        CognitiveSkill.LONG_TERM_MEMORY: 0.85,
        CognitiveSkill.WORKING_MEMORY: 0.75,
        CognitiveSkill.PROCESSING_SPEED: 0.65,
        CognitiveSkill.FLUID_REASONING: 0.50,
        CognitiveSkill.VISUAL_SPATIAL: 0.40,
        CognitiveSkill.CREATIVITY: 0.60,
    },
    
    # History
    "History": {
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.95,
        CognitiveSkill.LONG_TERM_MEMORY: 0.90,
        CognitiveSkill.FLUID_REASONING: 0.65,
        CognitiveSkill.CREATIVITY: 0.70,
        CognitiveSkill.WORKING_MEMORY: 0.60,
        CognitiveSkill.PROCESSING_SPEED: 0.55,
        CognitiveSkill.VISUAL_SPATIAL: 0.50,
    },
    
    # Literature
    "Literature": {
        CognitiveSkill.CRYSTALLIZED_INTEL: 0.90,
        CognitiveSkill.CREATIVITY: 0.85,
        CognitiveSkill.LONG_TERM_MEMORY: 0.75,
        CognitiveSkill.FLUID_REASONING: 0.70,
        CognitiveSkill.WORKING_MEMORY: 0.65,
        CognitiveSkill.PROCESSING_SPEED: 0.60,
        CognitiveSkill.VISUAL_SPATIAL: 0.40,
    },
}


# ============================================================================
# CORE ALGORITHM: COGNITIVE ANALYTICS ENGINE
# ============================================================================

class CognitiveAnalyticsEngine:
    """
    The Magic Happens Here! 🎯
    
    This engine:
    1. Analyzes STUDY_LOG entries using tensor mathematics
    2. Computes efficiency and throughput metrics
    3. Generates personalized SUGGESTION records
    4. Optimizes DAILY_PLAN recommendations
    """
    
    def __init__(self, repository: Optional[SupabaseRepository] = None):
        self.skill_dimensions = list(CognitiveSkill)
        self.repository = repository or SupabaseRepository.from_env()
        logger.info("🧠 Cognitive Analytics Engine initialized")

    def _build_current_session_for_insights(self, result: Dict[str, Any], study_log: Dict[str, Any], subject_category: str) -> Dict[str, Any]:
        return {
            'LogID': result.get('LogID'),
            'StartTime': study_log.get('StartTime'),
            'EndTime': study_log.get('EndTime'),
            'TimeSlot': self._infer_timeslot(study_log.get('StartTime')),
            'Distractions': study_log.get('Distractions', ''),
            'Efficiency': float(result.get('Efficiency', 0) or 0),
            'SubjectCategory': subject_category,
        }

    @staticmethod
    def _infer_timeslot(start_time: Any) -> str:
        if isinstance(start_time, datetime):
            hour = start_time.hour
            if 5 <= hour < 12:
                return TimeSlot.MORNING.value
            if 12 <= hour < 17:
                return TimeSlot.AFTERNOON.value
            if 17 <= hour < 21:
                return TimeSlot.EVENING.value
        return TimeSlot.NIGHT.value

    @staticmethod
    def _interventions_to_recommendations(interventions: List[Dict[str, Any]], limit: int = 2) -> List[str]:
        recs: List[str] = []
        for item in interventions[:limit]:
            problem = str(item.get('problem', '')).strip()
            solution = str(item.get('solution_vector', '')).strip()
            if problem and solution:
                recs.append(f"{problem}. Action: {solution}.")
        return recs

    def analyze_study_session_from_db(self, log_id: str, user_id: str) -> Dict:
        """
        Fetches raw study context from database and runs analytics.
        """
        context = self.repository.fetch_study_session_context(log_id=log_id, user_id=user_id)

        result = self.analyze_study_session(
            study_log=context['study_log'],
            subject_category=context['subject_category'],
            topic_complexity=context['topic_complexity'],
        )

        historical_raw = self.repository.fetch_recent_sessions_for_user(user_id=user_id, days=30, limit=60)
        historical = []
        for session in historical_raw:
            if str(session.get('LogID')) != str(log_id):
                historical.append(session)

        current_session = self._build_current_session_for_insights(
            result=result,
            study_log=context['study_log'],
            subject_category=context['subject_category'],
        )
        extractor = InsightExtractor(user_id=user_id)
        insight_bundle = extractor.extract_session_insights(
            current_session=current_session,
            historical_sessions=historical,
        )

        interventions = insight_bundle.get('recommended_interventions', [])
        intervention_recs = self._interventions_to_recommendations(interventions, limit=2)
        if intervention_recs:
            existing = list(result.get('Recommendations', []))
            for rec in intervention_recs:
                if rec not in existing:
                    existing.append(rec)
            result['Recommendations'] = existing[:7]

        result['InsightAnalysis'] = insight_bundle
        result['DataSource'] = 'database'

        return result

    def generate_today_insights_for_user(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze sessions for a user and persist insights.
        1. First tries today's logs.
        2. Falls back to historical sessions (last 30 days) for pattern-based insights.
        """
        log_ids = self.repository.fetch_today_log_ids_for_user(user_id=user_id)

        insights = []

        # ── Process today's logs ────────────────────────────────────────
        for log_id in log_ids:
            try:
                result = self.analyze_study_session_from_db(log_id=log_id, user_id=user_id)
                try:
                    persistence = self.repository.upsert_analysis_and_suggestions(user_id=user_id, result=result)
                    analysis_id = persistence.get('analysis_id', log_id)
                except Exception as persist_err:
                    logger.warning('Persistence error for log %s: %s', log_id, persist_err)
                    analysis_id = log_id
                insights.append({
                    'log_id': log_id,
                    'analysis_id': analysis_id,
                    'efficiency': result.get('Efficiency', 0),
                    'quality_score': result.get('QualityScore', 0),
                    'recommendations': result.get('Recommendations', []),
                })
            except Exception as analysis_err:
                logger.warning('Analysis error for log %s: %s', log_id, analysis_err)

        # ── Fallback: historical pattern-based insights ─────────────────
        if not insights:
            logger.info('No today-logs for user %s — falling back to historical insights', user_id)
            historical_sessions = self.repository.fetch_recent_sessions_for_user(
                user_id=user_id, days=30, limit=60,
            )
            if historical_sessions:
                # Use the most recent session as the "current" session for insight extraction
                most_recent = historical_sessions[0]
                current_session = {
                    'LogID': most_recent.get('LogID', 'historical'),
                    'StartTime': most_recent.get('StartTime'),
                    'EndTime': most_recent.get('EndTime'),
                    'TimeSlot': most_recent.get('TimeSlot', 'Morning'),
                    'Distractions': most_recent.get('Distractions', ''),
                    'Efficiency': float(most_recent.get('Efficiency', 0) or 0),
                    'FocusLevel': int(most_recent.get('FocusLevel', 3) or 3),
                }
                older_sessions = historical_sessions[1:]

                extractor = InsightExtractor(user_id=user_id)
                insight_bundle = extractor.extract_session_insights(
                    current_session=current_session,
                    historical_sessions=older_sessions,
                )
                interventions = insight_bundle.get('recommended_interventions', [])
                recs = self._interventions_to_recommendations(interventions, limit=5)

                # Also generate general pattern recommendations
                pattern_recs = self._generate_historical_recommendations(
                    historical_sessions, insight_bundle
                )
                recs = self._merge_recommendations(recs, pattern_recs, limit=7)

                if recs:
                    insights.append({
                        'log_id': 'historical_pattern',
                        'analysis_id': 'pattern_analysis',
                        'efficiency': current_session['Efficiency'],
                        'quality_score': 0,
                        'recommendations': recs,
                    })

        return {
            'user_id': user_id,
            'date': datetime.utcnow().date().isoformat(),
            'processed_logs': len(insights),
            'insights': insights,
        }

    def generate_llm_insights_for_user(self, user_id: str, wellness_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Full pipeline: statistical analysis → InsightExtractor → Gemini LLM.

        Returns LLM-generated natural-language actionable insights alongside
        the original statistical summary. Falls back to rule-based recs if
        the LLM is unavailable.

        Now enriched with:
        - session_summary: aggregate stats (avg efficiency, duration, hours, streak)
        - subjects_studied: list of subject names the student works on
        - student_profile: target exam, preferred study time (if available)
        - wellness_context: daily check-in data (sleep, energy, stress, mood, exercise, meal, screen time)
        """
        from llm_chain import get_insight_chain

        # Step 1: Run existing statistical pipeline
        summary = self.generate_today_insights_for_user(user_id=user_id)

        # Step 2: Collect rule-based recommendations as fallback
        fallback_recs: List[str] = []
        for insight in summary.get('insights', []):
            for rec in insight.get('recommendations', []):
                if rec and rec not in fallback_recs:
                    fallback_recs.append(rec)

        # Step 3: Build insight bundle for LLM
        insight_bundle: Dict[str, Any] = {}
        historical_sessions = self.repository.fetch_recent_sessions_for_user(
            user_id=user_id, days=30, limit=15,
        )
        if historical_sessions:
            most_recent = historical_sessions[0]
            current_session = {
                'LogID': most_recent.get('LogID', 'historical'),
                'StartTime': most_recent.get('StartTime'),
                'EndTime': most_recent.get('EndTime'),
                'TimeSlot': most_recent.get('TimeSlot', 'Morning'),
                'Distractions': most_recent.get('Distractions', ''),
                'Efficiency': float(most_recent.get('Efficiency', 0) or 0),
                'FocusLevel': int(most_recent.get('FocusLevel', 3) or 3),
            }
            extractor = InsightExtractor(user_id=user_id)
            insight_bundle = extractor.extract_session_insights(
                current_session=current_session,
                historical_sessions=historical_sessions[1:],
            )

        # ── Step 3b: Enrich insight bundle with minimal important context ──

        # Session summary: aggregate stats for Gemini context
        if historical_sessions:
            efficiencies = [
                float(s.get('Efficiency', 0) or 0) for s in historical_sessions
            ]
            durations = []
            timestamps = []
            for s in historical_sessions:
                st = s.get('StartTime')
                et = s.get('EndTime')
                if isinstance(st, datetime) and isinstance(et, datetime):
                    dur_min = (et - st).total_seconds() / 60
                    if 0 < dur_min < 720:  # only valid durations (< 12h)
                        durations.append(dur_min)
                if isinstance(st, datetime):
                    timestamps.append(st)

            # Compute study streak (consecutive days with sessions)
            study_streak = 0
            if timestamps:
                unique_days = sorted(set(t.date() for t in timestamps), reverse=True)
                if unique_days:
                    from datetime import date as _date
                    today = datetime.utcnow().date()
                    # Count consecutive days backwards from today/yesterday
                    check_date = today
                    if unique_days[0] < today:
                        check_date = unique_days[0]
                    for day in unique_days:
                        if day == check_date:
                            study_streak += 1
                            check_date = day - timedelta(days=1)
                        elif day < check_date:
                            break

            date_range = ""
            if timestamps:
                earliest = min(timestamps).strftime('%b %d')
                latest = max(timestamps).strftime('%b %d')
                date_range = f"{earliest} – {latest}"

            insight_bundle['session_summary'] = {
                'avg_efficiency': float(np.mean(efficiencies)) if efficiencies else 0,
                'avg_duration_minutes': float(np.mean(durations)) if durations else 0,
                'total_study_hours': sum(durations) / 60 if durations else 0,
                'date_range': date_range,
                'study_streak_days': study_streak,
                'total_sessions': len(historical_sessions),
            }

        # Subjects studied: fetch subject names for this user
        try:
            subject_names = self._fetch_subject_names_for_user(user_id)
            if subject_names:
                insight_bundle['subjects_studied'] = subject_names
        except Exception as subj_err:
            logger.debug('Could not fetch subject names: %s', subj_err)

        # Student profile: fetch from users table if available
        try:
            profile = self._fetch_student_profile(user_id)
            if profile:
                insight_bundle['student_profile'] = profile
        except Exception as prof_err:
            logger.debug('Could not fetch student profile: %s', prof_err)

        # ── Step 3c: Inject wellness context for planning-aware insights ──
        if wellness_context:
            readiness = self._compute_readiness_score(wellness_context)
            insight_bundle['wellness_context'] = wellness_context
            insight_bundle['readiness_score'] = readiness
            logger.info(
                'Wellness context for user %s: readiness=%d, sleep=%.1fh/q%d, energy=%d, stress=%d, mood=%s',
                user_id,
                readiness,
                wellness_context.get('sleep_hours', 0),
                wellness_context.get('sleep_quality', 0),
                wellness_context.get('energy_level', 0),
                wellness_context.get('stress_level', 0),
                wellness_context.get('mood', 'N/A'),
            )

        # Step 4: Call Gemini via LangChain/LangGraph
        chain = get_insight_chain()
        ai_insights = chain.generate_actionable_insights(
            raw_insights=insight_bundle,
            fallback_recommendations=fallback_recs,
        )

        summary['ai_insights'] = ai_insights
        summary['llm_used'] = chain.is_configured and len(ai_insights) > 0 and ai_insights != fallback_recs
        return summary

    def _fetch_subject_names_for_user(self, user_id: str) -> List[str]:
        """Fetch distinct subject names for a user (lightweight, best-effort)."""
        names: List[str] = []
        for table, select in [
            ('subject', 'subject_name'),
            ('subjects', 'subject_name'),
        ]:
            rows = self.repository._query_many(
                table=table,
                select=select,
                filters={'user_id': f'eq.{user_id}'},
                limit=20,
            )
            if rows:
                for row in rows:
                    name = row.get('subject_name')
                    if name and name not in names:
                        names.append(name)
                break  # found in this table variant
        return names

    def _fetch_student_profile(self, user_id: str) -> Dict[str, Any]:
        """Fetch student profile info (target exam, preferred study time, name)."""
        profile: Dict[str, Any] = {}
        for table, select in [
            ('users', 'name,target_exam,preferred_study_time'),
            ('user', 'name,target_exam,preferred_study_time'),
        ]:
            row = self.repository._query_one(
                table=table,
                select=select,
                filters={'id': user_id},
            )
            if row:
                if row.get('name'):
                    profile['name'] = row['name']
                if row.get('target_exam'):
                    profile['target_exam'] = row['target_exam']
                if row.get('preferred_study_time'):
                    profile['preferred_study_time'] = row['preferred_study_time']
                break
        return profile

    @staticmethod
    def _compute_readiness_score(wellness: Dict[str, Any]) -> int:
        """
        Compute a 0-100 cognitive readiness score from wellness metrics.

        Weighting based on neuroscience evidence:
        - Sleep quality (25%): strongest predictor of working-memory performance
        - Sleep duration (20%): normalized against 8h baseline
        - Energy level (20%): subjective arousal correlates with executive function
        - Stress level (15%): inverse — high cortisol impairs prefrontal function
        - Exercise (8%): acute BDNF release improves focus
        - Meal (5%): glucose stability for sustained attention
        - Screen time (7%): blue-light displacement of sleep architecture
        """
        sleep_hours = float(wellness.get('sleep_hours', 7) or 7)
        sleep_quality = int(wellness.get('sleep_quality', 3) or 3)
        energy = int(wellness.get('energy_level', 3) or 3)
        stress = int(wellness.get('stress_level', 2) or 2)
        exercised = bool(wellness.get('exercised_today', False))
        had_meal = bool(wellness.get('had_meal', False))
        screen = str(wellness.get('screen_time_last_night', 'Moderate') or 'Moderate')

        sleep_hours_norm = min(sleep_hours / 8.0, 1.0)
        sleep_quality_norm = (sleep_quality - 1) / 4.0
        energy_norm = (energy - 1) / 4.0
        stress_norm = (stress - 1) / 4.0

        screen_penalty = {'High': 0.07, 'Moderate': 0.02, 'Low': 0.0}.get(screen, 0.02)

        raw = (
            0.25 * sleep_quality_norm +
            0.20 * sleep_hours_norm +
            0.20 * energy_norm +
            0.15 * (1.0 - stress_norm) +
            (0.08 if exercised else 0) +
            (0.05 if had_meal else 0) -
            screen_penalty
        )

        return max(0, min(100, round(raw * 100)))

    def _generate_historical_recommendations(
        self,
        sessions: List[Dict[str, Any]],
        insight_bundle: Dict[str, Any],
    ) -> List[str]:
        """Generate user-friendly recommendations from historical patterns."""
        recs: List[str] = []

        # Temporal patterns
        temporal = insight_bundle.get('temporal_patterns', {})
        dow = temporal.get('day_of_week', {})
        best_day = dow.get('best_day')
        worst_day = dow.get('worst_day')
        if best_day and worst_day and best_day != worst_day and dow.get('delta', 0) > 10:
            recs.append(
                f"Your {best_day} sessions avg {dow['best_avg']:.0f}% efficiency vs "
                f"{dow['worst_avg']:.0f}% on {worst_day}. "
                f"This week, move one hard session from {worst_day} to {best_day}."
            )

        # Efficiency trajectory
        traj = insight_bundle.get('efficiency_trajectory', {})
        if traj.get('sufficient_data') and traj.get('trajectory') == 'declining':
            recs.append(
                f"Your efficiency is trending down ({traj.get('weekly_change_rate', 0):.1f}%/week). "
                f"Try shorter focused sessions to reverse the trend."
            )
        elif traj.get('sufficient_data') and traj.get('trajectory') == 'improving':
            recs.append(
                f"Great progress! Your efficiency is improving at "
                f"+{abs(traj.get('weekly_change_rate', 0)):.1f}%/week. Keep it up!"
            )

        # Performance correlations
        perf = insight_bundle.get('performance_correlations', {})
        if perf.get('sufficient_data'):
            corr = perf.get('correlations', {})
            ts_driver = corr.get('timeslot_driver', {})
            best_slot = ts_driver.get('best_timeslot')
            worst_slot = ts_driver.get('worst_timeslot')
            if best_slot and worst_slot and best_slot != worst_slot and ts_driver.get('delta', 0) > 15:
                recs.append(
                    f"You perform best during {best_slot} sessions "
                    f"({ts_driver.get('best_avg_efficiency', 0):.0f}% avg efficiency). "
                    f"Shift one demanding topic from {worst_slot} to {best_slot} for the next 7 days."
                )

        # Overall summary
        if sessions:
            avg_eff = sum(float(s.get('Efficiency', 0) or 0) for s in sessions) / len(sessions)
            recs.append(
                f"Over your last {len(sessions)} sessions, your average efficiency is "
                f"{avg_eff:.0f}%. {'Run a 7-day focus reset: cap sessions at 35-45 min, phone away, and add a 3-line reflection after each session.' if avg_eff < 60 else 'Solid performance! Keep your current session format and protect your top-performing time slots.'}"
            )

        return recs
    
    # ========================================================================
    # STEP 1: ANALYZE STUDY LOG - The Core Tensor Algorithm
    # ========================================================================
    
    def analyze_study_session(
        self, 
        study_log: Dict,
        subject_category: str,
        topic_complexity: str
    ) -> Dict:
        """
        🎯 THE MAIN ALGORITHM
        
        Analyzes a STUDY_LOG entry and computes cognitive metrics
        
        Input (from database):
        - study_log: {LogID, PlanID, StartTime, EndTime, FocusLevel, Distractions, Reflection}
        - subject_category: From SUBJECT.SubjectCategory
        - topic_complexity: From STUDY_TOPIC.Complexity
        
        Output:
        - Efficiency (η): 0-100%
        - Throughput (τ): Cognitive units
        - Skill breakdown: Per cognitive dimension
        - Recommendations: List[str]
        
        Algorithm: Cognitive Tensor Dynamics
        Formula: T = W × u
        Where:
          W = Cognitive Weight Matrix (subject-specific)
          u = User Session Vector [intensity, fidelity, sentiment]
          T = Throughput Vector (per cognitive skill)
        """
        
        logger.info(f"📊 Analyzing session {study_log.get('LogID', 'N/A')}")
        
        # --- Step 1.1: Parse distraction data ---
        distractions = self._parse_distractions(study_log.get('Distractions', ''))
        
        # --- Step 1.2: Compute distraction penalty (multiplicative model) ---
        distraction_penalty = self._compute_distraction_penalty(distractions)
        
        # --- Step 1.3: Compute flow multiplier based on focus level ---
        flow_multiplier = self._compute_flow_multiplier(
            study_log.get('FocusLevel', 3),
            distractions
        )
        
        # --- Step 1.4: Calculate effective study time ---
        start_time = study_log['StartTime']
        end_time = study_log['EndTime']
        actual_duration = (end_time - start_time).total_seconds() / 60  # minutes
        
        effective_time = actual_duration * flow_multiplier * distraction_penalty
        
        # --- Step 1.5: Build cognitive weight matrix W ---
        W = self._build_weight_matrix(subject_category, topic_complexity)
        
        # --- Step 1.6: Build user session vector u ---
        u = self._build_user_vector(
            effective_time=effective_time,
            target_duration=study_log.get('TargetDuration', actual_duration),
            focus_level=study_log.get('FocusLevel', 3),
            reflection=study_log.get('Reflection', '')
        )
        
        # --- Step 1.7: Compute throughput vector T = W × u ---
        T = W @ u
        
        # --- Step 1.8: Compute scalar throughput τ = ||T||₂ ---
        throughput = float(np.linalg.norm(T, ord=2))
        
        # --- Step 1.9: Compute efficiency η ---
        efficiency = self._compute_efficiency(T, W, distraction_penalty)
        
        # --- Step 1.10: Map throughput to individual skills ---
        skill_breakdown = {
            skill.value: float(T[i])
            for i, skill in enumerate(self.skill_dimensions)
        }
        
        # --- Step 1.11: Generate insights and recommendations ---
        recommendations = self._generate_recommendations(
            efficiency=efficiency,
            throughput=throughput,
            distractions=distractions,
            focus_level=study_log.get('FocusLevel', 3),
            actual_duration=actual_duration,
            skill_breakdown=skill_breakdown
        )
        
        # --- Step 1.12: Return analysis results ---
        return {
            'LogID': study_log.get('LogID'),
            'Efficiency': round(efficiency, 2),
            'Throughput': round(throughput, 2),
            'EffectiveTime': round(effective_time, 2),
            'DistractionPenalty': round(distraction_penalty, 3),
            'FlowMultiplier': round(flow_multiplier, 2),
            'SkillBreakdown': skill_breakdown,
            'Recommendations': recommendations,
            'QualityScore': self._compute_quality_score(efficiency, throughput),
            'AnalyzedAt': datetime.now()
        }
    
    # ========================================================================
    # STEP 2: PREDICT OPTIMAL STUDY PARAMETERS
    # ========================================================================
    
    def predict_optimal_plan(
        self,
        user_id: str,
        subject_category: str,
        historical_logs: List[Dict],
        user_profile: Dict
    ) -> Dict:
        """
        🔮 PREDICTION ALGORITHM
        
        Predicts optimal DAILY_PLAN parameters based on historical STUDY_LOG data
        
        Input:
        - user_id: USER.UserID
        - subject_category: SUBJECT.SubjectCategory
        - historical_logs: List of past STUDY_LOG entries
        - user_profile: USER_PROFILE data
        
        Output:
        - OptimalTimeSlot: 'Morning', 'Afternoon', 'Evening', or 'Night'
        - OptimalDuration: Minutes (integer)
        - PredictedEfficiency: Expected efficiency %
        - ConfidenceScore: 0-1
        - Suggestions: List[str] for SUGGESTION table
        """
        
        logger.info(f"🔮 Predicting optimal plan for user {user_id}, subject {subject_category}")
        
        if not historical_logs:
            # No history - use defaults
            return self._default_prediction(subject_category, user_profile)
        
        # --- Step 2.1: Analyze time slot performance ---
        timeslot_performance = self._analyze_timeslot_performance(historical_logs)
        optimal_timeslot = max(timeslot_performance.items(), key=lambda x: x[1]['avg_efficiency'])[0]
        
        # --- Step 2.2: Analyze duration patterns ---
        duration_analysis = self._analyze_duration_patterns(historical_logs)
        optimal_duration = duration_analysis['optimal_duration']
        
        # --- Step 2.3: Predict efficiency using regression ---
        predicted_efficiency = self._predict_efficiency(
            subject_category=subject_category,
            time_slot=optimal_timeslot,
            duration=optimal_duration,
            historical_logs=historical_logs
        )
        
        # --- Step 2.4: Compute confidence score ---
        confidence = min(1.0, len(historical_logs) / 20)  # Max confidence at 20+ sessions
        
        # --- Step 2.5: Identify risk factors ---
        risk_factors = self._identify_risk_factors(historical_logs)
        
        # --- Step 2.6: Generate actionable suggestions ---
        suggestions = self._generate_planning_suggestions(
            optimal_timeslot=optimal_timeslot,
            optimal_duration=optimal_duration,
            predicted_efficiency=predicted_efficiency,
            risk_factors=risk_factors,
            subject_category=subject_category
        )
        
        return {
            'UserID': user_id,
            'SubjectCategory': subject_category,
            'OptimalTimeSlot': optimal_timeslot,
            'OptimalDuration': int(optimal_duration),
            'PredictedEfficiency': round(predicted_efficiency, 2),
            'ConfidenceScore': round(confidence, 3),
            'RiskFactors': risk_factors,
            'Suggestions': suggestions,
            'TimeslotPerformance': timeslot_performance,
            'PredictedAt': datetime.now()
        }
    
    # ========================================================================
    # STEP 3: SMART TASK CHUNKING
    # ========================================================================
    
    def chunk_study_topics(
        self,
        topic_name: str,
        topic_complexity: str,
        available_duration: int,
        subject_category: str
    ) -> List[Dict]:
        """
        📚 INTELLIGENT TASK CHUNKING ALGORITHM
        
        Breaks down complex STUDY_TOPIC into optimal chunks
        
        Input:
        - topic_name: STUDY_TOPIC.TopicName
        - topic_complexity: 'Easy', 'Medium', or 'Hard'
        - available_duration: Total minutes available
        - subject_category: SUBJECT.SubjectCategory
        
        Output:
        - List of study chunks with:
          - ChunkName
          - EstimatedDuration
          - RecommendedOrder
          - CognitiveLoad
        """
        
        logger.info(f"📚 Chunking topic: {topic_name} ({topic_complexity})")
        
        # --- Step 3.1: Determine base chunk size based on complexity ---
        base_chunk_duration = {
            Complexity.EASY.value: 25,      # Pomodoro: 25 min
            Complexity.MEDIUM.value: 35,    # 35 min chunks
            Complexity.HARD.value: 45       # 45 min deep work
        }.get(topic_complexity, 30)
        
        # --- Step 3.2: Calculate optimal number of chunks ---
        num_chunks = max(1, int(available_duration / base_chunk_duration))
        chunk_duration = available_duration // num_chunks
        
        # --- Step 3.3: Get subject cognitive profile ---
        profile = SUBJECT_PROFILES.get(subject_category, {})
        
        # --- Step 3.4: Order chunks by cognitive load (ascending) ---
        # Start easy, build up to hard (spaced repetition principle)
        chunks = []
        
        for i in range(num_chunks):
            # Cognitive load increases gradually
            load_multiplier = 0.5 + (i / num_chunks) * 0.5  # 0.5 to 1.0
            
            chunk = {
                'ChunkID': f"{topic_name}_chunk_{i+1}",
                'ChunkName': f"{topic_name} - Part {i+1}",
                'EstimatedDuration': chunk_duration,
                'RecommendedOrder': i + 1,
                'CognitiveLoad': round(load_multiplier, 2),
                'PrimarySkills': self._identify_primary_skills(profile, top_n=2),
                'BreakAfter': i < num_chunks - 1,  # Break after each except last
                'BreakDuration': 5 if chunk_duration <= 30 else 10  # 5-10 min breaks
            }
            chunks.append(chunk)
        
        return chunks
    
    # ========================================================================
    # STEP 4: REAL-TIME FEEDBACK GENERATION
    # ========================================================================
    
    def generate_realtime_feedback(
        self,
        current_session: Dict,
        elapsed_time: int,
        current_focus_level: int
    ) -> Dict:
        """
        ⚡ REAL-TIME FEEDBACK ALGORITHM
        
        Provides live feedback during an active study session
        
        Input:
        - current_session: Active session data
        - elapsed_time: Minutes since StartTime
        - current_focus_level: Self-reported focus (1-5)
        
        Output:
        - Alert: Warning/encouragement message
        - SuggestedAction: Immediate action to take
        - PerformanceStatus: 'on_track', 'struggling', 'exceeding'
        """
        
        target_duration = current_session.get('TargetDuration', 60)
        progress = elapsed_time / target_duration if target_duration > 0 else 0
        
        # --- Detect focus issues ---
        if current_focus_level <= 2:
            return {
                'Alert': '⚠️ Low focus detected',
                'SuggestedAction': 'Take a 5-minute break. Walk, hydrate, or do breathing exercises.',
                'PerformanceStatus': 'struggling',
                'Severity': 'high'
            }
        
        # --- Detect extended sessions without breaks ---
        if elapsed_time > 50 and progress < 0.9:
            return {
                'Alert': '🕐 You\'ve been studying for 50+ minutes',
                'SuggestedAction': 'Take a 10-minute break to maintain quality.',
                'PerformanceStatus': 'on_track',
                'Severity': 'medium'
            }
        
        # --- Positive reinforcement ---
        if current_focus_level >= 4 and progress >= 0.5:
            return {
                'Alert': '🌟 Great focus! You\'re in the zone',
                'SuggestedAction': 'Keep going! You\'re making excellent progress.',
                'PerformanceStatus': 'exceeding',
                'Severity': 'low'
            }
        
        # --- Default on-track ---
        return {
            'Alert': '✅ Session progressing well',
            'SuggestedAction': 'Continue at current pace.',
            'PerformanceStatus': 'on_track',
            'Severity': 'low'
        }
    
    # ========================================================================
    # HELPER METHODS - Internal Calculations
    # ========================================================================
    
    def _parse_distractions(self, distraction_string: str) -> List[DistractionType]:
        """Parse comma-separated distraction string from database"""
        if not distraction_string:
            return []
        
        distractions = []
        for item in distraction_string.split(','):
            item = item.strip().upper()
            try:
                distractions.append(DistractionType[item])
            except KeyError:
                logger.warning(f"Unknown distraction type: {item}")
        
        return distractions
    
    def _compute_distraction_penalty(self, distractions: List[DistractionType]) -> float:
        """
        Multiplicative distraction penalty model
        Formula: P_factor = ∏(1 - λᵢ) for all active distractions
        
        Research: Distractions compound, not add
        """
        if not distractions:
            return 1.0
        
        capacity = 1.0
        for distraction in distractions:
            capacity *= (1 - distraction.value)
        
        return max(0.0, capacity)  # Never negative
    
    def _compute_flow_multiplier(
        self, 
        focus_level: int, 
        distractions: List[DistractionType]
    ) -> float:
        """
        Flow state time dilation
        
        Base multipliers by focus level:
        - 5 (Very High): 1.8x
        - 4 (High): 1.5x
        - 3 (Medium): 1.2x
        - 2 (Low): 1.0x
        - 1 (Very Low): 0.8x
        
        Damped if attention distractors present
        """
        base_multipliers = {
            5: 1.8,
            4: 1.5,
            3: 1.2,
            2: 1.0,
            1: 0.8
        }
        
        base = base_multipliers.get(focus_level, 1.0)
        
        # Damping for attention-breaking distractions
        attention_distractors = [
            d for d in distractions 
            if d in [DistractionType.PHONE, DistractionType.SOCIAL_MEDIA, DistractionType.INTERRUPTIONS]
        ]
        
        if attention_distractors:
            penalty = sum(d.value for d in attention_distractors)
            dampened = 1 + (base - 1) * np.exp(-3 * penalty)
            return dampened
        
        return base
    
    def _build_weight_matrix(
        self, 
        subject_category: str, 
        topic_complexity: str
    ) -> np.ndarray:
        """
        Build cognitive weight matrix W
        
        Rows: Cognitive skills (7 dimensions)
        Columns: Session features (3: intensity, fidelity, sentiment)
        
        Returns: (7, 3) matrix
        """
        # Get subject profile
        profile = SUBJECT_PROFILES.get(subject_category, {})
        
        # Complexity multipliers
        complexity_mult = {
            Complexity.EASY.value: 0.8,
            Complexity.MEDIUM.value: 1.0,
            Complexity.HARD.value: 1.3
        }.get(topic_complexity, 1.0)
        
        W = np.zeros((len(self.skill_dimensions), 3))
        
        for i, skill in enumerate(self.skill_dimensions):
            base_weight = profile.get(skill, 0.5) * complexity_mult
            
            # Column weights
            W[i, 0] = base_weight * 1.0   # Intensity
            W[i, 1] = base_weight * 1.2   # Fidelity (completion matters more)
            W[i, 2] = base_weight * 0.7   # Sentiment
        
        return W
    
    def _build_user_vector(
        self,
        effective_time: float,
        target_duration: float,
        focus_level: int,
        reflection: str
    ) -> np.ndarray:
        """
        Build user session vector u
        
        Components:
        1. Intensity: effective_time / target_duration
        2. Fidelity: Focus level normalized (0-1)
        3. Sentiment: Reflection sentiment score (0-1)
        
        Returns: (3,) vector
        """
        # Intensity
        intensity = min(2.0, effective_time / max(target_duration, 1))
        
        # Fidelity (focus level normalized)
        fidelity = (focus_level - 1) / 4  # Map 1-5 to 0-1
        
        # Sentiment (simple keyword analysis)
        sentiment = self._analyze_sentiment(reflection)
        
        return np.array([intensity, fidelity, sentiment])
    
    def _compute_efficiency(
        self,
        T: np.ndarray,
        W: np.ndarray,
        distraction_penalty: float
    ) -> float:
        """
        Compute efficiency as percentage of theoretical maximum
        
        Formula: η = (τ / τ_max) × P_factor × 100%
        """
        # Actual throughput
        tau = np.linalg.norm(T, ord=2)
        
        # Theoretical maximum (perfect inputs)
        u_max = np.array([1.0, 1.0, 1.0])
        T_max = W @ u_max
        tau_max = np.linalg.norm(T_max, ord=2)
        
        if tau_max == 0:
            return 0.0
        
        efficiency = (tau / tau_max) * distraction_penalty * 100
        
        return min(100.0, max(0.0, efficiency))
    
    def _analyze_sentiment(self, text: str) -> float:
        """Simple sentiment analysis of reflection text"""
        if not text:
            return 0.5
        
        text_lower = text.lower()
        
        positive_keywords = [
            'good', 'great', 'excellent', 'productive', 'focused',
            'understood', 'progress', 'clear', 'success', 'easy'
        ]
        
        negative_keywords = [
            'bad', 'difficult', 'hard', 'confused', 'struggled',
            'distracted', 'tired', 'frustrating', 'unclear', 'failed'
        ]
        
        pos_count = sum(1 for word in positive_keywords if word in text_lower)
        neg_count = sum(1 for word in negative_keywords if word in text_lower)
        
        if pos_count + neg_count == 0:
            return 0.5
        
        score = (pos_count - neg_count + (pos_count + neg_count)) / (2 * (pos_count + neg_count))
        
        return max(0.0, min(1.0, score))
    
    def _compute_quality_score(self, efficiency: float, throughput: float) -> float:
        """
        Composite quality score
        Combines efficiency and throughput
        """
        # Normalize throughput (typical range 0-5)
        norm_throughput = min(1.0, throughput / 5.0)
        norm_efficiency = efficiency / 100.0
        
        # Weighted average (60% efficiency, 40% throughput)
        quality = 0.6 * norm_efficiency + 0.4 * norm_throughput
        
        return round(quality * 100, 1)
    
    def _generate_recommendations(
        self,
        efficiency: float,
        throughput: float,
        distractions: List[DistractionType],
        focus_level: int,
        actual_duration: float,
        skill_breakdown: Dict
    ) -> List[str]:
        """Generate actionable recommendations for SUGGESTION table"""
        recommendations = []
        
        # Efficiency-based
        if efficiency < 50:
            recommendations.append("⚠️ Low efficiency detected. Focus on eliminating distractions before next session.")
        elif efficiency >= 80:
            recommendations.append("🌟 Excellent efficiency! Replicate these conditions.")
        
        # Distraction-specific
        if DistractionType.PHONE in distractions:
            recommendations.append("📱 Try airplane mode or app blockers (Freedom, Forest)")
        
        if DistractionType.TIRED in distractions:
            recommendations.append("😴 Consider studying earlier or after rest")
        
        if DistractionType.MULTITASKING in distractions:
            recommendations.append("🎯 Single-task next time. Close all other tabs/apps.")
        
        # Focus-based
        if focus_level <= 2:
            recommendations.append("🧘 Try Pomodoro technique: 25 min work, 5 min break")
        
        # Duration-based
        if actual_duration > 90:
            recommendations.append("⏱️ Long session detected. Break into 45-60 min chunks with breaks.")
        
        # Skill-specific
        top_skill = max(skill_breakdown.items(), key=lambda x: x[1])
        recommendations.append(f"🧠 Primary cognitive demand: {top_skill[0]}")
        
        return recommendations[:5]  # Limit to top 5
    
    def _analyze_timeslot_performance(self, historical_logs: List[Dict]) -> Dict:
        """Analyze which time slots work best for this user"""
        timeslot_stats = {
            TimeSlot.MORNING.value: {'count': 0, 'total_eff': 0},
            TimeSlot.AFTERNOON.value: {'count': 0, 'total_eff': 0},
            TimeSlot.EVENING.value: {'count': 0, 'total_eff': 0},
            TimeSlot.NIGHT.value: {'count': 0, 'total_eff': 0}
        }
        
        for log in historical_logs:
            slot = log.get('TimeSlot', 'Morning')
            eff = log.get('Efficiency', 0)
            
            if slot in timeslot_stats:
                timeslot_stats[slot]['count'] += 1
                timeslot_stats[slot]['total_eff'] += eff
        
        # Calculate averages
        for slot in timeslot_stats:
            count = timeslot_stats[slot]['count']
            if count > 0:
                timeslot_stats[slot]['avg_efficiency'] = timeslot_stats[slot]['total_eff'] / count
            else:
                timeslot_stats[slot]['avg_efficiency'] = 0
        
        return timeslot_stats
    
    def _analyze_duration_patterns(self, historical_logs: List[Dict]) -> Dict:
        """Find optimal study duration"""
        duration_buckets = {
            25: [],   # Short Pomodoro
            45: [],   # Medium
            60: [],   # Standard hour
            90: []    # Deep work
        }
        
        for log in historical_logs:
            duration = (log['EndTime'] - log['StartTime']).total_seconds() / 60
            eff = log.get('Efficiency', 0)
            
            # Assign to nearest bucket
            if duration < 35:
                duration_buckets[25].append(eff)
            elif duration < 52:
                duration_buckets[45].append(eff)
            elif duration < 75:
                duration_buckets[60].append(eff)
            else:
                duration_buckets[90].append(eff)
        
        # Find best duration
        best_duration = 45  # default
        best_avg = 0
        
        for dur, effs in duration_buckets.items():
            if effs:
                avg = sum(effs) / len(effs)
                if avg > best_avg:
                    best_avg = avg
                    best_duration = dur
        
        return {
            'optimal_duration': best_duration,
            'duration_analysis': {
                dur: {'avg_eff': sum(effs)/len(effs) if effs else 0, 'count': len(effs)}
                for dur, effs in duration_buckets.items()
            }
        }
    
    def _predict_efficiency(
        self,
        subject_category: str,
        time_slot: str,
        duration: int,
        historical_logs: List[Dict]
    ) -> float:
        """Simple regression to predict efficiency"""
        # Filter similar sessions
        similar = [
            log for log in historical_logs
            if log.get('SubjectCategory') == subject_category
        ]
        
        if not similar:
            return 60.0  # Default prediction
        
        # Average efficiency of similar sessions
        avg_eff = sum(log.get('Efficiency', 0) for log in similar) / len(similar)
        
        return avg_eff
    
    def _identify_risk_factors(self, historical_logs: List[Dict]) -> List[str]:
        """Identify patterns that reduce performance"""
        risks = []
        
        # Common distractions
        all_distractions = []
        for log in historical_logs:
            all_distractions.extend(self._parse_distractions(log.get('Distractions', '')))
        
        if all_distractions:
            most_common = max(set(all_distractions), key=all_distractions.count)
            risks.append(f"Frequent {most_common.name.lower()} distractions")
        
        # Low focus trend
        recent_focus = [log.get('FocusLevel', 3) for log in historical_logs[-5:]]
        if recent_focus and sum(recent_focus) / len(recent_focus) < 2.5:
            risks.append("Declining focus levels in recent sessions")
        
        return risks
    
    def _generate_planning_suggestions(
        self,
        optimal_timeslot: str,
        optimal_duration: int,
        predicted_efficiency: float,
        risk_factors: List[str],
        subject_category: str
    ) -> List[str]:
        """Generate suggestions for SUGGESTION table"""
        suggestions = []
        
        suggestions.append(f"📅 Schedule for {optimal_timeslot} for best results")
        suggestions.append(f"⏱️ Aim for {optimal_duration}-minute sessions")
        
        if predicted_efficiency < 60:
            suggestions.append("⚠️ Expected efficiency is low. Address risk factors first.")
        
        for risk in risk_factors:
            suggestions.append(f"🔴 {risk}")
        
        # Subject-specific tip
        if subject_category == "Mathematics":
            suggestions.append("📐 Have scratch paper ready for derivations")
        elif subject_category == "Programming":
            suggestions.append("💻 Set up your IDE and close other apps before starting")
        elif subject_category == "Languages":
            suggestions.append("🗣️ Practice active recall with flashcards")
        
        return suggestions
    
    def _default_prediction(self, subject_category: str, user_profile: Dict) -> Dict:
        """Default prediction when no history exists"""
        preferred_time = user_profile.get('PreferredStudyTime', 'Morning')
        
        return {
            'OptimalTimeSlot': preferred_time,
            'OptimalDuration': 45,
            'PredictedEfficiency': 65.0,
            'ConfidenceScore': 0.1,
            'RiskFactors': ['No historical data available'],
            'Suggestions': [
                f"Start with {preferred_time} sessions as per your preference",
                "Try 45-minute sessions with 10-minute breaks",
                "Log at least 5 sessions for personalized predictions"
            ]
        }
    
    def _identify_primary_skills(self, profile: Dict, top_n: int = 2) -> List[str]:
        """Identify top cognitive skills for a subject"""
        if not profile:
            return []
        
        sorted_skills = sorted(profile.items(), key=lambda x: x[1], reverse=True)
        return [skill[0].value for skill in sorted_skills[:top_n]]


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Initialize engine
    engine = CognitiveAnalyticsEngine()
    
    # Example 1: Analyze a study session
    study_log = {
        'LogID': 'abc-123',
        'PlanID': 'plan-456',
        'StartTime': datetime(2026, 2, 4, 9, 0),
        'EndTime': datetime(2026, 2, 4, 10, 30),
        'FocusLevel': 4,
        'Distractions': 'PHONE,NOISE',
        'Reflection': 'Good progress but got distracted by notifications',
        'TargetDuration': 90
    }
    
    result = engine.analyze_study_session(
        study_log=study_log,
        subject_category='Mathematics',
        topic_complexity='Hard'
    )
    
    print("=" * 70)
    print("🎯 STUDY SESSION ANALYSIS")
    print("=" * 70)
    print(f"Efficiency: {result['Efficiency']}%")
    print(f"Throughput: {result['Throughput']} cognitive units")
    print(f"Effective Time: {result['EffectiveTime']} min")
    print(f"Quality Score: {result['QualityScore']}/100")
    print("\nRecommendations:")
    for rec in result['Recommendations']:
        print(f"  • {rec}")
    
    # Example 2: Predict optimal plan
    historical = [
        {
            'StartTime': datetime(2026, 2, 1, 9, 0),
            'EndTime': datetime(2026, 2, 1, 10, 0),
            'FocusLevel': 4,
            'Distractions': '',
            'Efficiency': 78.5,
            'TimeSlot': 'Morning',
            'SubjectCategory': 'Mathematics'
        },
        {
            'StartTime': datetime(2026, 2, 2, 14, 0),
            'EndTime': datetime(2026, 2, 2, 15, 0),
            'FocusLevel': 3,
            'Distractions': 'TIRED',
            'Efficiency': 52.3,
            'TimeSlot': 'Afternoon',
            'SubjectCategory': 'Mathematics'
        }
    ]
    
    prediction = engine.predict_optimal_plan(
        user_id='user-789',
        subject_category='Mathematics',
        historical_logs=historical,
        user_profile={'PreferredStudyTime': 'Morning'}
    )
    
    print("\n" + "=" * 70)
    print("🔮 OPTIMAL PLAN PREDICTION")
    print("=" * 70)
    print(f"Best Time Slot: {prediction['OptimalTimeSlot']}")
    print(f"Optimal Duration: {prediction['OptimalDuration']} minutes")
    print(f"Predicted Efficiency: {prediction['PredictedEfficiency']}%")
    print(f"Confidence: {prediction['ConfidenceScore'] * 100:.0f}%")
    print("\nSuggestions:")
    for sug in prediction['Suggestions']:
        print(f"  • {sug}")
    
    print("\n" + "=" * 70)
    print("✅ ALGORITHM DEMONSTRATION COMPLETE")
    print("=" * 70)
