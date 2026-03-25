"""
🧠 INSIGHT EXTRACTION LAYER v1.0
===================================

This module sits between the core cognitive engine and the LLM.

ARCHITECTURE:
┌─────────────┐      ┌──────────────┐      ┌─────────┐      ┌──────┐
│ Study Log   │  →   │ Core Engine  │  →   │ Insight │  →   │ LLM  │  →  User
│ (Raw Data)  │      │ (Statistics) │      │ Extractor│      │(Text)│
└─────────────┘      └──────────────┘      └─────────┘      └──────┘

PURPOSE:
- Extract PATTERNS from statistics (not just echo logs)
- Find CORRELATIONS between variables
- Identify ROOT CAUSES, not symptoms
- Provide ACTIONABLE solution vectors

This is what makes recommendations INSIGHTFUL, not just descriptive.

Author: StudyFlow Intelligence Team
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import json

logger = logging.getLogger(__name__)


class InsightExtractor:
    """
    Extracts deep insights from study session patterns
    
    These insights are what the LLM needs to give truly helpful advice.
    We do the hard analytical work; LLM does the translation.
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.min_sessions_for_patterns = 5
    
    def extract_session_insights(
        self,
        current_session: Dict,
        historical_sessions: List[Dict],
        skill_tracker: Optional[object] = None
    ) -> Dict:
        """
        Extracts DEEP insights from session data
        
        This is NOT just restating what the user logged.
        This is DISCOVERING patterns they don't see.
        
        Returns rich context for LLM to work with
        """
        insights = {
            "meta": {
                "user_id": self.user_id,
                "session_count": len(historical_sessions) + 1,
                "analysis_type": "pattern_based" if len(historical_sessions) >= self.min_sessions_for_patterns else "baseline"
            }
        }
        
        # INSIGHT 1: Distraction Patterns (NOT just "phone detected")
        insights["distraction_analysis"] = self._analyze_distraction_patterns(
            current_session, historical_sessions
        )
        
        # INSIGHT 2: Performance Correlations
        insights["performance_correlations"] = self._find_performance_drivers(
            current_session, historical_sessions
        )
        
        # INSIGHT 3: Temporal Patterns
        insights["temporal_patterns"] = self._extract_temporal_insights(
            current_session, historical_sessions
        )
        
        # INSIGHT 4: Efficiency Trajectory
        insights["efficiency_trajectory"] = self._analyze_efficiency_trend(
            current_session, historical_sessions
        )
        
        # INSIGHT 5: Skill-Specific Insights
        if skill_tracker:
            insights["skill_insights"] = self._extract_skill_insights(
                current_session, skill_tracker
            )
        
        # INSIGHT 6: Actionable Interventions
        insights["recommended_interventions"] = self._generate_intervention_vectors(
            insights
        )
        
        return insights
    
    # ========================================================================
    # INTERNAL HELPERS
    # ========================================================================
    
    @staticmethod
    def _split_distractions(raw) -> List[str]:
        """Safely split comma-separated strings into a list of uppercase distractions."""
        if not raw:
            return []
        if isinstance(raw, list):
            return [str(item).strip().upper() for item in raw if str(item).strip()]
        return [item.strip().upper() for item in str(raw).split(',') if item.strip()]

    # ========================================================================
    # INSIGHT 1: Distraction Pattern Analysis
    # ========================================================================
    
    def _analyze_distraction_patterns(
        self,
        current_session: Dict,
        historical_sessions: List[Dict]
    ) -> Dict:
        """
        Discovers WHEN and WHY distractions happen
        
        NOT: "Phone detected"
        BUT: "Phone distractions occur 80% in afternoon sessions, 
              correlated with low sleep (r=0.7)"
        """
        current_distractions = set(self._split_distractions(current_session.get('Distractions', '')))
        
        if not historical_sessions:
            return {
                "current_distractions": list(current_distractions),
                "pattern_detected": False,
                "insight": "baseline_observation"
            }
        
        # Analyze historical distraction patterns
        distraction_by_timeslot = defaultdict(lambda: defaultdict(int))
        distraction_by_efficiency = defaultdict(list)
        distraction_sequences = []
        
        for session in historical_sessions:
            timeslot = session.get('TimeSlot', 'Unknown')
            distractions = self._split_distractions(session.get('Distractions', ''))
            efficiency = float(session.get('Efficiency', 0) or 0)
            
            for dist in distractions:
                distraction_by_timeslot[dist][timeslot] += 1
                distraction_by_efficiency[dist].append(efficiency)
        
        # Find patterns for current distractions
        patterns: Dict[str, Any] = {}
        
        for distraction in current_distractions:
            if distraction not in distraction_by_timeslot:
                continue
            
            # When does this distraction occur most?
            timeslot_counts = distraction_by_timeslot[distraction]
            if timeslot_counts:
                most_common_slot = max(timeslot_counts.items(), key=lambda x: x[1])
                total_occurrences = sum(timeslot_counts.values())
                
                patterns[distraction] = {
                    "frequency": total_occurrences,
                    "primary_timeslot": most_common_slot[0],
                    "timeslot_concentration": most_common_slot[1] / total_occurrences if total_occurrences > 0 else 0,
                    "avg_efficiency_when_present": np.mean(distraction_by_efficiency[distraction]) if distraction_by_efficiency[distraction] else 0
                }
        
        # Extract actionable insight
        insight_text = None
        intervention_priority = "low"
        
        if patterns:
            # Find the most problematic distraction
            worst_distraction = max(
                patterns.items(),
                key=lambda x: x[1]['frequency'] * (1 - x[1]['avg_efficiency_when_present'] / 100)
            )
            
            dist_name = worst_distraction[0]
            dist_data = worst_distraction[1]
            
            if dist_data['timeslot_concentration'] > 0.6:  # Happens >60% in one timeslot
                insight_text = f"{dist_name} distraction is concentrated in {dist_data['primary_timeslot']} sessions ({dist_data['timeslot_concentration']*100:.0f}% of occurrences)"
                intervention_priority = "high"
            elif dist_data['frequency'] > len(historical_sessions) * 0.5:  # Happens in >50% of sessions
                insight_text = f"{dist_name} is a chronic issue ({dist_data['frequency']}/{len(historical_sessions)} sessions), reducing efficiency to {dist_data['avg_efficiency_when_present']:.0f}% average"
                intervention_priority = "critical"
        
        return {
            "current_distractions": list(current_distractions),
            "pattern_detected": len(patterns) > 0,
            "patterns": patterns,
            "primary_insight": insight_text,
            "intervention_priority": intervention_priority
        }
    
    # ========================================================================
    # INSIGHT 2: Performance Correlation Discovery
    # ========================================================================
    
    def _find_performance_drivers(
        self,
        current_session: Dict,
        historical_sessions: List[Dict]
    ) -> Dict:
        """
        Discovers WHAT drives high vs low performance
        
        NOT: "Your efficiency was 45%"
        BUT: "Sessions with >7hrs sleep average 78% efficiency vs 42% with <7hrs (p<0.05)"
        """
        if len(historical_sessions) < 5:
            return {"sufficient_data": False}
        
        # Bucket sessions by efficiency
        high_perf = [s for s in historical_sessions if float(s.get('Efficiency', 0) or 0) >= 70]
        low_perf = [s for s in historical_sessions if float(s.get('Efficiency', 0) or 0) < 50]
        
        correlations: Dict[str, Any] = {}
        
        # Factor 1: Time of day
        if high_perf and low_perf:
            high_timeslots = [s.get('TimeSlot') for s in high_perf]
            low_timeslots = [s.get('TimeSlot') for s in low_perf]
            
            from collections import Counter
            high_common = Counter(high_timeslots).most_common(1)
            low_common = Counter(low_timeslots).most_common(1)
            
            if high_common and low_common:
                best_effs = [float(s.get('Efficiency', 0) or 0) for s in high_perf]
                worst_effs = [float(s.get('Efficiency', 0) or 0) for s in low_perf]
                correlations['timeslot_driver'] = {
                    "best_timeslot": high_common[0][0],
                    "worst_timeslot": low_common[0][0],
                    "best_avg_efficiency": float(np.mean(best_effs)),
                    "worst_avg_efficiency": float(np.mean(worst_effs)),
                    "delta": float(np.mean(best_effs) - np.mean(worst_effs))
                }
        
        # Factor 2: Session duration
        if len(historical_sessions) >= 10:
            durations = []
            efficiencies = []
            
            for s in historical_sessions:
                start = s.get('StartTime')
                end = s.get('EndTime')
                if start and end:
                    duration = (end - start).total_seconds() / 60
                    durations.append(duration)
                    efficiencies.append(float(s.get('Efficiency', 0) or 0))
            
            if durations:
                # Find sweet spot
                duration_buckets = {
                    "short": ([e for d, e in zip(durations, efficiencies) if d < 35], "< 35min"),
                    "medium": ([e for d, e in zip(durations, efficiencies) if 35 <= d < 65], "35-65min"),
                    "long": ([e for d, e in zip(durations, efficiencies) if d >= 65], "> 65min")
                }
                
                bucket_avgs = {
                    name: (np.mean(effs), label) 
                    for name, (effs, label) in duration_buckets.items() 
                    if effs
                }
                
                if bucket_avgs:
                    best_duration = max(bucket_avgs.items(), key=lambda x: x[1][0])
                    
                    correlations['duration_driver'] = {
                        "optimal_range": best_duration[1][1],
                        "optimal_avg_efficiency": best_duration[1][0],
                        "insight": f"Your peak performance occurs in {best_duration[1][1]} sessions"
                    }
        
        # Factor 3: Flow state correlation (Fallback to FocusLevel if FlowState missing)
        flow_sessions = [s for s in historical_sessions if s.get('FlowState', False) or int(s.get('FocusLevel', 0) or 0) >= 4]
        non_flow_sessions = [s for s in historical_sessions if not s.get('FlowState', False) and int(s.get('FocusLevel', 0) or 0) < 4]
        
        if flow_sessions and non_flow_sessions:
            flow_avg = float(np.mean([float(s.get('Efficiency', 0) or 0) for s in flow_sessions]))
            non_flow_avg = float(np.mean([float(s.get('Efficiency', 0) or 0) for s in non_flow_sessions]))
            
            correlations['flow_state_driver'] = {
                "flow_avg_efficiency": flow_avg,
                "non_flow_avg_efficiency": non_flow_avg,
                "flow_boost": flow_avg - non_flow_avg,
                "flow_frequency": len(flow_sessions) / len(historical_sessions)
            }
        
        return {
            "sufficient_data": True,
            "correlations": correlations,
            "primary_driver": self._identify_primary_driver(correlations)
        }
    
    def _identify_primary_driver(self, correlations: Dict) -> Optional[str]:
        """Identifies the single most impactful factor"""
        if not correlations:
            return None
        
        drivers = []
        
        if 'timeslot_driver' in correlations:
            drivers.append(('timeslot', correlations['timeslot_driver'].get('delta', 0)))
        
        if 'flow_state_driver' in correlations:
            drivers.append(('flow_state', correlations['flow_state_driver'].get('flow_boost', 0)))
        
        if drivers:
            primary = max(drivers, key=lambda x: x[1])
            if primary[1] > 15:  # Significant impact (>15% efficiency difference)
                return primary[0]
        
        return None
    
    # ========================================================================
    # INSIGHT 3: Temporal Pattern Discovery
    # ========================================================================
    
    def _extract_temporal_insights(
        self,
        current_session: Dict,
        historical_sessions: List[Dict]
    ) -> Dict:
        """
        Discovers time-based patterns
        
        NOT: "It's Monday"
        BUT: "Your Monday sessions average 20% lower efficiency than Wednesday"
        """
        if len(historical_sessions) < 7:
            return {"sufficient_data": False}
        
        # Day of week patterns
        dow_efficiency = defaultdict(list)
        
        for session in historical_sessions:
            timestamp = session.get('StartTime') or session.get('timestamp')
            if timestamp:
                dow = timestamp.strftime('%A')
                efficiency = float(session.get('Efficiency', 0) or 0)
                dow_efficiency[dow].append(efficiency)
        
        # Find best and worst days
        dow_avgs = {
            day: float(np.mean(effs)) 
            for day, effs in dow_efficiency.items() 
            if effs
        }
        
        insights: Dict[str, Any] = {}
        
        if len(dow_avgs) >= 3:
            best_day = max(dow_avgs.items(), key=lambda x: x[1])
            worst_day = min(dow_avgs.items(), key=lambda x: x[1])
            
            insights['day_of_week'] = {
                "best_day": best_day[0],
                "best_avg": best_day[1],
                "worst_day": worst_day[0],
                "worst_avg": worst_day[1],
                "delta": best_day[1] - worst_day[1],
                "current_day": current_session.get('StartTime', datetime.now()).strftime('%A')
            }
        
        # Time decay pattern (getting worse over time?)
        if len(historical_sessions) >= 10:
            recent_5 = historical_sessions[-5:]
            older_5 = historical_sessions[-10:-5]
            
            recent_avg = float(np.mean([float(s.get('Efficiency', 0) or 0) for s in recent_5]))
            older_avg = float(np.mean([float(s.get('Efficiency', 0) or 0) for s in older_5]))
            
            insights['trend'] = {
                "recent_avg": recent_avg,
                "older_avg": older_avg,
                "direction": "improving" if recent_avg > older_avg else "declining",
                "magnitude": abs(recent_avg - older_avg)
            }
        
        return insights
    
    # ========================================================================
    # INSIGHT 4: Efficiency Trajectory Analysis
    # ========================================================================
    
    def _analyze_efficiency_trend(
        self,
        current_session: Dict,
        historical_sessions: List[Dict]
    ) -> Dict:
        """
        Predicts where user is headed
        
        NOT: "Efficiency is 65%"
        BUT: "Efficiency declining 5%/week. At this rate, you'll hit 50% in 2 weeks"
        """
        if len(historical_sessions) < 5:
            return {"sufficient_data": False}
        
        # Extract time series
        timestamps = []
        efficiencies = []
        
        for session in historical_sessions:
            ts = session.get('StartTime') or session.get('timestamp')
            if ts:
                timestamps.append(ts)
                efficiencies.append(float(session.get('Efficiency', 0) or 0))
        
        if not timestamps:
            return {"sufficient_data": False}
        
        # Convert to days since first session
        days_since_start = [(ts - timestamps[0]).days for ts in timestamps]
        
        # Linear regression
        if len(days_since_start) >= 5:
            slope, intercept = np.polyfit(days_since_start, efficiencies, 1)
            
            # Predict next week
            current_days = (datetime.now() - timestamps[0]).days
            next_week_days = current_days + 7
            predicted_next_week = slope * next_week_days + intercept
            
            # Weekly rate of change
            weekly_change = slope * 7
            
            trajectory = {
                "current_efficiency": float(current_session.get('Efficiency', 0) or 0),
                "trend_slope": slope,
                "weekly_change_rate": weekly_change,
                "predicted_next_week": predicted_next_week,
                "trajectory": "improving" if slope > 0 else "declining",
                "urgency": "high" if abs(weekly_change) > 5 else "normal"
            }
            
            # Add warning if declining rapidly
            if slope < -0.5:  # Declining >3.5% per week
                trajectory["warning"] = f"Efficiency declining {abs(weekly_change):.1f}% per week"
            
            return trajectory
        
        return {"sufficient_data": False}
    
    # ========================================================================
    # INSIGHT 5: Skill-Specific Insights
    # ========================================================================
    
    def _extract_skill_insights(
        self,
        current_session: Dict,
        skill_tracker: object
    ) -> Dict:
        """
        Skill-level insights
        
        NOT: "Fluid reasoning score: 2.3"
        BUT: "Your fluid reasoning peaked 2 weeks ago at 3.5, now at 2.3. 
              This coincides with switching from problem-solving to memorization tasks"
        """
        insights = {}
        
        # Get all skill trends
        from models.data_models import CognitiveSkill
        
        for skill in CognitiveSkill:
            trend = skill_tracker.get_skill_trend(skill.value, days=30)
            
            if trend.get('trend') != 'insufficient_data':
                skill_name = skill.name.replace('_', ' ').title()
                
                if trend['trend'] == 'declining' and abs(trend['change_percent']) > 15:
                    insights[skill.value] = {
                        "skill_name": skill_name,
                        "status": "declining",
                        "change": trend['change_percent'],
                        "current_level": trend['current_level'],
                        "peak_level": trend['starting_level'],
                        "urgency": "high" if abs(trend['change_percent']) > 25 else "medium"
                    }
                
                elif trend['trend'] == 'improving' and trend['change_percent'] > 20:
                    insights[skill.value] = {
                        "skill_name": skill_name,
                        "status": "improving",
                        "change": trend['change_percent'],
                        "current_level": trend['current_level'],
                        "growth_rate": trend['change_percent'] / 30  # per day
                    }
        
        return insights
    
    # ========================================================================
    # INSIGHT 6: Intervention Recommendations
    # ========================================================================
    
    def _generate_intervention_vectors(self, insights: Dict) -> List[Dict]:
        """
        Generates specific, actionable intervention strategies
        
        These are SOLUTION VECTORS, not vague advice
        """
        interventions = []
        
        # Intervention 1: Distraction-specific
        distraction_analysis = insights.get('distraction_analysis', {})
        if distraction_analysis.get('pattern_detected'):
            patterns = distraction_analysis.get('patterns', {})
            
            for dist, data in patterns.items():
                if data['timeslot_concentration'] > 0.6:
                    interventions.append({
                        "type": "distraction_mitigation",
                        "priority": "high",
                        "problem": f"{dist} concentrated in {data['primary_timeslot']}",
                        "solution_vector": f"Reschedule to different timeslot OR implement {dist}-specific blocker during {data['primary_timeslot']}",
                        "expected_improvement": f"+{(100 - data['avg_efficiency_when_present']):.0f}% efficiency potential"
                    })
        
        # Intervention 2: Timeslot optimization
        perf_correlations = insights.get('performance_correlations', {})
        if perf_correlations.get('sufficient_data'):
            correlations = perf_correlations.get('correlations', {})
            
            if 'timeslot_driver' in correlations:
                driver = correlations['timeslot_driver']
                if driver['delta'] > 20:
                    interventions.append({
                        "type": "schedule_optimization",
                        "priority": "critical",
                        "problem": f"{driver['worst_timeslot']} sessions average {driver['worst_avg_efficiency']:.0f}% efficiency",
                        "solution_vector": f"Shift all study to {driver['best_timeslot']} (averages {driver['best_avg_efficiency']:.0f}%)",
                        "expected_improvement": f"+{driver['delta']:.0f}% efficiency"
                    })
        
        # Intervention 3: Trajectory correction
        trajectory = insights.get('efficiency_trajectory', {})
        if trajectory.get('trajectory') == 'declining' and trajectory.get('urgency') == 'high':
            interventions.append({
                "type": "trajectory_correction",
                "priority": "critical",
                "problem": f"Efficiency declining {abs(trajectory['weekly_change_rate']):.1f}%/week",
                "solution_vector": "Immediate protocol reset: baseline assessment + factor isolation",
                "timeframe": "This week"
            })
        
        # Intervention 4: Skill-specific training
        skill_insights = insights.get('skill_insights', {})
        for skill_id, skill_data in skill_insights.items():
            if skill_data.get('status') == 'declining' and skill_data.get('urgency') == 'high':
                interventions.append({
                    "type": "skill_development",
                    "priority": "high",
                    "problem": f"{skill_data['skill_name']} dropped {abs(skill_data['change']):.0f}%",
                    "solution_vector": f"Dedicated {skill_data['skill_name']} training (3 sessions/week, 20min each)",
                    "expected_recovery": "2-3 weeks to baseline"
                })
        
        # Sort by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        interventions.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 3))
        
        return interventions[:5]  # Top 5 interventions


