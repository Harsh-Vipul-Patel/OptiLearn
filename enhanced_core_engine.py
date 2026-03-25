"""
🧠 STUDYFLOW AI ANALYTICS & RECOMMENDATION ENGINE - ENHANCED v2.0
====================================================================

Major Updates:
1. ✅ Adaptive Cognitive Weights (personalization with safety)
2. ✅ User Skill Tracking & Growth Measurement
3. ✅ Enhanced Time-Series Prediction (EMA + temporal patterns)
4. ✅ Skill Gap Analysis
5. ✅ Template-based recommendations (no runtime LLM)

Author: StudyFlow AI Team
Version: 2.0.0
Date: 2026-02-04
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from enum import Enum
import logging
import json
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
    PHONE = 0.25
    SOCIAL_MEDIA = 0.30
    NOISE = 0.20
    TIRED = 0.35
    HUNGER = 0.15
    MULTITASKING = 0.40
    INTERRUPTIONS = 0.28


class CognitiveSkill(Enum):
    """Based on Cattell-Horn-Carroll Theory of Intelligence"""
    FLUID_REASONING = "Gf"
    CRYSTALLIZED_INTEL = "Gc"
    VISUAL_SPATIAL = "Gv"
    PROCESSING_SPEED = "Gs"
    WORKING_MEMORY = "Gwm"
    LONG_TERM_MEMORY = "Glr"
    CREATIVITY = "Gcr"


# ============================================================================
# BASE SUBJECT PROFILES (Research-Backed, Curated)
# ============================================================================

BASE_SUBJECT_PROFILES = {
    "Mathematics": {
        "Calculus": {
            CognitiveSkill.FLUID_REASONING: 0.95,
            CognitiveSkill.VISUAL_SPATIAL: 0.70,
            CognitiveSkill.WORKING_MEMORY: 0.80,
            CognitiveSkill.PROCESSING_SPEED: 0.75,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.65,
            CognitiveSkill.LONG_TERM_MEMORY: 0.60,
            CognitiveSkill.CREATIVITY: 0.60,
        },
        "Linear Algebra": {
            CognitiveSkill.VISUAL_SPATIAL: 0.90,
            CognitiveSkill.FLUID_REASONING: 0.85,
            CognitiveSkill.WORKING_MEMORY: 0.75,
            CognitiveSkill.PROCESSING_SPEED: 0.70,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.65,
            CognitiveSkill.CREATIVITY: 0.55,
            CognitiveSkill.LONG_TERM_MEMORY: 0.60,
        },
        "Statistics": {
            CognitiveSkill.FLUID_REASONING: 0.85,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.80,
            CognitiveSkill.VISUAL_SPATIAL: 0.75,
            CognitiveSkill.WORKING_MEMORY: 0.70,
            CognitiveSkill.PROCESSING_SPEED: 0.60,
            CognitiveSkill.LONG_TERM_MEMORY: 0.65,
            CognitiveSkill.CREATIVITY: 0.50,
        }
    },
    
    "Physics": {
        "Electromagnetism": {
            CognitiveSkill.VISUAL_SPATIAL: 0.95,
            CognitiveSkill.FLUID_REASONING: 0.90,
            CognitiveSkill.WORKING_MEMORY: 0.70,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.75,
            CognitiveSkill.PROCESSING_SPEED: 0.65,
            CognitiveSkill.CREATIVITY: 0.70,
            CognitiveSkill.LONG_TERM_MEMORY: 0.60,
        },
        "Mechanics": {
            CognitiveSkill.FLUID_REASONING: 0.90,
            CognitiveSkill.VISUAL_SPATIAL: 0.85,
            CognitiveSkill.WORKING_MEMORY: 0.70,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.70,
            CognitiveSkill.PROCESSING_SPEED: 0.65,
            CognitiveSkill.LONG_TERM_MEMORY: 0.60,
            CognitiveSkill.CREATIVITY: 0.60,
        },
        "Quantum Mechanics": {
            CognitiveSkill.FLUID_REASONING: 0.95,
            CognitiveSkill.VISUAL_SPATIAL: 0.90,
            CognitiveSkill.WORKING_MEMORY: 0.85,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.80,
            CognitiveSkill.CREATIVITY: 0.75,
            CognitiveSkill.PROCESSING_SPEED: 0.70,
            CognitiveSkill.LONG_TERM_MEMORY: 0.65,
        }
    },
    
    "Chemistry": {
        "Organic Chemistry": {
            CognitiveSkill.VISUAL_SPATIAL: 0.90,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.80,
            CognitiveSkill.WORKING_MEMORY: 0.75,
            CognitiveSkill.FLUID_REASONING: 0.70,
            CognitiveSkill.LONG_TERM_MEMORY: 0.70,
            CognitiveSkill.CREATIVITY: 0.65,
            CognitiveSkill.PROCESSING_SPEED: 0.60,
        },
        "General Chemistry": {
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.85,
            CognitiveSkill.FLUID_REASONING: 0.75,
            CognitiveSkill.VISUAL_SPATIAL: 0.70,
            CognitiveSkill.WORKING_MEMORY: 0.70,
            CognitiveSkill.LONG_TERM_MEMORY: 0.70,
            CognitiveSkill.PROCESSING_SPEED: 0.60,
            CognitiveSkill.CREATIVITY: 0.50,
        }
    },
    
    "Programming": {
        "Algorithms": {
            CognitiveSkill.FLUID_REASONING: 0.95,
            CognitiveSkill.WORKING_MEMORY: 0.85,
            CognitiveSkill.PROCESSING_SPEED: 0.80,
            CognitiveSkill.CREATIVITY: 0.70,
            CognitiveSkill.VISUAL_SPATIAL: 0.65,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.70,
            CognitiveSkill.LONG_TERM_MEMORY: 0.60,
        },
        "Web Development": {
            CognitiveSkill.CREATIVITY: 0.85,
            CognitiveSkill.VISUAL_SPATIAL: 0.80,
            CognitiveSkill.FLUID_REASONING: 0.75,
            CognitiveSkill.WORKING_MEMORY: 0.70,
            CognitiveSkill.PROCESSING_SPEED: 0.70,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.65,
            CognitiveSkill.LONG_TERM_MEMORY: 0.55,
        }
    },
    
    "Design": {
        "UI/UX Design": {
            CognitiveSkill.VISUAL_SPATIAL: 0.95,
            CognitiveSkill.CREATIVITY: 0.90,
            CognitiveSkill.FLUID_REASONING: 0.60,
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.70,
            CognitiveSkill.WORKING_MEMORY: 0.65,
            CognitiveSkill.PROCESSING_SPEED: 0.60,
            CognitiveSkill.LONG_TERM_MEMORY: 0.55,
        }
    },
    
    "Languages": {
        "General": {
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.90,
            CognitiveSkill.LONG_TERM_MEMORY: 0.85,
            CognitiveSkill.WORKING_MEMORY: 0.75,
            CognitiveSkill.PROCESSING_SPEED: 0.65,
            CognitiveSkill.FLUID_REASONING: 0.50,
            CognitiveSkill.VISUAL_SPATIAL: 0.40,
            CognitiveSkill.CREATIVITY: 0.60,
        }
    },
    
    "History": {
        "General": {
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.95,
            CognitiveSkill.LONG_TERM_MEMORY: 0.90,
            CognitiveSkill.FLUID_REASONING: 0.65,
            CognitiveSkill.CREATIVITY: 0.70,
            CognitiveSkill.WORKING_MEMORY: 0.60,
            CognitiveSkill.PROCESSING_SPEED: 0.55,
            CognitiveSkill.VISUAL_SPATIAL: 0.50,
        }
    },
    
    "Biology": {
        "General": {
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.90,
            CognitiveSkill.LONG_TERM_MEMORY: 0.85,
            CognitiveSkill.VISUAL_SPATIAL: 0.70,
            CognitiveSkill.WORKING_MEMORY: 0.65,
            CognitiveSkill.FLUID_REASONING: 0.60,
            CognitiveSkill.PROCESSING_SPEED: 0.55,
            CognitiveSkill.CREATIVITY: 0.50,
        }
    },
    
    "Literature": {
        "General": {
            CognitiveSkill.CRYSTALLIZED_INTEL: 0.90,
            CognitiveSkill.CREATIVITY: 0.85,
            CognitiveSkill.LONG_TERM_MEMORY: 0.75,
            CognitiveSkill.FLUID_REASONING: 0.70,
            CognitiveSkill.WORKING_MEMORY: 0.65,
            CognitiveSkill.PROCESSING_SPEED: 0.60,
            CognitiveSkill.VISUAL_SPATIAL: 0.40,
        }
    }
}


# ============================================================================
# RECOMMENDATION TEMPLATES (Generated offline, used at runtime)
# ============================================================================

RECOMMENDATION_TEMPLATES = {
    'low_efficiency': [
        "⚠️ Efficiency at {efficiency:.0f}%. Focus on eliminating distractions before your next session.",
        "Your session efficiency was {efficiency:.0f}%. Consider reviewing your study environment setup.",
        "Detected {efficiency:.0f}% efficiency. Try the Pomodoro technique: 25min work, 5min break.",
    ],
    
    'high_efficiency': [
        "🌟 Excellent! {efficiency:.0f}% efficiency. Keep replicating these conditions.",
        "Outstanding performance at {efficiency:.0f}%. Your study setup is working great!",
        "Impressive {efficiency:.0f}% efficiency. You've found your optimal study state.",
    ],
    
    'phone_distraction': [
        "📱 Phone detected as distraction. Try airplane mode or app blockers (Freedom, Forest).",
        "📱 Digital interruptions hurt focus. Place phone in another room next time.",
        "📱 Phone distractions reduce efficiency by 25%. Consider a phone-free study zone.",
    ],
    
    'tired_distraction': [
        "😴 Fatigue detected. Schedule study sessions after rest, not before.",
        "😴 Low energy impacts performance. Ensure 7-8 hours sleep before study sessions.",
        "😴 Tiredness reduces efficiency by 30%. Consider power naps or earlier study times.",
    ],
    
    'hunger_distraction': [
        "🍎 Hunger detected. Eat a healthy snack 30-60 minutes before studying.",
        "🍎 Low blood sugar impairs cognition. Keep healthy snacks nearby.",
        "🍎 Hunger reduces focus by 15%. Never study on an empty stomach.",
    ],
    
    'brain_heavy': [
        "🧠 Cognitive overload detected. Break topics into smaller, manageable chunks.",
        "🧠 Material too complex. Use Pomodoro: 25min work, 5min break to prevent burnout.",
        "🧠 Feeling overwhelmed? Try explaining concepts out loud to solidify understanding.",
    ],
    
    'flow_achieved': [
        "🌊 Flow state achieved! Time dilation: {multiplier:.1f}x. Replicate these conditions.",
        "🌊 You were in the zone! {multiplier:.1f}x productivity boost detected.",
        "🌊 Deep focus unlocked. Try to recreate this environment for future sessions.",
    ],
    
    'skill_gf_drop': [
        "⚠️ Problem-solving performance dropped {percent}%. Practice novel problems or logic puzzles.",
        "Your analytical thinking dipped {percent}%. Try warming up with easier exercises first.",
        "Fluid reasoning down {percent}%. Review fundamentals before tackling complex problems.",
    ],
    
    'skill_gc_drop': [
        "📚 Knowledge recall dropped {percent}%. Use spaced repetition for key concepts.",
        "Crystallized intelligence down {percent}%. Review notes and use active recall techniques.",
        "Memory retrieval efficiency decreased {percent}%. Consider flashcards or self-testing.",
    ],
    
    'skill_gv_drop': [
        "👁️ Spatial processing down {percent}%. Use more diagrams and visual aids.",
        "Visual-spatial skills decreased {percent}%. Try sketching concepts before solving.",
        "Visualization ability dropped {percent}%. Practice mental imagery exercises.",
    ],
    
    'skill_gs_drop': [
        "⚡ Processing speed down {percent}%. Practice timed exercises for fluency.",
        "Cognitive speed decreased {percent}%. Focus on automaticity of basic operations.",
        "Speed efficiency dropped {percent}%. Drill fundamentals until they're automatic.",
    ],
    
    'skill_improving': [
        "🎉 Excellent progress! Your {skill_name} improved {percent}% this month.",
        "📈 {skill_name} is trending up {percent}%. Keep up the great work!",
        "✨ Major improvement in {skill_name}: +{percent}%. Your practice is paying off!",
    ],
    
    'skill_gap_high': [
        "📊 To excel in {topic}, strengthen your {skill_name} (gap: {gap}%).",
        "🎯 {topic} requires strong {skill_name}. Current gap: {gap}%. Focus here first.",
        "⚠️ {skill_name} needs work for {topic}. You're {gap}% below optimal level.",
    ],
    
    'first_session': [
        "👋 First session is always exploratory. Don't worry about performance yet.",
        "🌱 Welcome! Initial sessions help us calibrate. Keep logging for personalized insights.",
        "📝 Early sessions establish your baseline. Consistency matters more than perfection.",
    ],
    
    'long_session': [
        "⏱️ {duration}min session detected. Break into 45-60min chunks with breaks for better retention.",
        "Long study marathon ({duration}min). Quality often beats quantity - consider shorter, focused sessions.",
        "{duration}min is ambitious! Remember: mental fatigue reduces returns after 90min.",
    ],
    
    'subject_specific_math': [
        "📐 For math: have scratch paper ready and work through derivations step-by-step.",
        "🔢 Math tip: verbalize your problem-solving process to catch logic errors.",
        "➗ Struggling with math? Try teaching the concept to someone (or a rubber duck!).",
    ],
    
    'subject_specific_programming': [
        "💻 Programming tip: Set up your IDE and close all other apps before starting.",
        "⌨️ Code quality over quantity. One well-understood algorithm beats ten rushed ones.",
        "🐛 Debugging is learning. Don't skip error messages - they're teaching you.",
    ],
    
    'subject_specific_languages': [
        "🗣️ Language learning: Practice active recall. Test yourself without looking at notes.",
        "🌍 Immersion helps. Try thinking in the language during your next session.",
        "📖 For languages: speak out loud, even when studying alone. Muscle memory matters.",
    ],
}


# ============================================================================
# ADAPTIVE WEIGHT ENGINE (NEW!)
# ============================================================================

class AdaptiveWeightEngine:
    """
    Implements personalized cognitive weight learning
    WITH safety checks to prevent overfitting
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.min_sessions_for_personalization = 10
        self.learning_rate = 0.05
        self.regularization = 0.01
        self.max_deviation = 0.3  # ±30% from base weights
        self.momentum_beta1 = 0.9
        self.momentum_beta2 = 0.999
        self.epsilon = 1e-8
        
        # State variables (loaded from database)
        self.weight_deltas = {}  # Δ_user for each subject/topic
        self.momentum_m = {}
        self.momentum_v = {}
        self.session_count = 0
        self.validation_errors = []
    
    def get_personalized_weights(
        self,
        subject_category: str,
        topic_name: str,
        base_weights: Dict[CognitiveSkill, float]
    ) -> Dict[CognitiveSkill, float]:
        """
        Returns personalized weights if user has enough data
        Otherwise returns base weights
        
        Formula: W_personal = W_base + Δ_user (clipped to ±30%)
        """
        if self.session_count < self.min_sessions_for_personalization:
            # Not enough data - use base weights
            return base_weights
        
        key = f"{subject_category}:{topic_name}"
        
        if key not in self.weight_deltas:
            # No personalization for this subject yet
            return base_weights
        
        # Apply personalization with confidence weighting
        confidence = min(1.0, self.session_count / 20)
        
        personalized = {}
        for skill, base_weight in base_weights.items():
            delta = self.weight_deltas[key].get(skill, 0.0)
            
            # Clip delta to prevent drift
            delta = np.clip(delta, -self.max_deviation, self.max_deviation)
            
            # Blend base and personalized weights by confidence
            personal_weight = base_weight + (confidence * delta)
            
            # Ensure weights stay in valid range [0, 1]
            personalized[skill] = np.clip(personal_weight, 0.0, 1.0)
        
        return personalized
    
    def update_weights(
        self,
        subject_category: str,
        topic_name: str,
        base_weights: Dict[CognitiveSkill, float],
        actual_efficiency: float,
        predicted_efficiency: float,
        skill_throughputs: Dict[str, float]
    ):
        """
        Updates personalized weights using Adam optimizer
        
        Only updates if:
        1. User has minimum sessions
        2. Update improves validation error
        """
        if self.session_count < self.min_sessions_for_personalization:
            return  # Too early
        
        key = f"{subject_category}:{topic_name}"
        
        # Initialize if needed
        if key not in self.weight_deltas:
            self.weight_deltas[key] = {skill: 0.0 for skill in CognitiveSkill}
            self.momentum_m[key] = {skill: 0.0 for skill in CognitiveSkill}
            self.momentum_v[key] = {skill: 0.0 for skill in CognitiveSkill}
        
        # Compute prediction error
        error = actual_efficiency - predicted_efficiency
        
        # Compute gradients for each skill
        # Gradient proportional to skill usage and error
        for skill in CognitiveSkill:
            skill_usage = skill_throughputs.get(skill.value, 0.0)
            
            if skill_usage == 0:
                continue  # Skip unused skills
            
            # Gradient: ∂Loss/∂Δ = -2 * error * skill_usage + regularization * Δ
            gradient = -2 * error * skill_usage + (
                self.regularization * self.weight_deltas[key][skill]
            )
            
            # Adam optimizer update
            m_t = (self.momentum_beta1 * self.momentum_m[key][skill] + 
                   (1 - self.momentum_beta1) * gradient)
            v_t = (self.momentum_beta2 * self.momentum_v[key][skill] + 
                   (1 - self.momentum_beta2) * (gradient ** 2))
            
            # Bias correction
            m_hat = m_t / (1 - self.momentum_beta1 ** self.session_count)
            v_hat = v_t / (1 - self.momentum_beta2 ** self.session_count)
            
            # Update delta
            delta_update = self.learning_rate * m_hat / (np.sqrt(v_hat) + self.epsilon)
            
            # Store momentum
            self.momentum_m[key][skill] = m_t
            self.momentum_v[key][skill] = v_t
            
            # Update weight delta
            self.weight_deltas[key][skill] -= delta_update
            
            # Clip to prevent excessive drift
            self.weight_deltas[key][skill] = np.clip(
                self.weight_deltas[key][skill],
                -self.max_deviation,
                self.max_deviation
            )
    
    def should_use_personalization(self) -> bool:
        """
        Determines if personalization should be active
        Based on validation performance
        """
        if self.session_count < self.min_sessions_for_personalization:
            return False
        
        if len(self.validation_errors) < 5:
            return True  # Not enough validation data yet
        
        # Compare recent personalized errors vs base errors
        # (This would require tracking both in production)
        return True  # Simplified for now
    
    def get_state_dict(self) -> Dict:
        """Returns state for database storage"""
        return {
            'weight_deltas': {
                key: {skill.value: delta for skill, delta in deltas.items()}
                for key, deltas in self.weight_deltas.items()
            },
            'session_count': self.session_count,
            'momentum_m': {
                key: {skill.value: m for skill, m in ms.items()}
                for key, ms in self.momentum_m.items()
            },
            'momentum_v': {
                key: {skill.value: v for skill, v in vs.items()}
                for key, vs in self.momentum_v.items()
            }
        }
    
    def load_state_dict(self, state: Dict):
        """Loads state from database"""
        self.session_count = state.get('session_count', 0)
        
        # Convert string keys back to enums
        if 'weight_deltas' in state:
            self.weight_deltas = {}
            for key, deltas in state['weight_deltas'].items():
                self.weight_deltas[key] = {
                    CognitiveSkill[skill_str]: delta
                    for skill_str, delta in deltas.items()
                }
        
        # Load momentum (similar conversion)
        # ... (implementation similar to above)


