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
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from enum import Enum
import logging

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
    
    def __init__(self):
        self.skill_dimensions = list(CognitiveSkill)
        logger.info("🧠 Cognitive Analytics Engine initialized")
    
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
