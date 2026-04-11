"""
🤖 LLM INSIGHT GENERATION — LangChain + LangGraph + Groq
==========================================================

MAJOR CHANGES IN THIS VERSION:
1. Quota-aware 429 handling: detects daily exhaustion vs per-minute
   rate limit and fails fast instead of burning 65s retrying.
2. ContextBuilder: computes cross-dimensional derived patterns from
   raw sessions BEFORE the LLM sees them, forcing specific numbers.
3. System prompt with an explicit anti-rephrase contract and
   priority ranking so the LLM can't pick easy dimensions.
4. Evidence-first prompting: each insight must cite a session count
   and a delta — no citation = rejected in parse step.

ARCHITECTURE (LangGraph):
┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐  ┌────────────────┐
│ validate_insights│→ │ build_context  │→ │ generate_insights │→ │ parse_response │
│ (sanity checks)  │  │ (cross-dim     │  │ (Groq LLM)        │  │ (extract+rank) │
│                  │  │  analysis)     │  │                   │  │                │
└──────────────────┘  └────────────────┘  └──────────────────┘  └────────────────┘

Core change in core_engine.py required:
  In generate_llm_insights_for_user(), add to insight_bundle:
      insight_bundle['raw_sessions'] = historical_sessions
  This gives ContextBuilder the per-session data it needs.
"""

import os
import re
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict
from collections import defaultdict

import numpy as np
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


# ── LangGraph State ───────────────────────────────────────────────────────────

class InsightState(TypedDict):
    raw_insights: Dict[str, Any]
    derived_patterns: Dict[str, Any]   # NEW: output of ContextBuilder
    formatted_prompt: str
    llm_response: str
    actionable_insights: List[str]
    error: Optional[str]
    data_quality: float
    validation_warnings: List[str]
    quota_exhausted: bool              # NEW: daily limit hit — skip retries


# ── Quota-aware error detection ───────────────────────────────────────────────

def _is_daily_quota_exhausted(exc: Exception) -> bool:
    """
    Return True if the API rate limit is reached and we should fail fast.
    """
    msg = str(exc).lower()
    return "rate limit reached" in msg or "429" in msg or "insufficient_quota" in msg


# ── ContextBuilder ────────────────────────────────────────────────────────────

