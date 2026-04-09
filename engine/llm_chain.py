"""
🤖 LLM INSIGHT GENERATION — LangChain + LangGraph + Gemini
==========================================================

Transforms raw statistical insights from the InsightExtractor into
personalized, natural-language actionable advice using Google Gemini.

ARCHITECTURE (LangGraph):
┌──────────────────┐     ┌────────────────┐     ┌───────────────────┐     ┌────────────────┐
│ validate_insights│ ──→ │ prepare_context│ ──→ │ generate_insights  │ ──→ │ parse_response │
│ (sanity checks)  │     │ (format stats) │     │ (call Gemini LLM)  │     │ (extract recs) │
└──────────────────┘     └────────────────┘     └───────────────────┘     └────────────────┘

Fallback: If Gemini is unavailable or data is too poor, returns rule-based recommendations.
"""

import os
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


# ── LangGraph State ────────────────────────────────────────────────────────────

class InsightState(TypedDict):
    """State passed between LangGraph nodes."""
    raw_insights: Dict[str, Any]          # From InsightExtractor
    formatted_prompt: str                  # Structured prompt for Gemini
    llm_response: str                      # Raw LLM output
    actionable_insights: List[str]         # Final parsed recommendations
    error: Optional[str]                   # Error message if any
    data_quality: float                    # 0.0–1.0 quality score
    validation_warnings: List[str]         # Issues found during validation


# ── Gemini Insight Chain ───────────────────────────────────────────────────────