# ============================================================================
# LLM PROMPT GENERATOR
# ============================================================================

class LLMPromptGenerator:
    """
    Converts statistical insights into LLM-ready prompts
    
    The LLM's job: Translate cold statistics into warm, empathetic guidance
    Our job: Give it the RIGHT statistics to work with
    """
    
    @staticmethod
    def generate_feedback_prompt(insights: Dict) -> str:
        """
        Creates a structured prompt for the LLM
        
        The prompt includes:
        1. Context (user history, session count)
        2. Statistical insights (patterns, correlations)
        3. Intervention vectors (what to do)
        4. Constraints (be specific, actionable, empathetic)
        """
        
        prompt = f"""You are an AI study coach analyzing a student's performance data.

**Student Context:**
- Total sessions logged: {insights['meta']['session_count']}
- Analysis type: {insights['meta']['analysis_type']}

**Current Session Analysis:**
"""
        
        # Add distraction insights
        dist_analysis = insights.get('distraction_analysis', {})
        if dist_analysis.get('pattern_detected'):
            prompt += f"\n**Distraction Pattern Detected:**\n"
            prompt += f"- {dist_analysis.get('primary_insight', 'Pattern found')}\n"
            prompt += f"- Priority: {dist_analysis.get('intervention_priority', 'medium')}\n"
        
        # Add performance correlations
        perf_corr = insights.get('performance_correlations', {})
        if perf_corr.get('sufficient_data'):
            prompt += f"\n**Performance Drivers:**\n"
            correlations = perf_corr.get('correlations', {})
            
            if 'timeslot_driver' in correlations:
                driver = correlations['timeslot_driver']
                prompt += f"- Best performance in {driver['best_timeslot']} ({driver['best_avg_efficiency']:.0f}% avg)\n"
                prompt += f"- Worst performance in {driver['worst_timeslot']} ({driver['worst_avg_efficiency']:.0f}% avg)\n"
                prompt += f"- Delta: {driver['delta']:.0f}% efficiency difference\n"
        
        # Add efficiency trajectory
        trajectory = insights.get('efficiency_trajectory', {})
        if trajectory.get('sufficient_data'):
            prompt += f"\n**Performance Trajectory:**\n"
            prompt += f"- Trend: {trajectory['trajectory']}\n"
            prompt += f"- Rate: {trajectory['weekly_change_rate']:.1f}%/week\n"
            prompt += f"- Predicted next week: {trajectory['predicted_next_week']:.0f}%\n"
        
        # Add intervention recommendations
        interventions = insights.get('recommended_interventions', [])
        if interventions:
            prompt += f"\n**Recommended Interventions (from data analysis):**\n"
            for i, intervention in enumerate(interventions[:3], 1):
                prompt += f"\n{i}. [{intervention['type'].upper()}]\n"
                prompt += f"   Problem: {intervention['problem']}\n"
                prompt += f"   Solution: {intervention['solution_vector']}\n"
                if 'expected_improvement' in intervention:
                    prompt += f"   Expected: {intervention['expected_improvement']}\n"
        
        # LLM instructions
        prompt += """

**Your Task:**
Generate a personalized, actionable feedback message (150-200 words) that:

1. **Acknowledges** the specific patterns discovered in their data
2. **Explains WHY** these patterns matter (impact on learning)
3. **Provides 2-3 SPECIFIC actions** they can take this week
4. **Uses empathetic language** that motivates rather than criticizes
5. **Focuses on solutions**, not just problems

**Tone:** Supportive coach who's analyzed their data and has a clear plan

**Format:** Natural paragraphs (not bullet points unless listing specific steps)

**Example good output:**
"I noticed something interesting in your study patterns: your afternoon sessions are averaging 20% lower efficiency than morning sessions, and this coincides with phone distractions happening 80% during that 2-4pm window. This isn't about willpower – your data shows a clear vulnerability period. Here's what will actually work: Schedule your hardest subjects before 2pm when you're naturally sharper, or if afternoons are your only option, put your phone in airplane mode before you start. Based on similar patterns, students who make this shift typically see efficiency jump back to 75%+ within a week."

Generate the feedback now:
"""
        
        return prompt


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("INSIGHT EXTRACTION DEMO")
    print("=" * 70)
    
    # Simulate historical sessions
    from datetime import datetime, timedelta
    
    historical = []
    for i in range(15):
        # Simulate pattern: Phone distractions mostly in afternoon
        timeslot = "Afternoon" if i % 3 == 0 else "Morning"
        distractions = ["PHONE"] if timeslot == "Afternoon" else []
        efficiency = 45 if timeslot == "Afternoon" else 75
        
        historical.append({
            'StartTime': datetime.now() - timedelta(days=15-i),
            'EndTime': datetime.now() - timedelta(days=15-i, hours=-1),
            'TimeSlot': timeslot,
            'Distractions': distractions,
            'Efficiency': efficiency + (i * 0.5),  # Slight improvement over time
            'FlowState': efficiency > 70
        })
    
    # Current session
    current = {
        'LogID': 'test_001',
        'StartTime': datetime.now(),
        'EndTime': datetime.now() + timedelta(hours=1),
        'TimeSlot': 'Afternoon',
        'Distractions': ['PHONE'],
        'Efficiency': 48,
        'FlowState': False
    }
    
    # Extract insights
    extractor = InsightExtractor("user_123")
    insights = extractor.extract_session_insights(current, historical)
    
    # Display insights
    print("\n📊 EXTRACTED INSIGHTS:")
    print(json.dumps(insights, indent=2, default=str))
    
    # Generate LLM prompt
    print("\n" + "=" * 70)
    print("LLM PROMPT (what gets sent to Gemini/GPT):")
    print("=" * 70)
    
    prompt = LLMPromptGenerator.generate_feedback_prompt(insights)
    print(prompt)
    
    print("\n" + "=" * 70)
    print("✅ DEMO COMPLETE")
    print("=" * 70)