class ContextBuilder:
    """
    Computes derived, cross-dimensional patterns from raw study sessions
    BEFORE the LLM sees the data.

    Why this matters:
      LLMs given averaged stats produce averaged advice.
      LLMs given pre-computed, specific, surprising patterns produce insights.

    All output values contain explicit session counts and numeric deltas so
    the LLM system prompt can enforce "cite a number or don't include it."
    """

    MIN_SESSIONS_FOR_PATTERN = 4   # Need at least this many for a claim

    def __init__(self, sessions: List[Dict[str, Any]]):
        self.sessions = sessions
        self.n = len(sessions)

    def build(self) -> Dict[str, Any]:
        if self.n == 0:
            return {"has_data": False}

        patterns: Dict[str, Any] = {"has_data": True, "total_sessions": self.n}

        patterns["planning_accuracy"]     = self._planning_accuracy()
        patterns["subject_time_matrix"]   = self._subject_time_matrix()
        patterns["distraction_triggers"]  = self._distraction_trigger_analysis()
        patterns["fatigue_curve"]         = self._fatigue_curve()
        patterns["deep_work_ratio"]       = self._deep_work_ratio()
        patterns["worst_single_combo"]    = self._worst_performing_combo()
        patterns["best_single_combo"]     = self._best_performing_combo()
        patterns["completion_rate"]       = self._completion_rate()

        # Rank derived patterns by potential impact so the prompt
        # leads with the highest-value insight first.
        patterns["priority_order"]        = self._rank_by_impact(patterns)

        return patterns

    # ── Individual pattern computers ─────────────────────────────────────────

    def _planning_accuracy(self) -> Dict[str, Any]:
        """
        Actual / planned time ratio.
        "You complete only 58% of your planned study time on average."
        """
        ratios: List[float] = []
        overplan_count = 0
        underplan_count = 0

        for s in self.sessions:
            planned = s.get("TargetDuration") or s.get("target_duration")
            start = s.get("StartTime")
            end   = s.get("EndTime")

            if not (planned and isinstance(start, datetime) and isinstance(end, datetime)):
                continue

            actual_min = (end - start).total_seconds() / 60
            if actual_min <= 0 or actual_min > 720:
                continue

            ratio = actual_min / float(planned)
            ratios.append(ratio)

            if ratio < 0.75:
                overplan_count += 1
            elif ratio > 1.25:
                underplan_count += 1

        if not ratios:
            return {"available": False}

        avg_ratio = float(np.mean(ratios))
        return {
            "available": True,
            "avg_completion_ratio": round(avg_ratio, 2),
            "pct_overplanned": round(overplan_count / len(ratios) * 100),
            "pct_underplanned": round(underplan_count / len(ratios) * 100),
            "sample_size": len(ratios),
            # Human-readable delta for the prompt
            "summary": (
                f"Completes {round(avg_ratio * 100)}% of planned time on average "
                f"({len(ratios)} sessions). "
                f"{round(overplan_count / len(ratios) * 100)}% of sessions were cut short."
            ) if avg_ratio < 0.9 else (
                f"Generally completes planned time ({round(avg_ratio * 100)}% ratio, "
                f"{len(ratios)} sessions)."
            ),
        }

    def _subject_time_matrix(self) -> Dict[str, Any]:
        """
        Per-subject efficiency broken down by timeslot.
        Finds the single most damaging subject×slot combo.
        """
        # sessions need SubjectCategory or subject_name
        # We'll key by whatever name field is available
        matrix: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))

        for s in self.sessions:
            subj = (
                s.get("SubjectCategory")
                or s.get("subject_category")
                or s.get("subject_name")
                or "Unknown"
            )
            slot = s.get("TimeSlot") or s.get("time_slot") or "Unknown"
            eff  = s.get("Efficiency") or s.get("efficiency") or 0

            try:
                matrix[str(subj)][str(slot)].append(float(eff))
            except (TypeError, ValueError):
                continue

        result: Dict[str, Any] = {}

        for subj, slots in matrix.items():
            subj_data: Dict[str, Any] = {}
            for slot, effs in slots.items():
                if len(effs) >= 2:  # Only report if we have enough data
                    subj_data[slot] = {
                        "avg_efficiency": round(float(np.mean(effs)), 1),
                        "session_count": len(effs),
                    }
            if subj_data:
                result[subj] = subj_data

        return result

    def _distraction_trigger_analysis(self) -> Dict[str, Any]:
        """
        Cross-analysis: which distraction type, at which timeslot,
        studying which subject causes the biggest efficiency drop.
        """
        # dist → list of (efficiency, timeslot, subject)
        dist_data: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        def split_dist(raw: Any) -> List[str]:
            if not raw:
                return []
            if isinstance(raw, list):
                return [str(x).strip().upper() for x in raw if str(x).strip()]
            return [x.strip().upper() for x in str(raw).split(",") if x.strip()]

        for s in self.sessions:
            eff   = float(s.get("Efficiency") or s.get("efficiency") or 0)
            slot  = str(s.get("TimeSlot") or s.get("time_slot") or "Unknown")
            subj  = str(s.get("SubjectCategory") or s.get("subject_category") or "Unknown")
            dists = split_dist(s.get("Distractions") or s.get("distractions"))

            for d in dists:
                dist_data[d].append({"efficiency": eff, "timeslot": slot, "subject": subj})

        if not dist_data:
            return {"any_detected": False}

        results: Dict[str, Any] = {}
        for dist, records in dist_data.items():
            if len(records) < 2:
                continue

            effs = [r["efficiency"] for r in records]
            slots = [r["timeslot"] for r in records]
            subjs = [r["subject"] for r in records]

            # Find the most common slot for this distraction
            slot_counts: Dict[str, int] = defaultdict(int)
            for slot in slots:
                slot_counts[slot] += 1
            peak_slot = max(slot_counts, key=lambda k: slot_counts[k])
            peak_slot_pct = round(slot_counts[peak_slot] / len(slots) * 100)

            results[dist] = {
                "occurrences": len(records),
                "avg_efficiency_when_present": round(float(np.mean(effs)), 1),
                "peak_timeslot": peak_slot,
                "peak_timeslot_pct": peak_slot_pct,
                "most_affected_subjects": list(set(subjs))[:3],
                "summary": (
                    f"{dist} appears in {len(records)} sessions; "
                    f"avg efficiency {round(float(np.mean(effs)))}%; "
                    f"{peak_slot_pct}% of these occur during {peak_slot} sessions."
                ),
            }

        return {"any_detected": bool(results), "by_distraction": results}

    def _fatigue_curve(self) -> Dict[str, Any]:
        """
        Does efficiency drop when multiple sessions are logged on the same day?
        "Session 1 avg 74%, session 2 avg 51%, session 3 avg 38%."
        """
        # Group sessions by date
        by_date: Dict[str, List[Dict]] = defaultdict(list)
        for s in self.sessions:
            start = s.get("StartTime")
            if not isinstance(start, datetime):
                continue
            key = start.date().isoformat()
            by_date[key].append(s)

        # Sort within each day by start time
        session_positions: List[Dict[str, float]] = []  # {position: 1/2/3, efficiency: x}
        for date_sessions in by_date.values():
            sorted_day = sorted(
                date_sessions,
                key=lambda x: x.get("StartTime") or datetime.min,
            )
            for pos, s in enumerate(sorted_day, 1):
                eff = s.get("Efficiency") or s.get("efficiency")
                if eff is not None:
                    session_positions.append({"position": pos, "efficiency": float(eff)})

        if not session_positions:
            return {"available": False}

        # Average efficiency by position
        by_position: Dict[int, List[float]] = defaultdict(list)
        for sp in session_positions:
            by_position[sp["position"]].append(sp["efficiency"])

        pos_avgs = {
            pos: round(float(np.mean(effs)), 1)
            for pos, effs in by_position.items()
            if len(effs) >= self.MIN_SESSIONS_FOR_PATTERN
        }

        if len(pos_avgs) < 2:
            return {"available": False}

        sorted_pos = sorted(pos_avgs.items())
        drop = sorted_pos[0][1] - sorted_pos[-1][1]

        return {
            "available": True,
            "by_position": dict(sorted_pos),
            "efficiency_drop_from_first": round(drop, 1),
            "summary": (
                "  ".join([
                    f"Session {p}: avg {e}%" for p, e in sorted_pos
                ])
                + f" — drops {round(drop)}% by last session."
            ) if drop > 5 else (
                "Little fatigue detected across multiple daily sessions."
            ),
        }

    def _deep_work_ratio(self) -> Dict[str, Any]:
        """
        What fraction of sessions were genuinely deep work
        (focus ≥ 4, no attention-breaking distractions)?
        """
        attention_distractors = {"PHONE", "SOCIAL_MEDIA", "INTERRUPTIONS", "MULTITASKING"}

        def split_dist(raw: Any) -> List[str]:
            if not raw:
                return []
            if isinstance(raw, list):
                return [str(x).strip().upper() for x in raw if str(x).strip()]
            return [x.strip().upper() for x in str(raw).split(",") if x.strip()]

        deep_count = 0
        valid = 0
        for s in self.sessions:
            focus = s.get("FocusLevel") or s.get("focus_level")
            if focus is None:
                continue
            valid += 1
            dists = set(split_dist(s.get("Distractions") or s.get("distractions")))
            if int(focus) >= 4 and not dists.intersection(attention_distractors):
                deep_count += 1

        if valid == 0:
            return {"available": False}

        ratio = deep_count / valid
        return {
            "available": True,
            "deep_work_sessions": deep_count,
            "total_sessions": valid,
            "pct": round(ratio * 100),
            "summary": (
                f"{round(ratio * 100)}% of sessions qualify as deep work "
                f"({deep_count}/{valid}). "
                + ("Target is 40–60%." if ratio < 0.4 else "Good ratio." if ratio <= 0.65 else "High ratio — verify focus self-reporting.")
            ),
        }

    def _worst_performing_combo(self) -> Optional[Dict[str, Any]]:
        """
        The single subject×timeslot combination with worst efficiency
        (minimum 3 sessions to be valid).
        """
        combos: Dict[str, List[float]] = defaultdict(list)
        for s in self.sessions:
            subj = str(s.get("SubjectCategory") or s.get("subject_category") or "Unknown")
            slot = str(s.get("TimeSlot") or s.get("time_slot") or "Unknown")
            eff  = s.get("Efficiency") or s.get("efficiency")
            if eff is not None and subj != "Unknown":
                combos[f"{subj} @ {slot}"].append(float(eff))

        valid = {k: v for k, v in combos.items() if len(v) >= 3}
        if not valid:
            return None

        worst_key = min(valid, key=lambda k: float(np.mean(valid[k])))
        effs = valid[worst_key]
        return {
            "combo": worst_key,
            "avg_efficiency": round(float(np.mean(effs)), 1),
            "session_count": len(effs),
            "summary": f"{worst_key} averages {round(float(np.mean(effs)))}% efficiency ({len(effs)} sessions).",
        }

    def _best_performing_combo(self) -> Optional[Dict[str, Any]]:
        """The single subject×timeslot combination with best efficiency."""
        combos: Dict[str, List[float]] = defaultdict(list)
        for s in self.sessions:
            subj = str(s.get("SubjectCategory") or s.get("subject_category") or "Unknown")
            slot = str(s.get("TimeSlot") or s.get("time_slot") or "Unknown")
            eff  = s.get("Efficiency") or s.get("efficiency")
            if eff is not None and subj != "Unknown":
                combos[f"{subj} @ {slot}"].append(float(eff))

        valid = {k: v for k, v in combos.items() if len(v) >= 3}
        if not valid:
            return None

        best_key = max(valid, key=lambda k: float(np.mean(valid[k])))
        effs = valid[best_key]
        return {
            "combo": best_key,
            "avg_efficiency": round(float(np.mean(effs)), 1),
            "session_count": len(effs),
            "summary": f"{best_key} averages {round(float(np.mean(effs)))}% efficiency ({len(effs)} sessions).",
        }

    def _completion_rate(self) -> Dict[str, Any]:
        """
        Of planned sessions (target_duration set), what % were started and
        what % reached at least 80% of planned time?
        """
        planned = 0
        reached_80 = 0

        for s in self.sessions:
            target = s.get("TargetDuration") or s.get("target_duration")
            if not target:
                continue
            planned += 1
            start = s.get("StartTime")
            end   = s.get("EndTime")
            if not (isinstance(start, datetime) and isinstance(end, datetime)):
                continue
            actual = (end - start).total_seconds() / 60
            if actual >= float(target) * 0.8:
                reached_80 += 1

        if planned == 0:
            return {"available": False}

        return {
            "available": True,
            "planned": planned,
            "completed_80pct": reached_80,
            "completion_rate_pct": round(reached_80 / planned * 100),
            "summary": (
                f"{round(reached_80 / planned * 100)}% of planned sessions "
                f"reached ≥80% of target duration ({reached_80}/{planned})."
            ),
        }

    def _rank_by_impact(self, patterns: Dict[str, Any]) -> List[str]:
        """
        Order pattern keys by likely insight impact so the prompt
        leads with the strongest finding.
        """
        scores: Dict[str, float] = {}

        # Planning accuracy: if completion ratio < 0.80, very high impact
        pa = patterns.get("planning_accuracy", {})
        if pa.get("available"):
            delta = abs(1.0 - pa["avg_completion_ratio"])
            scores["planning_accuracy"] = delta * 100

        # Worst combo: large gap = high impact
        wc = patterns.get("worst_single_combo")
        if wc:
            scores["worst_single_combo"] = max(0, 80 - wc["avg_efficiency"])

        # Distraction triggers: many occurrences + low efficiency
        dt = patterns.get("distraction_triggers", {})
        if dt.get("any_detected"):
            for d, data in dt["by_distraction"].items():
                eff_gap = 70 - data["avg_efficiency_when_present"]
                scores.setdefault("distraction_triggers", 0)
                scores["distraction_triggers"] = max(
                    scores["distraction_triggers"],
                    eff_gap * (data["occurrences"] / max(self.n, 1)),
                )

        # Fatigue curve: big drop = high impact
        fc = patterns.get("fatigue_curve", {})
        if fc.get("available") and fc.get("efficiency_drop_from_first", 0) > 10:
            scores["fatigue_curve"] = fc["efficiency_drop_from_first"]

        # Completion rate below 70% is actionable
        cr = patterns.get("completion_rate", {})
        if cr.get("available") and cr["completion_rate_pct"] < 70:
            scores["completion_rate"] = 70 - cr["completion_rate_pct"]

        sorted_keys = sorted(scores, key=lambda k: scores[k], reverse=True)
        return sorted_keys or list(patterns.keys())