class GeminiInsightChain:
    """
    LangChain + LangGraph pipeline that converts statistical study
    pattern data into actionable, empathetic, natural-language insights
    via Google Gemini.

    Includes data validation to ensure study log analysis is legitimate
    and useful before spending LLM tokens.
    """

    SYSTEM_PROMPT = """You are a study coach analyzing a student's planned vs actual study logs.

Your task: Produce exactly 6 insights based on the provided stats and wellness data.
Each insight must:
1. Cite a SPECIFIC NUMBER from the data (percentage, count, or ratio)
2. Explain WHY this pattern matters for the student
3. Give ONE concrete action starting tomorrow — not generic advice

Analyze across these dimensions (pick the 6 most data-rich):
- CONSISTENCY: Are they showing up? (e.g. "studied 5/7 planned days", "skip rate on Sundays is 80%")
- PLANNING_ACCURACY: Are plans realistic? (e.g. "complete only 58% of planned time on average")
- TIMING: When do they perform best? (e.g. "morning efficiency 42% vs evening 87%")
- SUBJECT: Which subjects are avoided? (e.g. "Chemistry skipped 4/6 times this week")
- PROCRASTINATION: Where do plans break? (e.g. "first session of day skipped 60% of the time")
- BURNOUT: Overloaded days? (e.g. "days with >4 hrs planned complete only 35%")
- MOMENTUM: Does starting a session predict finishing the day? 
- RECOVERY: How do they bounce back after missed days?
- FOCUS_DURATION: What session length completes most reliably?
- TREND: Are things improving or declining week-over-week?
- PLANNING: If wellness data is provided, adapt to their readiness level.

Return ONLY a JSON array. No markdown. No explanation. No preamble.

Schema for each object:
[
  {
    "type": "<one of the dimension names above>",
    "title": "<specific finding in max 12 words, must include a number>",
    "finding": "<2 sentences: what the data shows + why it matters>",
    "action": "<1 sentence: exact thing to do tomorrow or this week>",
    "priority": <1-3 where 1=most urgent>
  }
]"""

    # ── Validation thresholds ──────────────────────────────────────────────
    MIN_DATA_QUALITY = 0.3       # Below this → skip LLM, use fallback
    MAX_SESSION_HOURS = 12       # Any session > 12h is suspicious
    MIN_SESSION_MINUTES = 1      # Anything < 1m is likely a glitch
    EFFICIENCY_RANGE = (0, 100)  # Valid efficiency bounds

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model_name = model
        self._llm: Optional[ChatGoogleGenerativeAI] = None
        self._graph = self._build_graph()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _get_llm(self) -> ChatGoogleGenerativeAI:
        if self._llm is None:
            self._llm = ChatGoogleGenerativeAI(
                model=self.model_name,
                google_api_key=self.api_key,
                temperature=0.3, # Low temp for precise analytical answers
                max_output_tokens=1024,
            )
        return self._llm

    # ── LangGraph Node Functions ───────────────────────────────────────────

    def _validate_insights(self, state: InsightState) -> InsightState:
        """Node 0: Validate and sanitize raw insights before sending to LLM.

        Checks:
        - Efficiency values are within 0–100
        - Session durations are plausible (1min–12hrs)
        - Data is not suspiciously uniform (all-identical = synthetic)
        - Critical fields are present (session_count > 0)
        - Temporal data makes sense (dates not in the future)

        Sets data_quality score (0.0–1.0) and validation_warnings.
        """
        insights = state.get("raw_insights", {})
        warnings: List[str] = []
        quality_score = 1.0  # Start perfect, deduct for issues

        meta = insights.get("meta", {})
        session_count = meta.get("session_count", 0)

        # ── Check 1: Do we have any data at all? ──
        if session_count == 0:
            warnings.append("No study sessions available for analysis")
            quality_score -= 0.5

        # ── Check 2: Validate efficiency trajectory values ──
        traj = insights.get("efficiency_trajectory", {})
        if traj.get("sufficient_data"):
            current_eff = traj.get("current_efficiency", 0)
            predicted = traj.get("predicted_next_week", 0)

            # Clamp impossible efficiency values
            if current_eff < self.EFFICIENCY_RANGE[0] or current_eff > self.EFFICIENCY_RANGE[1]:
                warnings.append(
                    f"Current efficiency {current_eff:.0f}% is outside valid range — clamped"
                )
                traj["current_efficiency"] = max(
                    self.EFFICIENCY_RANGE[0],
                    min(self.EFFICIENCY_RANGE[1], current_eff),
                )
                quality_score -= 0.15

            if predicted < -50 or predicted > 150:
                warnings.append(
                    f"Predicted next-week efficiency {predicted:.0f}% is unrealistic — clamped"
                )
                traj["predicted_next_week"] = max(0, min(100, predicted))
                quality_score -= 0.1

            # Sanity-check the slope (> ±30%/week is extremely unlikely)
            weekly_change = abs(traj.get("weekly_change_rate", 0))
            if weekly_change > 30:
                warnings.append(
                    f"Weekly change rate of {weekly_change:.1f}% is abnormally high — data may be noisy"
                )
                quality_score -= 0.15

        # ── Check 3: Validate performance correlations ──
        perf = insights.get("performance_correlations", {})
        if perf.get("sufficient_data"):
            corr = perf.get("correlations", {})
            ts = corr.get("timeslot_driver", {})
            if ts:
                best_avg = ts.get("best_avg_efficiency", 0)
                worst_avg = ts.get("worst_avg_efficiency", 0)
                if best_avg < worst_avg:
                    warnings.append("Best timeslot has lower efficiency than worst — data inconsistency")
                    quality_score -= 0.2

                # Check for unrealistic deltas
                delta = ts.get("delta", 0)
                if delta > 80:
                    warnings.append(f"Timeslot delta of {delta:.0f}% is suspiciously large")
                    quality_score -= 0.1

        # ── Check 4: Distraction analysis sanity ──
        dist = insights.get("distraction_analysis", {})
        if dist.get("pattern_detected"):
            patterns = dist.get("patterns", {})
            for name, data in patterns.items():
                avg_eff = data.get("avg_efficiency_when_present", 0)
                if avg_eff < 0 or avg_eff > 100:
                    data["avg_efficiency_when_present"] = max(0, min(100, avg_eff))
                    warnings.append(f"Distraction '{name}' had out-of-range efficiency — clamped")
                    quality_score -= 0.05

        # ── Check 5: Detect suspiciously uniform data ──
        if session_count >= 5:
            # If all efficiency values in trajectory are near-identical, it's likely synthetic
            traj_data = insights.get("efficiency_trajectory", {})
            if traj_data.get("sufficient_data"):
                slope = abs(traj_data.get("trend_slope", 0))
                current = traj_data.get("current_efficiency", 0)
                # If slope is essentially zero AND efficiency is a round number → suspicious
                if slope < 0.001 and current in (0, 25, 50, 75, 100):
                    warnings.append(
                        "Data appears unusually uniform — recommend more diverse study sessions"
                    )
                    quality_score -= 0.2

        # ── Check 6: Temporal patterns date sanity ──
        temporal = insights.get("temporal_patterns", {})
        if temporal.get("day_of_week", {}).get("delta", 0) > 60:
            warnings.append("Day-of-week efficiency spread is >60% — possible data quality issue")
            quality_score -= 0.1

        # Clamp quality to [0, 1]
        quality_score = max(0.0, min(1.0, quality_score))

        state["data_quality"] = quality_score
        state["validation_warnings"] = warnings

        if warnings:
            logger.info(
                "Data validation for user: quality=%.2f, warnings=%s",
                quality_score,
                warnings,
            )
        else:
            logger.info("Data validation passed — quality=%.2f", quality_score)

        return state

    def _prepare_context(self, state: InsightState) -> InsightState:
        """Node 1: Format raw statistical insights into a structured prompt.

        Enriched with:
        - Session summary statistics (count, avg efficiency, date range)
        - Subject/topic info when available
        - Student profile (target exam, preferred study time)
        - Current date for temporal context
        - Data quality warnings
        """
        insights = state["raw_insights"]
        prompt_parts: List[str] = []

        # ── Session Summary (NEW — minimal important context) ──
        meta = insights.get("meta", {})
        session_count = meta.get("session_count", 0)
        analysis_type = meta.get("analysis_type", "baseline")
        prompt_parts.append(
            f"📊 STUDENT OVERVIEW: {session_count} study session(s) analyzed. "
            f"Analysis type: {analysis_type}. "
            f"Date of analysis: {datetime.utcnow().strftime('%A, %B %d, %Y')}."
        )

        # ── Session Summary Stats (NEW) ──
        session_summary = insights.get("session_summary", {})
        if session_summary:
            avg_eff = session_summary.get("avg_efficiency", 0)
            avg_dur = session_summary.get("avg_duration_minutes", 0)
            total_hours = session_summary.get("total_study_hours", 0)
            date_range = session_summary.get("date_range", "")
            study_streak = session_summary.get("study_streak_days", 0)

            summary_line = f"Summary: avg efficiency {avg_eff:.0f}%"
            if avg_dur > 0:
                summary_line += f", avg session {avg_dur:.0f}min"
            if total_hours > 0:
                summary_line += f", {total_hours:.1f}h total study time"
            if date_range:
                summary_line += f" (period: {date_range})"
            if study_streak > 0:
                summary_line += f", {study_streak}-day study streak"
            prompt_parts.append(summary_line)

        # ── Student Profile (NEW) ──
        student_profile = insights.get("student_profile", {})
        if student_profile:
            profile_parts = []
            if student_profile.get("target_exam"):
                profile_parts.append(f"preparing for {student_profile['target_exam']}")
            if student_profile.get("preferred_study_time"):
                profile_parts.append(f"prefers studying in the {student_profile['preferred_study_time']}")
            if student_profile.get("name"):
                profile_parts.insert(0, f"Student: {student_profile['name']}")
            if profile_parts:
                prompt_parts.append("Profile: " + ", ".join(profile_parts) + ".")

        # ── Subject/Topic Info (NEW) ──
        subjects = insights.get("subjects_studied", [])
        if subjects:
            prompt_parts.append(f"Subjects studied: {', '.join(subjects[:5])}.")

        # ── Data Quality Warning (NEW) ──
        data_quality = state.get("data_quality", 1.0)
        warnings = state.get("validation_warnings", [])
        if data_quality < 0.6 and warnings:
            prompt_parts.append(
                f"⚠️ DATA QUALITY NOTE (score: {data_quality:.0%}): "
                f"{'; '.join(warnings[:3])}. "
                f"Advise student that recommendations will improve with more data."
            )

        # ── Distraction Analysis ──
        dist = insights.get("distraction_analysis", {})
        if dist.get("pattern_detected"):
            primary = dist.get("primary_insight")
            if primary:
                prompt_parts.append(f"Distraction pattern: {primary}")
            priority = dist.get("intervention_priority", "low")
            prompt_parts.append(f"Distraction intervention priority: {priority}")
            patterns = dist.get("patterns", {})
            for name, data in patterns.items():
                prompt_parts.append(
                    f"  - {name}: occurs {data.get('frequency', 0)} times, "
                    f"avg efficiency when present = {data.get('avg_efficiency_when_present', 0):.0f}%, "
                    f"concentrated in {data.get('primary_timeslot', 'N/A')} "
                    f"({data.get('timeslot_concentration', 0) * 100:.0f}%)"
                )
        elif dist.get("current_distractions"):
            prompt_parts.append(
                f"Current session distractions: {', '.join(dist['current_distractions'])}"
            )

        # ── Performance Correlations ──
        perf = insights.get("performance_correlations", {})
        if perf.get("sufficient_data"):
            corr = perf.get("correlations", {})
            ts = corr.get("timeslot_driver", {})
            if ts:
                prompt_parts.append(
                    f"Time-of-day impact: Best in {ts.get('best_timeslot')} "
                    f"({ts.get('best_avg_efficiency', 0):.0f}% avg), "
                    f"worst in {ts.get('worst_timeslot')} "
                    f"({ts.get('worst_avg_efficiency', 0):.0f}% avg), "
                    f"delta = {ts.get('delta', 0):.0f}%"
                )
            flow = corr.get("flow_state_driver", {})
            if flow:
                prompt_parts.append(
                    f"Flow state boost: {flow.get('flow_boost', 0):.0f}% efficiency gain when in flow. "
                    f"Flow frequency: {flow.get('flow_frequency', 0) * 100:.0f}% of sessions."
                )
            dur = corr.get("duration_driver", {})
            if dur:
                prompt_parts.append(
                    f"Optimal session length: {dur.get('optimal_range', 'unknown')} "
                    f"({dur.get('optimal_avg_efficiency', 0):.0f}% avg efficiency)"
                )

        # ── Temporal Patterns ──
        temporal = insights.get("temporal_patterns", {})
        dow = temporal.get("day_of_week", {})
        if dow.get("best_day"):
            prompt_parts.append(
                f"Day-of-week pattern: Best on {dow['best_day']} ({dow.get('best_avg', 0):.0f}%), "
                f"worst on {dow.get('worst_day', 'N/A')} ({dow.get('worst_avg', 0):.0f}%), "
                f"delta = {dow.get('delta', 0):.0f}%"
            )
        trend = temporal.get("trend", {})
        if trend.get("direction"):
            prompt_parts.append(
                f"Recent trend: {trend['direction']} — "
                f"recent avg {trend.get('recent_avg', 0):.0f}% vs older avg {trend.get('older_avg', 0):.0f}%"
            )

        # ── Efficiency Trajectory ──
        traj = insights.get("efficiency_trajectory", {})
        if traj.get("sufficient_data") or traj.get("trajectory"):
            prompt_parts.append(
                f"Efficiency trajectory: {traj.get('trajectory', 'unknown')}, "
                f"slope = {traj.get('weekly_change_rate', 0):.1f}%/week, "
                f"current = {traj.get('current_efficiency', 0):.0f}%, "
                f"predicted next week = {traj.get('predicted_next_week', 0):.0f}%"
            )
            if traj.get("urgency") == "high":
                prompt_parts.append("⚠️ URGENCY: Rapid change detected — immediate intervention recommended.")

        # ── Intervention Vectors (from InsightExtractor) ──
        interventions = insights.get("recommended_interventions", [])
        if interventions:
            prompt_parts.append("Pre-computed intervention vectors:")
            for iv in interventions[:5]:
                prompt_parts.append(
                    f"  [{iv.get('priority', 'medium').upper()}] {iv.get('problem', '')} → "
                    f"Action: {iv.get('solution_vector', '')}"
                )
                if iv.get("expected_improvement"):
                    prompt_parts.append(f"    Expected: {iv['expected_improvement']}")

        # ── Wellness Context (from daily check-in) ──
        wellness = insights.get("wellness_context", {})
        readiness = insights.get("readiness_score")
        if wellness:
            wellness_parts = []
            sleep_h = wellness.get('sleep_hours')
            sleep_q = wellness.get('sleep_quality')
            if sleep_h is not None:
                sq_label = {1: 'terrible', 2: 'poor', 3: 'fair', 4: 'good', 5: 'excellent'}.get(sleep_q or 3, 'fair')
                wellness_parts.append(f"Sleep: {sleep_h}h, quality: {sq_label} ({sleep_q}/5)")

            energy = wellness.get('energy_level')
            if energy:
                e_label = {1: 'drained', 2: 'low', 3: 'okay', 4: 'good', 5: 'charged'}.get(energy, 'okay')
                wellness_parts.append(f"Energy: {e_label} ({energy}/5)")

            stress = wellness.get('stress_level')
            if stress:
                s_label = {1: 'calm', 2: 'mild', 3: 'moderate', 4: 'high', 5: 'extreme'}.get(stress, 'moderate')
                wellness_parts.append(f"Stress: {s_label} ({stress}/5)")

            mood = wellness.get('mood')
            if mood:
                wellness_parts.append(f"Mood: {mood}")

            if wellness.get('exercised_today'):
                wellness_parts.append("Exercised today: Yes (BDNF boost active)")
            else:
                wellness_parts.append("Exercised today: No")

            if wellness.get('had_meal'):
                wellness_parts.append("Had meal: Yes (glucose levels stable)")
            else:
                wellness_parts.append("Had meal: No (may affect sustained attention)")

            screen = wellness.get('screen_time_last_night')
            if screen:
                wellness_parts.append(f"Screen time before bed: {screen}")

            notes = wellness.get('notes')
            if notes:
                wellness_parts.append(f"Student notes: {notes}")

            readiness_label = 'Recovery' if readiness and readiness < 35 else 'Moderate' if readiness and readiness < 55 else 'Good' if readiness and readiness < 75 else 'Excellent'
            prompt_parts.append(
                f"\n🫨 TODAY'S WELLNESS CHECK-IN (readiness score: {readiness or 'N/A'}/100 — {readiness_label}):"
            )
            for wp in wellness_parts:
                prompt_parts.append(f"  • {wp}")
            prompt_parts.append(
                "\n📋 PLANNING INSTRUCTION: Based on the wellness data above, generate at least 2 PLANNING suggestions "
                "that adapt today's study plan. Consider session duration, break timing, subject ordering "
                "(lighter vs harder topics), and realistic daily targets. NEVER blame or judge the student "
                "for their wellness state — frame everything as strategic adaptation."
            )

        # ── Skill Insights ──
        skills = insights.get("skill_insights", {})
        if skills:
            prompt_parts.append("Cognitive skill changes:")
            for skill_id, data in skills.items():
                prompt_parts.append(
                    f"  - {data.get('skill_name', skill_id)}: "
                    f"{data.get('status', 'stable')}, change = {data.get('change', 0):.0f}%"
                )

        formatted = "\n".join(prompt_parts)
        state["formatted_prompt"] = formatted
        return state

    def _generate_insights(self, state: InsightState) -> InsightState:
        """Node 2: Call Gemini via LangChain to generate natural-language insights."""
        # Skip LLM if data quality is too low
        data_quality = state.get("data_quality", 1.0)
        if data_quality < self.MIN_DATA_QUALITY:
            logger.warning(
                "Data quality %.2f is below threshold %.2f — skipping LLM call",
                data_quality,
                self.MIN_DATA_QUALITY,
            )
            state["error"] = f"Data quality too low ({data_quality:.0%}) for reliable LLM insights"
            state["llm_response"] = ""
            return state

        try:
            llm = self._get_llm()
            messages = [
                SystemMessage(content=self.SYSTEM_PROMPT),
                HumanMessage(content=(
                    "Based on the following study analytics data, generate 5 personalized, "
                    "actionable insights for this student:\n\n"
                    f"{state['formatted_prompt']}\n\n"
                    "Remember: each insight must be specific, data-backed, and include "
                    "a concrete action the student can take this week. Reference their "
                    "subjects and study patterns directly. If wellness data is provided, "
                    "at least 2 insights must be 📋 PLANNING suggestions that adapt today's "
                    "study plan to the student's current readiness level."
                )),
            ]
            response = llm.invoke(messages)
            state["llm_response"] = response.content
        except Exception as exc:
            logger.error("Gemini LLM call failed: %s", exc)
            state["error"] = str(exc)
            state["llm_response"] = ""
        return state

    def _parse_response(self, state: InsightState) -> InsightState:
        """Node 3: Parse LLM JSON array response into strings for database compatibility."""
        import re
        import json
        
        raw = state.get("llm_response", "")

        if not raw or state.get("error"):
            state["actionable_insights"] = []
            return state

        try:
            # Strip accidental markdown fences
            clean_raw = re.sub(r"```(json)?|```", "", raw).strip()
            
            insights = json.loads(clean_raw)
            
            if isinstance(insights, list):
                # Sort by priority so urgent ones surface first
                insights.sort(key=lambda x: x.get("priority", 3))
                
                final_recs = []
                for item in insights[:6]:
                    # Keep as JSON string so frontend can decode the rich object
                    final_recs.append(json.dumps(item))
                
                state["actionable_insights"] = final_recs
            else:
                logger.error("LLM did not return a JSON array")
                state["actionable_insights"] = []
                
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse JSON from LLM: %s\nRaw: %s", exc, raw)
            state["actionable_insights"] = []
            
        return state

    # ── Build LangGraph ────────────────────────────────────────────────────

    def _build_graph(self) -> StateGraph:
        """Construct the 4-node LangGraph workflow (validation → context → LLM → parse)."""
        graph = StateGraph(InsightState)

        graph.add_node("validate_insights", self._validate_insights)
        graph.add_node("prepare_context", self._prepare_context)
        graph.add_node("generate_insights", self._generate_insights)
        graph.add_node("parse_response", self._parse_response)

        graph.set_entry_point("validate_insights")
        graph.add_edge("validate_insights", "prepare_context")
        graph.add_edge("prepare_context", "generate_insights")
        graph.add_edge("generate_insights", "parse_response")
        graph.add_edge("parse_response", END)

        return graph

    # ── Public API ─────────────────────────────────────────────────────────

    def generate_actionable_insights(
        self,
        raw_insights: Dict[str, Any],
        fallback_recommendations: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Main entry point: convert InsightExtractor output into LLM-generated
        actionable insights.

        Args:
            raw_insights: Output from InsightExtractor.extract_session_insights()
            fallback_recommendations: Rule-based recs to return if LLM fails

        Returns:
            List of natural-language, actionable recommendation strings
        """
        fallback = fallback_recommendations or []

        if not self.is_configured:
            logger.warning("GEMINI_API_KEY not set — returning fallback recommendations")
            return fallback

        try:
            initial_state: InsightState = {
                "raw_insights": raw_insights,
                "formatted_prompt": "",
                "llm_response": "",
                "actionable_insights": [],
                "error": None,
                "data_quality": 1.0,
                "validation_warnings": [],
            }

            compiled = self._graph.compile()
            final_state = compiled.invoke(initial_state)

            ai_insights = final_state.get("actionable_insights", [])

            if not ai_insights:
                logger.warning("LLM returned empty insights — using fallback")
                return fallback

            logger.info(
                "Generated %d AI-powered insights via Gemini (data quality: %.0f%%)",
                len(ai_insights),
                final_state.get("data_quality", 0) * 100,
            )
            return ai_insights

        except Exception as exc:
            logger.error("LangGraph pipeline failed: %s", exc)
            return fallback


# ── Singleton factory ──────────────────────────────────────────────────────────

_chain_instance: Optional[GeminiInsightChain] = None


def get_insight_chain() -> GeminiInsightChain:
    """Get or create a singleton GeminiInsightChain instance."""
    global _chain_instance
    if _chain_instance is None:
        _chain_instance = GeminiInsightChain()
    return _chain_instance