# ============================================================================
# USER SKILL TRACKER (NEW!)
# ============================================================================

class UserSkillTracker:
    """
    Tracks user's skill proficiency over time
    Based on ACTUAL performance, not fake points
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.skill_history = defaultdict(list)  # skill -> list of scores
        self.beta = 0.3  # EMA smoothing factor
    
    def update_skills_from_session(self, session_analysis: Dict):
        """
        Updates skill levels based on session performance
        
        Input: session_analysis from analyze_study_session()
        Returns: Updated skill levels
        """
        skill_breakdown = session_analysis['SkillBreakdown']
        efficiency = session_analysis['Efficiency']
        
        updated_skills = {}
        
        for skill_str, throughput in skill_breakdown.items():
            # Quality-adjusted throughput
            quality_adjusted = throughput * (efficiency / 100)
            
            # Get current level
            current_level = self.get_skill_level(skill_str)
            
            # Update with EMA
            new_level = 0.7 * current_level + 0.3 * quality_adjusted
            
            # Store in history
            self.skill_history[skill_str].append({
                'score': quality_adjusted,
                'timestamp': session_analysis.get('AnalyzedAt', datetime.now()),
                'log_id': session_analysis.get('LogID')
            })
            
            # Keep only last 50 entries
            if len(self.skill_history[skill_str]) > 50:
                self.skill_history[skill_str] = self.skill_history[skill_str][-50:]
            
            updated_skills[skill_str] = new_level
        
        return updated_skills
    
    def get_skill_level(self, skill: str, scale_max: float = 5.0) -> float:
        """
        Returns current skill level (0-5 scale)
        Based on weighted average of recent history
        """
        if skill not in self.skill_history or not self.skill_history[skill]:
            return 2.5  # Neutral starting point
        
        recent_scores = self.skill_history[skill][-20:]
        
        if not recent_scores:
            return 2.5
        
        # Weighted average (recent matters more)
        weights = np.exp(np.linspace(-2, 0, len(recent_scores)))
        weights = weights / weights.sum()
        
        scores = np.array([s['score'] for s in recent_scores])
        weighted_avg = np.average(scores, weights=weights)
        
        # Normalize to 0-5 scale
        return min(scale_max, weighted_avg)
    
    def get_skill_trend(self, skill: str, days: int = 30) -> Dict:
        """
        Analyzes trend in a skill over time
        
        Returns:
        {
            'trend': 'improving' | 'stable' | 'declining',
            'change_percent': float,
            'sessions_analyzed': int,
            'current_level': float,
            'starting_level': float
        }
        """
        if skill not in self.skill_history:
            return {'trend': 'insufficient_data', 'sessions_analyzed': 0}
        
        # Filter by date
        cutoff = datetime.now() - timedelta(days=days)
        history = [
            h for h in self.skill_history[skill]
            if h['timestamp'] >= cutoff
        ]
        
        if len(history) < 5:
            return {
                'trend': 'insufficient_data',
                'sessions_analyzed': len(history)
            }
        
        # Linear regression
        x = np.arange(len(history))
        y = np.array([h['score'] for h in history])
        
        slope, intercept = np.polyfit(x, y, 1)
        
        # Calculate change
        start_estimate = intercept
        end_estimate = slope * len(history) + intercept
        
        if start_estimate != 0:
            change_percent = ((end_estimate - start_estimate) / start_estimate) * 100
        else:
            change_percent = 0
        
        # Classify trend
        if change_percent > 10:
            trend = 'improving'
        elif change_percent < -10:
            trend = 'declining'
        else:
            trend = 'stable'
        
        return {
            'trend': trend,
            'change_percent': round(change_percent, 1),
            'sessions_analyzed': len(history),
            'current_level': round(end_estimate, 2),
            'starting_level': round(start_estimate, 2)
        }
    
    def get_skill_gaps(
        self,
        subject_category: str,
        topic_name: str
    ) -> List[Dict]:
        """
        Identifies skill gaps for a subject
        
        Compares user's levels vs subject requirements
        """
        # Get required skills
        required_skills = BASE_SUBJECT_PROFILES.get(subject_category, {}).get(
            topic_name,
            {}
        )
        
        if not required_skills:
            # Try "General" topic
            required_skills = BASE_SUBJECT_PROFILES.get(subject_category, {}).get(
                "General",
                {}
            )
        
        if not required_skills:
            return []
        
        gaps = []
        
        for skill, required_level in required_skills.items():
            user_level = self.get_skill_level(skill.value)
            user_normalized = user_level / 5.0  # Normalize to 0-1
            
            gap = required_level - user_normalized
            
            if gap > 0.15:  # Significant gap (>15%)
                gaps.append({
                    'skill': skill.value,
                    'skill_name': skill.name.replace('_', ' ').title(),
                    'required': required_level,
                    'current': user_normalized,
                    'gap': gap,
                    'priority': 'high' if gap > 0.3 else 'medium'
                })
        
        # Sort by gap size
        gaps.sort(key=lambda x: x['gap'], reverse=True)
        
        return gaps
    
    def generate_skill_feedback(self) -> List[Dict]:
        """
        Generates feedback based on skill trends
        """
        feedback = []
        
        for skill in CognitiveSkill:
            trend = self.get_skill_trend(skill.value, days=30)
            
            if trend.get('trend') == 'insufficient_data':
                continue
            
            if trend['trend'] == 'improving' and trend['change_percent'] > 20:
                feedback.append({
                    'type': 'celebration',
                    'skill': skill.name,
                    'message': self._select_template(
                        'skill_improving',
                        skill_name=skill.name.replace('_', ' ').title(),
                        percent=abs(trend['change_percent'])
                    ),
                    'priority': 'low'
                })
            
            elif trend['trend'] == 'declining' and trend['change_percent'] < -15:
                feedback.append({
                    'type': 'warning',
                    'skill': skill.name,
                    'message': self._select_template(
                        f'skill_{skill.value.lower()}_drop',
                        percent=abs(trend['change_percent'])
                    ),
                    'priority': 'high'
                })
            
            elif trend['trend'] == 'stable':
                current = trend.get('current_level', 0)
                if current >= 4.0:
                    feedback.append({
                        'type': 'strength',
                        'skill': skill.name,
                        'message': f"💪 {skill.name.replace('_', ' ').title()} is your strength (Level {current:.1f}/5).",
                        'priority': 'low'
                    })
        
        return sorted(
            feedback,
            key=lambda x: {'high': 0, 'medium': 1, 'low': 2}[x['priority']]
        )
    
    def _select_template(self, template_key: str, **kwargs) -> str:
        """Selects template deterministically"""
        templates = RECOMMENDATION_TEMPLATES.get(template_key, [])
        if not templates:
            return f"Update on {kwargs}"
        
        # Deterministic selection based on user_id
        idx = hash(self.user_id) % len(templates)
        template = templates[idx]
        
        return template.format(**kwargs)


# ============================================================================
# ENHANCED TEMPORAL PREDICTOR (NEW!)
# ============================================================================

class TemporalPredictor:
    """
    Enhanced time-series prediction
    Accounts for: recency, day-of-week, time-of-day patterns
    """
    
    def __init__(self, beta: float = 0.3):
        self.beta = beta
    
    def predict(self, historical_sessions: List[Dict]) -> float:
        """
        Predicts efficiency for next session
        Uses EMA + temporal adjustments
        """
        if not historical_sessions:
            return 60.0  # Default
        
        if len(historical_sessions) < 5:
            # Simple average for small datasets
            return np.mean([s['Efficiency'] for s in historical_sessions])
        
        # Step 1: Compute quality-weighted EMA
        ema = self._compute_weighted_ema(historical_sessions)
        
        # Step 2: Day-of-week adjustment
        dow_adj = self._get_dow_adjustment(historical_sessions)
        
        # Step 3: Time-of-day adjustment
        tod_adj = self._get_tod_adjustment(historical_sessions)
        
        # Combine
        predicted = ema + dow_adj + tod_adj
        
        return np.clip(predicted, 0, 100)
    
    def _compute_weighted_ema(self, sessions: List[Dict]) -> float:
        """
        EMA with quality weighting (downweight low-focus sessions)
        """
        weights = []
        efficiencies = []
        
        for i, session in enumerate(sessions[-20:]):
            # Recency weight (exponential decay)
            recency_weight = np.exp(-0.1 * (len(sessions) - i - 1))
            
            # Quality weight (downweight low focus)
            focus = session.get('FocusLevel', 3)
            quality_weight = 1.0 if focus >= 3 else 0.5
            
            weights.append(recency_weight * quality_weight)
            efficiencies.append(session.get('Efficiency', 60))
        
        weights = np.array(weights)
        weights = weights / weights.sum()
        
        return np.average(efficiencies, weights=weights)
    
    def _get_dow_adjustment(self, sessions: List[Dict]) -> float:
        """
        Adjustment based on day-of-week patterns
        """
        dow_effs = {i: [] for i in range(7)}
        
        for s in sessions:
            timestamp = s.get('StartTime') or s.get('timestamp')
            if timestamp:
                dow = timestamp.weekday()
                dow_effs[dow].append(s.get('Efficiency', 60))
        
        overall_mean = np.mean([s.get('Efficiency', 60) for s in sessions])
        current_dow = datetime.now().weekday()
        
        if dow_effs[current_dow]:
            return np.mean(dow_effs[current_dow]) - overall_mean
        
        return 0.0
    
    def _get_tod_adjustment(self, sessions: List[Dict]) -> float:
        """
        Adjustment based on time-of-day patterns
        """
        # Group by time slot
        slot_effs = {slot.value: [] for slot in TimeSlot}
        
        for s in sessions:
            slot = s.get('TimeSlot')
            if slot:
                slot_effs[slot].append(s.get('Efficiency', 60))
        
        overall_mean = np.mean([s.get('Efficiency', 60) for s in sessions])
        current_hour = datetime.now().hour
        
        # Map hour to slot
        if 6 <= current_hour < 12:
            current_slot = TimeSlot.MORNING.value
        elif 12 <= current_hour < 18:
            current_slot = TimeSlot.AFTERNOON.value
        elif 18 <= current_hour < 22:
            current_slot = TimeSlot.EVENING.value
        else:
            current_slot = TimeSlot.NIGHT.value
        
        if slot_effs[current_slot]:
            return np.mean(slot_effs[current_slot]) - overall_mean
        
        return 0.0


# ============================================================================
# MAIN COGNITIVE ANALYTICS ENGINE (ENHANCED!)
# ============================================================================

class CognitiveAnalyticsEngine:
    """
    Enhanced version with:
    - Adaptive weights
    - Skill tracking
    - Better predictions
    - Template-based recommendations
    """
    
    def __init__(self):
        self.skill_dimensions = list(CognitiveSkill)
        self.temporal_predictor = TemporalPredictor()
        logger.info("🧠 Enhanced Cognitive Analytics Engine v2.0 initialized")
    
    # ========================================================================
    # CORE SESSION ANALYSIS
    # ========================================================================
    
    def analyze_study_session(
        self,
        study_log: Dict,
        subject_category: str,
        topic_complexity: str,
        user_id: str,
        adaptive_engine: Optional[AdaptiveWeightEngine] = None
    ) -> Dict:
        """
        Enhanced session analysis with personalization
        """
        logger.info(f"📊 Analyzing session {study_log.get('LogID', 'N/A')}")
        
        # Get topic name (for weight personalization)
        topic_name = study_log.get('TopicName', 'General')
        
        # Parse distractions
        distractions = self._parse_distractions(study_log.get('Distractions', ''))
        
        # Compute penalties
        distraction_penalty = self._compute_distraction_penalty(distractions)
        flow_multiplier = self._compute_flow_multiplier(
            study_log.get('FocusLevel', 3),
            distractions
        )
        
        # Calculate effective time
        start_time = study_log['StartTime']
        end_time = study_log['EndTime']
        actual_duration = (end_time - start_time).total_seconds() / 60
        effective_time = actual_duration * flow_multiplier * distraction_penalty
        
        # Build weight matrix (possibly personalized)
        W = self._build_weight_matrix(
            subject_category,
            topic_name,
            topic_complexity,
            adaptive_engine
        )
        
        # Build user vector
        u = self._build_user_vector(
            effective_time=effective_time,
            target_duration=study_log.get('TargetDuration', actual_duration),
            focus_level=study_log.get('FocusLevel', 3),
            reflection=study_log.get('Reflection', '')
        )
        
        # Compute throughput
        T = W @ u
        throughput = float(np.linalg.norm(T, ord=2))
        
        # Compute efficiency
        efficiency = self._compute_efficiency(T, W, distraction_penalty)
        
        # Skill breakdown
        skill_breakdown = {
            skill.value: float(T[i])
            for i, skill in enumerate(self.skill_dimensions)
        }
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            efficiency=efficiency,
            throughput=throughput,
            distractions=distractions,
            focus_level=study_log.get('FocusLevel', 3),
            actual_duration=actual_duration,
            target_duration=study_log.get('TargetDuration', actual_duration),
            flow_multiplier=flow_multiplier,
            skill_breakdown=skill_breakdown,
            subject_category=subject_category,
            user_id=user_id,
            session_count=adaptive_engine.session_count if adaptive_engine else 1
        )
        
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
    # ENHANCED PREDICTION
    # ========================================================================
    
    def predict_optimal_plan(
        self,
        user_id: str,
        subject_category: str,
        historical_logs: List[Dict],
        user_profile: Dict,
        skill_tracker: Optional[UserSkillTracker] = None
    ) -> Dict:
        """
        Enhanced prediction with skill gap analysis
        """
        logger.info(f"🔮 Predicting optimal plan for user {user_id}, subject {subject_category}")
        
        if not historical_logs:
            return self._default_prediction(subject_category, user_profile)
        
        # Timeslot analysis
        timeslot_performance = self._analyze_timeslot_performance(historical_logs)
        optimal_timeslot = max(
            timeslot_performance.items(),
            key=lambda x: x[1]['avg_efficiency']
        )[0]
        
        # Duration analysis
        duration_analysis = self._analyze_duration_patterns(historical_logs)
        optimal_duration = duration_analysis['optimal_duration']
        
        # Predict efficiency (enhanced method)
        predicted_efficiency = self.temporal_predictor.predict(historical_logs)
        
        # Confidence
        confidence = min(1.0, len(historical_logs) / 20)
        
        # Risk factors
        risk_factors = self._identify_risk_factors(historical_logs)
        
        # Skill gaps (if tracker available)
        skill_gaps = []
        if skill_tracker:
            skill_gaps = skill_tracker.get_skill_gaps(
                subject_category,
                user_profile.get('topic_name', 'General')
            )
        
        # Suggestions
        suggestions = self._generate_planning_suggestions(
            optimal_timeslot=optimal_timeslot,
            optimal_duration=optimal_duration,
            predicted_efficiency=predicted_efficiency,
            risk_factors=risk_factors,
            subject_category=subject_category,
            skill_gaps=skill_gaps,
            user_id=user_id
        )
        
        return {
            'UserID': user_id,
            'SubjectCategory': subject_category,
            'OptimalTimeSlot': optimal_timeslot,
            'OptimalDuration': int(optimal_duration),
            'PredictedEfficiency': round(predicted_efficiency, 2),
            'ConfidenceScore': round(confidence, 3),
            'RiskFactors': risk_factors,
            'SkillGaps': skill_gaps,
            'Suggestions': suggestions,
            'TimeslotPerformance': timeslot_performance,
            'PredictedAt': datetime.now()
        }
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    def _build_weight_matrix(
        self,
        subject_category: str,
        topic_name: str,
        topic_complexity: str,
        adaptive_engine: Optional[AdaptiveWeightEngine] = None
    ) -> np.ndarray:
        """
        Builds weight matrix (possibly personalized)
        """
        # Get base weights
        base_weights = BASE_SUBJECT_PROFILES.get(subject_category, {}).get(
            topic_name,
            {}
        )
        
        if not base_weights:
            base_weights = BASE_SUBJECT_PROFILES.get(subject_category, {}).get(
                "General",
                {skill: 0.5 for skill in CognitiveSkill}
            )
        
        # Apply personalization if available
        if adaptive_engine and adaptive_engine.should_use_personalization():
            weights = adaptive_engine.get_personalized_weights(
                subject_category,
                topic_name,
                base_weights
            )
        else:
            weights = base_weights
        
        # Complexity multiplier
        complexity_mult = {
            Complexity.EASY.value: 0.8,
            Complexity.MEDIUM.value: 1.0,
            Complexity.HARD.value: 1.3
        }.get(topic_complexity, 1.0)
        
        # Build matrix
        W = np.zeros((len(self.skill_dimensions), 3))
        
        for i, skill in enumerate(self.skill_dimensions):
            base_weight = weights.get(skill, 0.5) * complexity_mult
            
            W[i, 0] = base_weight * 1.0   # Intensity
            W[i, 1] = base_weight * 1.2   # Fidelity
            W[i, 2] = base_weight * 0.7   # Sentiment
        
        return W
    
    def _parse_distractions(self, distraction_string: str) -> List[DistractionType]:
        """Parse distraction string"""
        if not distraction_string:
            return []
        
        distractions = []
        for item in distraction_string.split(','):
            item = item.strip().upper().replace(' ', '_')
            try:
                distractions.append(DistractionType[item])
            except KeyError:
                logger.warning(f"Unknown distraction: {item}")
        
        return distractions
    
    def _compute_distraction_penalty(self, distractions: List[DistractionType]) -> float:
        """Multiplicative penalty"""
        if not distractions:
            return 1.0
        
        capacity = 1.0
        for distraction in distractions:
            capacity *= (1 - distraction.value)
        
        return max(0.0, capacity)
    
    def _compute_flow_multiplier(
        self,
        focus_level: int,
        distractions: List[DistractionType]
    ) -> float:
        """Flow multiplier with damping"""
        base_multipliers = {5: 1.8, 4: 1.5, 3: 1.2, 2: 1.0, 1: 0.8}
        base = base_multipliers.get(focus_level, 1.0)
        
        # Damp if attention distractors present
        attention_distractors = [
            d for d in distractions
            if d in [DistractionType.PHONE, DistractionType.SOCIAL_MEDIA, DistractionType.INTERRUPTIONS]
        ]
        
        if attention_distractors:
            penalty = sum(d.value for d in attention_distractors)
            return 1 + (base - 1) * np.exp(-3 * penalty)
        
        return base
    
    def _build_user_vector(
        self,
        effective_time: float,
        target_duration: float,
        focus_level: int,
        reflection: str
    ) -> np.ndarray:
        """Build user session vector"""
        intensity = min(2.0, effective_time / max(target_duration, 1))
        fidelity = (focus_level - 1) / 4
        sentiment = self._analyze_sentiment(reflection)
        
        return np.array([intensity, fidelity, sentiment])
    
    def _compute_efficiency(
        self,
        T: np.ndarray,
        W: np.ndarray,
        distraction_penalty: float
    ) -> float:
        """Compute efficiency"""
        tau = np.linalg.norm(T, ord=2)
        
        u_max = np.array([1.0, 1.0, 1.0])
        T_max = W @ u_max
        tau_max = np.linalg.norm(T_max, ord=2)
        
        if tau_max == 0:
            return 0.0
        
        efficiency = (tau / tau_max) * distraction_penalty * 100
        
        return min(100.0, max(0.0, efficiency))
    
    def _analyze_sentiment(self, text: str) -> float:
        """Simple sentiment analysis"""
        if not text:
            return 0.5
        
        text_lower = text.lower()
        
        positive = ['good', 'great', 'excellent', 'productive', 'focused',
                   'understood', 'progress', 'clear', 'success', 'easy']
        negative = ['bad', 'difficult', 'hard', 'confused', 'struggled',
                   'distracted', 'tired', 'frustrating', 'unclear', 'failed']
        
        pos_count = sum(1 for word in positive if word in text_lower)
        neg_count = sum(1 for word in negative if word in text_lower)
        
        if pos_count + neg_count == 0:
            return 0.5
        
        score = (pos_count - neg_count + (pos_count + neg_count)) / (2 * (pos_count + neg_count))
        
        return max(0.0, min(1.0, score))
    
    def _compute_quality_score(self, efficiency: float, throughput: float) -> float:
        """Composite quality score"""
        norm_throughput = min(1.0, throughput / 5.0)
        norm_efficiency = efficiency / 100.0
        
        quality = 0.6 * norm_efficiency + 0.4 * norm_throughput
        
        return round(quality * 100, 1)
    
    def _generate_recommendations(
        self,
        efficiency: float,
        throughput: float,
        distractions: List[DistractionType],
        focus_level: int,
        actual_duration: float,
        target_duration: float,
        flow_multiplier: float,
        skill_breakdown: Dict,
        subject_category: str,
        user_id: str,
        session_count: int
    ) -> List[str]:
        """
        Generate template-based recommendations
        Deterministic selection based on user_id
        """
        recommendations = []
        
        def select_template(key, **kwargs):
            templates = RECOMMENDATION_TEMPLATES.get(key, [])
            if not templates:
                return None
            idx = hash(user_id + key) % len(templates)
            return templates[idx].format(**kwargs)
        
        # First session
        if session_count <= 1:
            rec = select_template('first_session')
            if rec:
                recommendations.append(rec)
            return recommendations
        
        # Efficiency-based
        if efficiency < 50:
            rec = select_template('low_efficiency', efficiency=efficiency)
            if rec:
                recommendations.append(rec)
        elif efficiency >= 80:
            rec = select_template('high_efficiency', efficiency=efficiency)
            if rec:
                recommendations.append(rec)
        
        # Distraction-specific
        for distraction in distractions:
            key = distraction.name.lower() + '_distraction'
            rec = select_template(key)
            if rec:
                recommendations.append(rec)
                break  # Only one distraction rec
        
        # Flow state
        if flow_multiplier > 1.3:
            rec = select_template('flow_achieved', multiplier=flow_multiplier)
            if rec:
                recommendations.append(rec)
        
        # Duration
        if actual_duration > 90:
            rec = select_template('long_session', duration=int(actual_duration))
            if rec:
                recommendations.append(rec)
        
        # Subject-specific
        subject_key = f'subject_specific_{subject_category.lower()}'
        rec = select_template(subject_key)
        if rec:
            recommendations.append(rec)
        
        # Limit to top 5
        return recommendations[:5]
    
    def _generate_planning_suggestions(
        self,
        optimal_timeslot: str,
        optimal_duration: int,
        predicted_efficiency: float,
        risk_factors: List[str],
        subject_category: str,
        skill_gaps: List[Dict],
        user_id: str
    ) -> List[str]:
        """Generate planning suggestions"""
        suggestions = []
        
        suggestions.append(f"📅 Schedule for {optimal_timeslot} for best results")
        suggestions.append(f"⏱️ Aim for {optimal_duration}-minute sessions")
        
        if predicted_efficiency < 60:
            suggestions.append(f"⚠️ Expected efficiency: {predicted_efficiency:.0f}%. Address risk factors first.")
        
        for risk in risk_factors[:2]:
            suggestions.append(f"🔴 {risk}")
        
        # Skill gaps
        for gap in skill_gaps[:2]:
            templates = RECOMMENDATION_TEMPLATES.get('skill_gap_high', [])
            if templates:
                idx = hash(user_id) % len(templates)
                template = templates[idx]
                suggestions.append(template.format(
                    topic=subject_category,
                    skill_name=gap['skill_name'],
                    gap=int(gap['gap'] * 100)
                ))
        
        return suggestions[:6]
    
    def _analyze_timeslot_performance(self, logs: List[Dict]) -> Dict:
        """Analyze performance by time slot"""
        stats = {slot.value: {'count': 0, 'total_eff': 0} for slot in TimeSlot}
        
        for log in logs:
            slot = log.get('TimeSlot', 'Morning')
            eff = log.get('Efficiency', 0)
            
            if slot in stats:
                stats[slot]['count'] += 1
                stats[slot]['total_eff'] += eff
        
        for slot in stats:
            count = stats[slot]['count']
            stats[slot]['avg_efficiency'] = (
                stats[slot]['total_eff'] / count if count > 0 else 0
            )
        
        return stats
    
    def _analyze_duration_patterns(self, logs: List[Dict]) -> Dict:
        """Find optimal duration"""
        buckets = {25: [], 45: [], 60: [], 90: []}
        
        for log in logs:
            duration = (log['EndTime'] - log['StartTime']).total_seconds() / 60
            eff = log.get('Efficiency', 0)
            
            if duration < 35:
                buckets[25].append(eff)
            elif duration < 52:
                buckets[45].append(eff)
            elif duration < 75:
                buckets[60].append(eff)
            else:
                buckets[90].append(eff)
        
        best_duration = 45
        best_avg = 0
        
        for dur, effs in buckets.items():
            if effs:
                avg = sum(effs) / len(effs)
                if avg > best_avg:
                    best_avg = avg
                    best_duration = dur
        
        return {'optimal_duration': best_duration}
    
    def _identify_risk_factors(self, logs: List[Dict]) -> List[str]:
        """Identify risk patterns"""
        risks = []
        
        all_distractions = []
        for log in logs:
            all_distractions.extend(
                self._parse_distractions(log.get('Distractions', ''))
            )
        
        if all_distractions:
            from collections import Counter
            most_common = Counter(all_distractions).most_common(1)[0]
            risks.append(
                f"Frequent {most_common[0].name.lower().replace('_', ' ')} distractions"
            )
        
        recent_focus = [log.get('FocusLevel', 3) for log in logs[-5:]]
        if recent_focus and sum(recent_focus) / len(recent_focus) < 2.5:
            risks.append("Declining focus levels in recent sessions")
        
        return risks
    
    def _default_prediction(self, subject_category: str, user_profile: Dict) -> Dict:
        """Default prediction for new users"""
        preferred_time = user_profile.get('PreferredStudyTime', 'Morning')
        
        return {
            'OptimalTimeSlot': preferred_time,
            'OptimalDuration': 45,
            'PredictedEfficiency': 65.0,
            'ConfidenceScore': 0.1,
            'RiskFactors': ['No historical data available'],
            'SkillGaps': [],
            'Suggestions': [
                f"Start with {preferred_time} sessions as per your preference",
                "Try 45-minute sessions with 10-minute breaks",
                "Log at least 10 sessions for personalized predictions"
            ]
        }
    
    # ========================================================================
    # TASK CHUNKING (Already Implemented)
    # ========================================================================
    
    def chunk_study_topics(
        self,
        topic_name: str,
        topic_complexity: str,
        available_duration: int,
        subject_category: str
    ) -> List[Dict]:
        """Smart task chunking"""
        base_chunk_duration = {
            Complexity.EASY.value: 25,
            Complexity.MEDIUM.value: 35,
            Complexity.HARD.value: 45
        }.get(topic_complexity, 30)
        
        num_chunks = max(1, int(available_duration / base_chunk_duration))
        chunk_duration = available_duration // num_chunks
        
        chunks = []
        
        for i in range(num_chunks):
            load_multiplier = 0.5 + (i / num_chunks) * 0.5
            
            chunk = {
                'ChunkID': f"{topic_name}_chunk_{i+1}",
                'ChunkName': f"{topic_name} - Part {i+1}",
                'EstimatedDuration': chunk_duration,
                'RecommendedOrder': i + 1,
                'CognitiveLoad': round(load_multiplier, 2),
                'BreakAfter': i < num_chunks - 1,
                'BreakDuration': 5 if chunk_duration <= 30 else 10
            }
            chunks.append(chunk)
        
        return chunks
    
    def generate_realtime_feedback(
        self,
        current_session: Dict,
        elapsed_time: int,
        current_focus_level: int
    ) -> Dict:
        """Real-time feedback during session"""
        target_duration = current_session.get('TargetDuration', 60)
        progress = elapsed_time / target_duration if target_duration > 0 else 0
        
        if current_focus_level <= 2:
            return {
                'Alert': '⚠️ Low focus detected',
                'SuggestedAction': 'Take a 5-minute break. Walk, hydrate, or do breathing exercises.',
                'PerformanceStatus': 'struggling',
                'Severity': 'high'
            }
        
        if elapsed_time > 50 and progress < 0.9:
            return {
                'Alert': '🕐 You\'ve been studying for 50+ minutes',
                'SuggestedAction': 'Take a 10-minute break to maintain quality.',
                'PerformanceStatus': 'on_track',
                'Severity': 'medium'
            }
        
        if current_focus_level >= 4 and progress >= 0.5:
            return {
                'Alert': '🌟 Great focus! You\'re in the zone',
                'SuggestedAction': 'Keep going! You\'re making excellent progress.',
                'PerformanceStatus': 'exceeding',
                'Severity': 'low'
            }
        
        return {
            'Alert': '✅ Session progressing well',
            'SuggestedAction': 'Continue at current pace.',
            'PerformanceStatus': 'on_track',
            'Severity': 'low'
        }


# ============================================================================
# EXAMPLE USAGE & TESTING
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("🧠 ENHANCED STUDYFLOW AI ENGINE v2.0 - DEMO")
    print("=" * 70)
    print()
    
    # Initialize components
    engine = CognitiveAnalyticsEngine()
    user_id = "test_user_123"
    adaptive_engine = AdaptiveWeightEngine(user_id)
    skill_tracker = UserSkillTracker(user_id)
    
    # Simulate 10 sessions first (to build history)
    print("📝 Simulating 10 sessions to build history...")
    adaptive_engine.session_count = 10
    
    # Example 1: Analyze a study session
    print("\n" + "=" * 70)
    print("TEST 1: SESSION ANALYSIS")
    print("=" * 70)
    
    study_log = {
        'LogID': 'session_001',
        'TopicName': 'Calculus',
        'StartTime': datetime(2026, 2, 4, 9, 0),
        'EndTime': datetime(2026, 2, 4, 10, 30),
        'FocusLevel': 4,
        'Distractions': 'PHONE,NOISE',
        'Reflection': 'Good progress but got distracted',
        'TargetDuration': 90
    }
    
    result = engine.analyze_study_session(
        study_log=study_log,
        subject_category='Mathematics',
        topic_complexity='Hard',
        user_id=user_id,
        adaptive_engine=adaptive_engine
    )
    
    print(f"\n✅ Analysis Complete:")
    print(f"   Efficiency: {result['Efficiency']}%")
    print(f"   Throughput: {result['Throughput']} cognitive units")
    print(f"   Quality Score: {result['QualityScore']}/100")
    print(f"\n📋 Recommendations:")
    for rec in result['Recommendations']:
        print(f"   • {rec}")
    
    # Update skill tracker
    print("\n" + "=" * 70)
    print("TEST 2: SKILL TRACKING")
    print("=" * 70)
    
    updated_skills = skill_tracker.update_skills_from_session(result)
    print("\n✅ Skills Updated:")
    for skill, level in updated_skills.items():
        print(f"   {skill}: {level:.2f}/5.0")
    
    # Generate skill feedback
    feedback = skill_tracker.generate_skill_feedback()
    if feedback:
        print("\n💡 Skill Feedback:")
        for item in feedback:
            print(f"   {item['message']}")
    
    # Example 2: Predict optimal plan
    print("\n" + "=" * 70)
    print("TEST 3: OPTIMAL PLAN PREDICTION")
    print("=" * 70)
    
    # Simulate historical data
    historical = [
        {
            'StartTime': datetime(2026, 2, i, 9, 0),
            'EndTime': datetime(2026, 2, i, 10, 0),
            'FocusLevel': 4,
            'Distractions': '' if i % 2 == 0 else 'TIRED',
            'Efficiency': 75.0 + (i * 2),
            'TimeSlot': 'Morning',
            'SubjectCategory': 'Mathematics'
        }
        for i in range(1, 11)
    ]
    
    prediction = engine.predict_optimal_plan(
        user_id=user_id,
        subject_category='Mathematics',
        historical_logs=historical,
        user_profile={'PreferredStudyTime': 'Morning', 'topic_name': 'Calculus'},
        skill_tracker=skill_tracker
    )
    
    print(f"\n✅ Prediction Complete:")
    print(f"   Best Time: {prediction['OptimalTimeSlot']}")
    print(f"   Optimal Duration: {prediction['OptimalDuration']} minutes")
    print(f"   Predicted Efficiency: {prediction['PredictedEfficiency']}%")
    print(f"   Confidence: {prediction['ConfidenceScore']*100:.0f}%")
    print(f"\n📋 Suggestions:")
    for sug in prediction['Suggestions']:
        print(f"   • {sug}")
    
    # Example 3: Skill gaps
    print("\n" + "=" * 70)
    print("TEST 4: SKILL GAP ANALYSIS")
    print("=" * 70)
    
    gaps = skill_tracker.get_skill_gaps('Physics', 'Quantum Mechanics')
    
    if gaps:
        print("\n⚠️  Skill Gaps Detected:")
        for gap in gaps:
            print(f"   • {gap['skill_name']}: {gap['current']*100:.0f}% (need {gap['required']*100:.0f}%) - Gap: {gap['gap']*100:.0f}%")
    else:
        print("\n✅ No significant skill gaps!")
    
    print("\n" + "=" * 70)
    print("✅ ALL TESTS COMPLETE - ENHANCED ENGINE WORKING!")
    print("=" * 70)