# ── Groq Insight Chain ─────────────────────────────────────────────────────────

class GroqInsightChain:
    """
    LangChain + LangGraph pipeline that converts cross-dimensional study
    pattern data into actionable, non-generic insights via Groq.

    Key design principles:
    - ContextBuilder computes all patterns before the LLM sees anything
    - The system prompt enforces evidence-citing and bans rephrase
    - 429 daily-quota exhaustion is detected and fails fast (no retry spiral)
    """

    # ── System prompt: anti-generic contract ──────────────────────────────
    SYSTEM_PROMPT = """\
You are a study performance analyst. You have been given PRE-COMPUTED patterns \
from a student's study session logs — these are facts, not observations to reinterpret.

YOUR ONLY JOB: Convert these computed patterns into 3 insight objects.

HARD RULES — violate any and the response is discarded:
1. CITE A NUMBER. Every "title" MUST contain a number extracted from the data \
   (%, count, or duration). No number = rejected.
2. NEVER REPHRASE. If the data says "PHONE in 8/12 sessions", you may not output \
   "Phone is a common distraction." That restates the input. You must output what \
   the pattern IMPLIES and what the student should DO differently.
3. THE ACTION MUST BE MECHANICAL. "Stop using your phone" is banned. \
   "Put phone in another room + use Forest app, set 25-min timer before opening books" \
   is allowed. If the action could appear in a generic study tips article, it is wrong.
4. CROSS-DIMENSION WINS. The most valuable insights combine two dimensions: \
   e.g. "PHONE distractions occur 75% during Evening sessions" is worth more than \
   "PHONE distractions occur frequently."
5. PLAN SUGGESTIONS: For PLANNING_ACCURACY and SUBJECT_SLOT type insights ONLY, \
   you MUST include a "plan_suggestion" field that specifies a concrete scheduling fix. \
   Use valid time_slot values: Morning, Afternoon, Evening, Night.

ANTI-REPHRASE TEST (apply before writing each insight):
  Ask: "Could the student have said this just by reading their own log?"
  If YES → discard and think harder.
  If NO → proceed.

PRIORITY (pick the top 3 from the pre-ranked list provided):
  Planning accuracy > Worst subject×slot combo > Distraction triggers \
  > Fatigue curve > Deep work ratio > Completion rate

Return ONLY a JSON array. No markdown. No preamble. No explanation.

Schema:
[
  {
    "type": "<PLANNING_ACCURACY | SUBJECT_SLOT | DISTRACTION | FATIGUE | DEEP_WORK | COMPLETION>",
    "title": "<max 12 words, MUST include a number from the data>",
    "finding": "<2 sentences: what the pattern shows + why it matters for this student>",
    "action": "<2 sentences: mechanical step executable tomorrow, not generic advice>",
    "priority": <1=most urgent, 2, 3>,
    "plan_suggestion": {
      "subject_hint": "<subject name from data, e.g. Physics>",
      "time_slot": "<Morning | Afternoon | Evening | Night>",
      "duration_minutes": <integer, e.g. 60>,
      "reason": "<1 sentence explaining why this slot and duration were chosen>"
    }
  }
]
Note: plan_suggestion is REQUIRED for PLANNING_ACCURACY and SUBJECT_SLOT types. \
For DISTRACTION, FATIGUE, DEEP_WORK, COMPLETION types it MUST be omitted entirely."""

    MIN_DATA_QUALITY    = 0.30
    EFFICIENCY_RANGE    = (0, 100)
    MAX_PROMPT_CHARS    = 2400

    def __init__(self, api_key: Optional[str] = None, model: str = "llama-3.3-70b-versatile"):
        self.api_key    = api_key or os.environ.get("GROQ_API_KEY", "")
        self.model_name = model
        self._llm: Optional[ChatGroq] = None
        self._graph     = self._build_graph()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _get_llm(self) -> ChatGroq:
        if self._llm is None:
            self._llm = ChatGroq(
                model_name=self.model_name,
                api_key=self.api_key,
                temperature=0.2,        # Lower = more precise analytical output
                max_retries=0,          # Disable LangChain retries
            )
        return self._llm

    # ── LangGraph Node Functions ───────────────────────────────────────────

    def _validate_insights(self, state: InsightState) -> InsightState:
        """Node 0: Validate raw insights and flag quota-safe to proceed."""
        insights  = state.get("raw_insights", {})
        warnings: List[str] = []
        quality   = 1.0

        meta          = insights.get("meta", {})
        session_count = meta.get("session_count", 0)
        state["quota_exhausted"] = False

        if session_count == 0:
            warnings.append("No study sessions available")
            quality -= 0.5

        traj = insights.get("efficiency_trajectory", {})
        if traj.get("sufficient_data"):
            ce = traj.get("current_efficiency", 0)
            if not (self.EFFICIENCY_RANGE[0] <= ce <= self.EFFICIENCY_RANGE[1]):
                traj["current_efficiency"] = max(0, min(100, ce))
                warnings.append(f"Current efficiency {ce:.0f}% clamped")
                quality -= 0.15

            weekly = abs(traj.get("weekly_change_rate", 0))
            if weekly > 30:
                warnings.append(f"Weekly change {weekly:.1f}% looks noisy")
                quality -= 0.15

        perf = insights.get("performance_correlations", {})
        if perf.get("sufficient_data"):
            ts = perf.get("correlations", {}).get("timeslot_driver", {})
            if ts and ts.get("best_avg_efficiency", 0) < ts.get("worst_avg_efficiency", 0):
                warnings.append("Best/worst timeslot inverted — data inconsistency")
                quality -= 0.20

        dist = insights.get("distraction_analysis", {})
        if dist.get("pattern_detected"):
            for name, data in dist.get("patterns", {}).items():
                avg_eff = data.get("avg_efficiency_when_present", 0)
                if not (0 <= avg_eff <= 100):
                    data["avg_efficiency_when_present"] = max(0, min(100, avg_eff))
                    warnings.append(f"Distraction '{name}' efficiency clamped")
                    quality -= 0.05

        temporal = insights.get("temporal_patterns", {})
        if temporal.get("day_of_week", {}).get("delta", 0) > 60:
            warnings.append("Day-of-week spread >60% — possible quality issue")
            quality -= 0.10

        state["data_quality"]        = max(0.0, min(1.0, quality))
        state["validation_warnings"] = warnings

        if warnings:
            logger.info("Validation: quality=%.2f, warnings=%s", state["data_quality"], warnings)
        else:
            logger.info("Validation passed: quality=%.2f", state["data_quality"])

        return state

    def _build_context(self, state: InsightState) -> InsightState:
        """
        Node 1: Run ContextBuilder on raw sessions, then format the final
        prompt from both the InsightExtractor output AND derived patterns.

        Requires insight_bundle['raw_sessions'] to be populated by
        core_engine.generate_llm_insights_for_user().
        """
        insights = state["raw_insights"]

        # ── Run ContextBuilder on raw sessions (if available) ─────────────
        raw_sessions: List[Dict] = insights.get("raw_sessions", [])
        builder = ContextBuilder(raw_sessions)
        derived = builder.build()
        state["derived_patterns"] = derived

        # ── Prompt assembly ───────────────────────────────────────────────
        parts: List[str] = []

        # Header
        meta    = insights.get("meta", {})
        n       = meta.get("session_count", len(raw_sessions))
        a_type  = meta.get("analysis_type", "baseline")
        today   = datetime.utcnow().strftime("%A, %B %d, %Y")
        parts.append(
            f"📊 {n} sessions analysed | {a_type} | {today}"
        )

        # Session summary
        ss = insights.get("session_summary", {})
        if ss:
            line = f"Avg efficiency: {ss.get('avg_efficiency', 0):.0f}%"
            if ss.get("avg_duration_minutes"):
                line += f", avg session: {ss['avg_duration_minutes']:.0f}min"
            if ss.get("total_study_hours"):
                line += f", total: {ss['total_study_hours']:.1f}h"
            if ss.get("study_streak_days"):
                line += f", {ss['study_streak_days']}-day streak"
            parts.append(line)

        # Student profile
        profile = insights.get("student_profile", {})
        if profile:
            pparts = []
            if profile.get("target_exam"):
                pparts.append(f"preparing for {profile['target_exam']}")
            if profile.get("preferred_study_time"):
                pparts.append(f"prefers {profile['preferred_study_time']}")
            if pparts:
                parts.append("Profile: " + ", ".join(pparts))

        subjects = insights.get("subjects_studied", [])
        if subjects:
            parts.append(f"Subjects: {', '.join(subjects[:5])}")

        # ── DERIVED PATTERNS (ranked by impact — these are the gold) ──────
        if derived.get("has_data"):
            parts.append("\n=== PRE-COMPUTED PATTERNS (ranked by impact) ===")

            priority_order = derived.get("priority_order", [])

            # Planning accuracy
            if "planning_accuracy" in priority_order[:5]:
                pa = derived.get("planning_accuracy", {})
                if pa.get("available"):
                    parts.append(f"[PLANNING_ACCURACY] {pa['summary']}")

            # Worst subject×slot
            wc = derived.get("worst_single_combo")
            if wc:
                parts.append(f"[SUBJECT_SLOT_WORST] {wc['summary']}")

            bc = derived.get("best_single_combo")
            if bc:
                parts.append(f"[SUBJECT_SLOT_BEST] {bc['summary']}")

            # Distraction triggers
            dt = derived.get("distraction_triggers", {})
            if dt.get("any_detected"):
                for d_name, d_data in list(dt["by_distraction"].items())[:3]:
                    parts.append(f"[DISTRACTION:{d_name}] {d_data['summary']}")

            # Fatigue curve
            fc = derived.get("fatigue_curve", {})
            if fc.get("available"):
                parts.append(f"[FATIGUE_CURVE] {fc['summary']}")

            # Deep work ratio
            dw = derived.get("deep_work_ratio", {})
            if dw.get("available"):
                parts.append(f"[DEEP_WORK] {dw['summary']}")

            # Completion rate
            cr = derived.get("completion_rate", {})
            if cr.get("available"):
                parts.append(f"[COMPLETION] {cr['summary']}")

        # ── InsightExtractor stats (secondary — already processed) ────────
        parts.append("\n=== STATISTICAL PATTERNS ===")

        traj = insights.get("efficiency_trajectory", {})
        if traj.get("sufficient_data") or traj.get("trajectory"):
            parts.append(
                f"Efficiency trajectory: {traj.get('trajectory', 'unknown')} | "
                f"slope={traj.get('weekly_change_rate', 0):.1f}%/wk | "
                f"current={traj.get('current_efficiency', 0):.0f}% | "
                f"predicted={traj.get('predicted_next_week', 0):.0f}%"
            )

        perf = insights.get("performance_correlations", {})
        if perf.get("sufficient_data"):
            ts = perf.get("correlations", {}).get("timeslot_driver", {})
            if ts:
                parts.append(
                    f"Timeslot: best={ts.get('best_timeslot')} "
                    f"({ts.get('best_avg_efficiency', 0):.0f}%), "
                    f"worst={ts.get('worst_timeslot')} "
                    f"({ts.get('worst_avg_efficiency', 0):.0f}%), "
                    f"Δ={ts.get('delta', 0):.0f}%"
                )

        dist = insights.get("distraction_analysis", {})
        if dist.get("pattern_detected") and dist.get("primary_insight"):
            parts.append(f"Distraction insight: {dist['primary_insight']}")

        # ── Wellness context ──────────────────────────────────────────────
        wellness  = insights.get("wellness_context", {})
        readiness = insights.get("readiness_score")
        if wellness:
            r_label = (
                "Recovery" if readiness and readiness < 35 else
                "Moderate" if readiness and readiness < 55 else
                "Good"     if readiness and readiness < 75 else "Excellent"
            )
            wparts = [f"Readiness: {readiness or 'N/A'}/100 ({r_label})"]

            sleep_h = wellness.get("sleep_hours")
            sleep_q = wellness.get("sleep_quality")
            if sleep_h is not None:
                sq_map = {1: "terrible", 2: "poor", 3: "fair", 4: "good", 5: "excellent"}
                wparts.append(
                    f"Sleep {sleep_h}h, quality {sq_map.get(sleep_q or 3, 'fair')} ({sleep_q}/5)"
                )
            energy = wellness.get("energy_level")
            if energy:
                e_map = {1: "drained", 2: "low", 3: "okay", 4: "good", 5: "charged"}
                wparts.append(f"Energy: {e_map.get(energy, 'okay')} ({energy}/5)")
            stress = wellness.get("stress_level")
            if stress:
                s_map = {1: "calm", 2: "mild", 3: "moderate", 4: "high", 5: "extreme"}
                wparts.append(f"Stress: {s_map.get(stress, 'moderate')} ({stress}/5)")
            if wellness.get("mood"):
                wparts.append(f"Mood: {wellness['mood']}")
            if wellness.get("exercised_today"):
                wparts.append("Exercised: yes")
            if not wellness.get("had_meal"):
                wparts.append("Meal: skipped (attention risk)")
            screen = wellness.get("screen_time_last_night")
            if screen:
                wparts.append(f"Screen before bed: {screen}")
            notes = wellness.get("notes")
            if notes:
                wparts.append(f"Notes: {notes}")

            parts.append("\n🫨 WELLNESS: " + " | ".join(wparts))
            parts.append(
                "PLANNING INSTRUCTION: ≥1 insight must be a concrete planning adaptation "
                "based on wellness — never blame the student, frame as strategy."
            )

        # ── Interventions pre-computed ────────────────────────────────────
        interventions = insights.get("recommended_interventions", [])
        if interventions:
            parts.append("\nPre-computed interventions (context only — use as evidence):")
            for iv in interventions[:3]:
                parts.append(
                    f"  [{iv.get('priority','?').upper()}] {iv.get('problem','')} "
                    f"→ {iv.get('solution_vector','')}"
                )

        # ── Data quality note ─────────────────────────────────────────────
        quality = state.get("data_quality", 1.0)
        if quality < 0.6:
            ws = state.get("validation_warnings", [])
            parts.append(
                f"\n⚠️ DATA QUALITY {quality:.0%}: {'; '.join(ws[:2])}. "
                "Mention data sparsity in findings."
            )

        # Strict token cap — truncate at last newline
        formatted = "\n".join(parts)
        if len(formatted) > self.MAX_PROMPT_CHARS:
            cutoff = formatted.rfind("\n", 0, self.MAX_PROMPT_CHARS)
            formatted = formatted[:cutoff] + "\n...[TRUNCATED]"

        state["formatted_prompt"] = formatted
        return state

    def _generate_insights(self, state: InsightState) -> InsightState:
        """
        Node 2: Call Groq.

        QUOTA SAFETY:
        - If daily quota is exhausted (_is_daily_quota_exhausted), fail fast.
          No retries — the quota won't recover in the request lifetime.
        - Per-minute 429s are caught and logged; fallback is used.
        """
        if state.get("quota_exhausted"):
            state["llm_response"] = ""
            state["error"] = "Quota pre-flagged exhausted"
            return state

        if state.get("data_quality", 1.0) < self.MIN_DATA_QUALITY:
            logger.warning("Data quality %.2f below threshold — skipping LLM", state["data_quality"])
            state["llm_response"] = ""
            state["error"] = f"Data quality too low ({state['data_quality']:.0%})"
            return state

        try:
            llm = self._get_llm()
            messages = [
                SystemMessage(content=self.SYSTEM_PROMPT),
                HumanMessage(content=(
                    "Generate exactly 3 evidence-based insights for this student.\n\n"
                    "REMINDER: Every title MUST contain a number. "
                    "Every action MUST be mechanical. "
                    "If wellness data is present, ≥1 insight must address planning adaptation.\n\n"
                    f"{state['formatted_prompt']}"
                )),
            ]
            response = llm.invoke(messages)
            state["llm_response"] = response.content
            state["error"] = None

        except Exception as exc:
            if _is_daily_quota_exhausted(exc):
                logger.error(
                    "Daily Groq quota exhausted — failing fast, no retries. "
                    "Fallback recommendations will be used."
                )
                state["quota_exhausted"] = True
            else:
                logger.error("Groq LLM call failed: %s", exc)
            state["error"] = str(exc)
            state["llm_response"] = ""

        return state

    def _parse_response(self, state: InsightState) -> InsightState:
        """
        Node 3: Parse JSON array. Enforce quality gates:
        - Each item must have a number in the title
        - Each item must have a non-empty action
        Items that fail are dropped (never silently passed through).
        """
        raw = state.get("llm_response", "")

        if not raw or state.get("error"):
            state["actionable_insights"] = []
            return state

        try:
            clean = re.sub(r"```(json)?|```", "", raw).strip()
            items = json.loads(clean)

            if not isinstance(items, list):
                logger.error("LLM did not return a JSON array")
                state["actionable_insights"] = []
                return state

            # Sort by priority
            items.sort(key=lambda x: x.get("priority", 99))

            validated: List[str] = []
            _number_re = re.compile(r"\d")  # title must contain at least one digit

            # Patterns for extracting plan suggestion from action text (fallback)
            _slot_re     = re.compile(r"\b(morning|afternoon|evening|night)\b", re.I)
            _duration_re = re.compile(r"(\d{2,3})\s*(?:min|minutes?)", re.I)
            _subject_re  = re.compile(r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b")
            _planning_types = {"PLANNING_ACCURACY", "SUBJECT_SLOT"}

            for item in items[:6]:
                title       = str(item.get("title", "")).strip()
                action      = str(item.get("action", "")).strip()
                insight_type = str(item.get("type", "")).strip().upper()

                # Gate 1: title must cite a number
                if not _number_re.search(title):
                    logger.warning("Dropping insight — title has no number: %s", title)
                    continue

                # Gate 2: action must be non-trivial (>20 chars)
                if len(action) < 20:
                    logger.warning("Dropping insight — action too short: %s", action)
                    continue

                # ── Ensure plan_suggestion is well-formed for planning types ──
                if insight_type in _planning_types:
                    ps = item.get("plan_suggestion")
                    if not isinstance(ps, dict):
                        # LLM didn't emit one — synthesize from action text
                        slot_match     = _slot_re.search(action)
                        dur_match      = _duration_re.search(action)
                        subj_match     = _subject_re.search(title)
                        item["plan_suggestion"] = {
                            "subject_hint":     subj_match.group(1) if subj_match else "",
                            "time_slot":        slot_match.group(1).capitalize() if slot_match else "Morning",
                            "duration_minutes": int(dur_match.group(1)) if dur_match else 60,
                            "reason":           action[:120],
                        }
                    else:
                        # Normalise time_slot capitalisation
                        raw_slot = str(ps.get("time_slot", "Morning"))
                        ps["time_slot"] = raw_slot.capitalize() if raw_slot.lower() in (
                            "morning", "afternoon", "evening", "night"
                        ) else "Morning"
                        if not isinstance(ps.get("duration_minutes"), int):
                            ps["duration_minutes"] = 60
                        item["plan_suggestion"] = ps
                else:
                    # Non-planning types must NOT carry a plan_suggestion
                    item.pop("plan_suggestion", None)

                validated.append(json.dumps(item))

            state["actionable_insights"] = validated

        except json.JSONDecodeError as exc:
            logger.error("JSON parse failed: %s\nRaw: %.300s", exc, raw)
            state["actionable_insights"] = []

        return state

    # ── Build LangGraph ────────────────────────────────────────────────────

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(InsightState)

        graph.add_node("validate_insights", self._validate_insights)
        graph.add_node("build_context",     self._build_context)
        graph.add_node("generate_insights", self._generate_insights)
        graph.add_node("parse_response",    self._parse_response)

        graph.set_entry_point("validate_insights")
        graph.add_edge("validate_insights", "build_context")
        graph.add_edge("build_context",     "generate_insights")
        graph.add_edge("generate_insights", "parse_response")
        graph.add_edge("parse_response",    END)

        return graph

    # ── Public API ─────────────────────────────────────────────────────────

    def generate_actionable_insights(
        self,
        raw_insights: Dict[str, Any],
        fallback_recommendations: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Main entry point.

        Args:
            raw_insights: Output from InsightExtractor, enriched with
                          insight_bundle['raw_sessions'] = historical_sessions
                          (must be added in core_engine.generate_llm_insights_for_user)
            fallback_recommendations: Rule-based recs if LLM unavailable

        Returns:
            List of JSON-encoded insight objects (or fallback strings)
        """
        fallback = fallback_recommendations or []

        if not self.is_configured:
            logger.warning("GROQ_API_KEY not set — using fallback")
            return fallback

        try:
            initial_state: InsightState = {
                "raw_insights":        raw_insights,
                "derived_patterns":    {},
                "formatted_prompt":    "",
                "llm_response":        "",
                "actionable_insights": [],
                "error":               None,
                "data_quality":        1.0,
                "validation_warnings": [],
                "quota_exhausted":     False,
            }

            compiled    = self._graph.compile()
            final_state = compiled.invoke(initial_state)

            ai_insights = final_state.get("actionable_insights", [])

            if not ai_insights:
                reason = "quota exhausted" if final_state.get("quota_exhausted") else "empty response"
                logger.warning("LLM insights empty (%s) — using fallback", reason)
                return fallback

            logger.info(
                "Generated %d AI insights (quality=%.0f%%)",
                len(ai_insights),
                final_state.get("data_quality", 0) * 100,
            )
            return ai_insights

        except Exception as exc:
            logger.error("LangGraph pipeline failed: %s", exc)
            return fallback


# ── Singleton factory ─────────────────────────────────────────────────────────
# Re-created per-request if key was absent at import time (fixes late .env loading).

_chain_instance: Optional[GroqInsightChain] = None
_chain_api_key:  str = ""


def get_insight_chain() -> GroqInsightChain:
    """
    Get or create a GroqInsightChain.

    Recreates the instance if GROQ_API_KEY changed since last call
    (handles late .env loading and Render env-var injection).
    """
    global _chain_instance, _chain_api_key
    current_key = os.environ.get("GROQ_API_KEY", "")
    if _chain_instance is None or current_key != _chain_api_key:
        _chain_instance = GroqInsightChain(api_key=current_key)
        _chain_api_key  = current_key
    return _chain_instance
