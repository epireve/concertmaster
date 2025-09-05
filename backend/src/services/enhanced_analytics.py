"""
Enhanced Analytics Service for Form System
Advanced analytics with field-level metrics, conversion funnels, and performance insights.
"""

import uuid
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
from enum import Enum
from dataclasses import dataclass
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from ..models.forms import FormSchema, FormResponse, FormAnalytics
from ..database.connection import get_db_session

logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    """Types of analytics metrics"""
    CONVERSION = "conversion"
    PERFORMANCE = "performance"
    ENGAGEMENT = "engagement"
    QUALITY = "quality"


@dataclass
class FieldMetrics:
    """Field-level analytics metrics"""
    field_id: str
    field_name: str
    field_type: str
    completion_rate: float
    error_rate: float
    average_time_spent: float
    abandonment_rate: float
    common_errors: List[str]
    value_distribution: Dict[str, int]
    engagement_score: float


@dataclass
class ConversionFunnel:
    """Form conversion funnel metrics"""
    form_views: int
    form_starts: int
    field_completions: Dict[str, int]
    form_submissions: int
    conversion_rates: Dict[str, float]
    drop_off_points: List[str]


@dataclass
class PerformanceMetrics:
    """Form performance metrics"""
    average_load_time: float
    average_render_time: float
    average_submission_time: float
    error_rate: float
    timeout_rate: float
    device_performance: Dict[str, Dict[str, float]]


class EnhancedAnalyticsService:
    """Advanced analytics service for form system"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def generate_comprehensive_report(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive analytics report"""
        try:
            # Set default date range (last 30 days)
            if not end_date:
                end_date = datetime.now(timezone.utc)
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Get form schema
            form_schema = await self._get_form_schema(db, form_schema_id)
            if not form_schema:
                raise ValueError(f"Form schema not found: {form_schema_id}")
            
            # Generate all metrics in parallel
            field_metrics = await self._calculate_field_metrics(
                db, form_schema_id, start_date, end_date
            )
            
            conversion_funnel = await self._calculate_conversion_funnel(
                db, form_schema_id, start_date, end_date
            )
            
            performance_metrics = await self._calculate_performance_metrics(
                db, form_schema_id, start_date, end_date
            )
            
            engagement_metrics = await self._calculate_engagement_metrics(
                db, form_schema_id, start_date, end_date
            )
            
            quality_metrics = await self._calculate_quality_metrics(
                db, form_schema_id, start_date, end_date
            )
            
            # Generate insights and recommendations
            insights = await self._generate_insights(
                field_metrics, conversion_funnel, performance_metrics
            )
            
            return {
                "form_schema_id": str(form_schema_id),
                "form_name": form_schema.name,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "field_metrics": [metric.__dict__ for metric in field_metrics],
                "conversion_funnel": conversion_funnel.__dict__,
                "performance_metrics": performance_metrics.__dict__,
                "engagement_metrics": engagement_metrics,
                "quality_metrics": quality_metrics,
                "insights": insights,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"❌ Failed to generate analytics report: {e}")
            raise
    
    async def _calculate_field_metrics(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[FieldMetrics]:
        """Calculate detailed field-level metrics"""
        try:
            # Get form schema for field definitions
            form_schema = await self._get_form_schema(db, form_schema_id)
            
            # Get all responses in date range
            responses = await self._get_responses(db, form_schema_id, start_date, end_date)
            
            field_metrics = []
            
            for field in form_schema.fields:
                field_id = field['id']
                field_name = field['label']
                field_type = field['type']
                
                # Calculate completion rate
                total_responses = len(responses)
                completed_responses = sum(
                    1 for response in responses 
                    if field_id in response.data and response.data[field_id] is not None
                )
                completion_rate = (completed_responses / total_responses * 100) if total_responses > 0 else 0
                
                # Calculate error rate from validation errors
                error_responses = sum(
                    1 for response in responses 
                    if response.validation_errors and any(
                        error.get('field') == field_id for error in response.validation_errors
                    )
                )
                error_rate = (error_responses / total_responses * 100) if total_responses > 0 else 0
                
                # Calculate average time spent (from metadata if available)
                time_spent_values = []
                for response in responses:
                    if (response.metadata and 
                        'field_times' in response.metadata and 
                        field_id in response.metadata['field_times']):
                        time_spent_values.append(response.metadata['field_times'][field_id])
                
                average_time_spent = sum(time_spent_values) / len(time_spent_values) if time_spent_values else 0
                
                # Calculate abandonment rate (responses that stop at this field)
                abandonment_count = 0
                for i, response in enumerate(responses):
                    if field_id in response.data and i < len(responses) - 1:
                        next_fields = [f['id'] for f in form_schema.fields if f['order'] > field['order']]
                        if next_fields and not any(nf in response.data for nf in next_fields):
                            abandonment_count += 1
                
                abandonment_rate = (abandonment_count / total_responses * 100) if total_responses > 0 else 0
                
                # Extract common errors
                common_errors = []
                if error_responses > 0:
                    error_messages = []
                    for response in responses:
                        if response.validation_errors:
                            for error in response.validation_errors:
                                if error.get('field') == field_id:
                                    error_messages.append(error.get('message', 'Unknown error'))
                    
                    # Count error frequency
                    error_counts = defaultdict(int)
                    for msg in error_messages:
                        error_counts[msg] += 1
                    
                    common_errors = sorted(error_counts.keys(), key=error_counts.get, reverse=True)[:3]
                
                # Calculate value distribution
                value_distribution = defaultdict(int)
                for response in responses:
                    if field_id in response.data:
                        value = response.data[field_id]
                        if field_type in ['select', 'radio', 'checkbox']:
                            value_distribution[str(value)] += 1
                        elif field_type == 'number':
                            # Group numeric values into ranges
                            if isinstance(value, (int, float)):
                                range_key = f"{int(value//10)*10}-{int(value//10)*10+9}"
                                value_distribution[range_key] += 1
                
                # Calculate engagement score (combination of completion rate and time spent)
                engagement_score = (completion_rate * 0.7 + 
                                  min(average_time_spent / 60, 5) * 20 * 0.3)  # Max 5 minutes
                
                field_metrics.append(FieldMetrics(
                    field_id=field_id,
                    field_name=field_name,
                    field_type=field_type,
                    completion_rate=completion_rate,
                    error_rate=error_rate,
                    average_time_spent=average_time_spent,
                    abandonment_rate=abandonment_rate,
                    common_errors=common_errors,
                    value_distribution=dict(value_distribution),
                    engagement_score=engagement_score
                ))
            
            return field_metrics
            
        except Exception as e:
            self.logger.error(f"❌ Failed to calculate field metrics: {e}")
            raise
    
    async def _calculate_conversion_funnel(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> ConversionFunnel:
        """Calculate conversion funnel metrics"""
        try:
            # Get form views (would need tracking implementation)
            form_views = await self._get_form_views(db, form_schema_id, start_date, end_date)
            
            # Get form starts (responses with at least one field completed)
            responses = await self._get_responses(db, form_schema_id, start_date, end_date)
            form_starts = len([r for r in responses if r.data])
            
            # Get form submissions (completed responses)
            form_submissions = len([r for r in responses if r.status == 'submitted'])
            
            # Get form schema for field order
            form_schema = await self._get_form_schema(db, form_schema_id)
            
            # Calculate field completion rates
            field_completions = {}
            for field in form_schema.fields:
                field_id = field['id']
                completed = len([
                    r for r in responses 
                    if field_id in r.data and r.data[field_id] is not None
                ])
                field_completions[field['label']] = completed
            
            # Calculate conversion rates
            conversion_rates = {
                'view_to_start': (form_starts / form_views * 100) if form_views > 0 else 0,
                'start_to_submit': (form_submissions / form_starts * 100) if form_starts > 0 else 0,
                'view_to_submit': (form_submissions / form_views * 100) if form_views > 0 else 0
            }
            
            # Identify drop-off points
            drop_off_points = []
            sorted_fields = sorted(form_schema.fields, key=lambda x: x['order'])
            for i, field in enumerate(sorted_fields):
                if i > 0:
                    prev_completion = field_completions.get(sorted_fields[i-1]['label'], 0)
                    curr_completion = field_completions.get(field['label'], 0)
                    if prev_completion > 0:
                        drop_off_rate = (prev_completion - curr_completion) / prev_completion
                        if drop_off_rate > 0.3:  # 30% drop-off threshold
                            drop_off_points.append(field['label'])
            
            return ConversionFunnel(
                form_views=form_views,
                form_starts=form_starts,
                field_completions=field_completions,
                form_submissions=form_submissions,
                conversion_rates=conversion_rates,
                drop_off_points=drop_off_points
            )
            
        except Exception as e:
            self.logger.error(f"❌ Failed to calculate conversion funnel: {e}")
            raise
    
    async def _calculate_performance_metrics(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> PerformanceMetrics:
        """Calculate form performance metrics"""
        try:
            responses = await self._get_responses(db, form_schema_id, start_date, end_date)
            
            # Extract performance data from metadata
            load_times = []
            render_times = []
            submission_times = []
            errors = 0
            timeouts = 0
            device_data = defaultdict(lambda: defaultdict(list))
            
            for response in responses:
                if response.metadata:
                    # Load time
                    if 'load_time' in response.metadata:
                        load_times.append(response.metadata['load_time'])
                    
                    # Render time
                    if 'render_time' in response.metadata:
                        render_times.append(response.metadata['render_time'])
                    
                    # Submission time
                    if response.completion_time_seconds:
                        submission_times.append(response.completion_time_seconds)
                    
                    # Error tracking
                    if not response.is_valid or response.validation_errors:
                        errors += 1
                    
                    # Timeout tracking
                    if response.metadata.get('timed_out', False):
                        timeouts += 1
                    
                    # Device performance
                    device_type = response.metadata.get('device_type', 'unknown')
                    if 'performance' in response.metadata:
                        perf = response.metadata['performance']
                        for metric, value in perf.items():
                            device_data[device_type][metric].append(value)
            
            # Calculate averages
            total_responses = len(responses)
            average_load_time = sum(load_times) / len(load_times) if load_times else 0
            average_render_time = sum(render_times) / len(render_times) if render_times else 0
            average_submission_time = sum(submission_times) / len(submission_times) if submission_times else 0
            error_rate = (errors / total_responses * 100) if total_responses > 0 else 0
            timeout_rate = (timeouts / total_responses * 100) if total_responses > 0 else 0
            
            # Process device performance
            device_performance = {}
            for device, metrics in device_data.items():
                device_performance[device] = {}
                for metric, values in metrics.items():
                    device_performance[device][metric] = sum(values) / len(values) if values else 0
            
            return PerformanceMetrics(
                average_load_time=average_load_time,
                average_render_time=average_render_time,
                average_submission_time=average_submission_time,
                error_rate=error_rate,
                timeout_rate=timeout_rate,
                device_performance=device_performance
            )
            
        except Exception as e:
            self.logger.error(f"❌ Failed to calculate performance metrics: {e}")
            raise
    
    async def _calculate_engagement_metrics(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate user engagement metrics"""
        try:
            responses = await self._get_responses(db, form_schema_id, start_date, end_date)
            
            # Time-based engagement
            completion_times = [r.completion_time_seconds for r in responses if r.completion_time_seconds]
            avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0
            
            # Return patterns
            returning_users = len([
                r for r in responses 
                if r.metadata and r.metadata.get('returning_user', False)
            ])
            
            # Interaction depth
            interaction_scores = []
            for response in responses:
                score = len([v for v in response.data.values() if v is not None])
                interaction_scores.append(score)
            
            avg_interaction_depth = sum(interaction_scores) / len(interaction_scores) if interaction_scores else 0
            
            return {
                "average_completion_time": avg_completion_time,
                "returning_user_rate": (returning_users / len(responses) * 100) if responses else 0,
                "average_interaction_depth": avg_interaction_depth,
                "engagement_distribution": {
                    "high": len([s for s in interaction_scores if s > 7]),
                    "medium": len([s for s in interaction_scores if 3 <= s <= 7]),
                    "low": len([s for s in interaction_scores if s < 3])
                }
            }
            
        except Exception as e:
            self.logger.error(f"❌ Failed to calculate engagement metrics: {e}")
            raise
    
    async def _calculate_quality_metrics(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate data quality metrics"""
        try:
            responses = await self._get_responses(db, form_schema_id, start_date, end_date)
            
            # Data completeness
            total_fields = len((await self._get_form_schema(db, form_schema_id)).fields)
            completeness_scores = []
            
            for response in responses:
                completed_fields = len([v for v in response.data.values() if v is not None])
                completeness_scores.append(completed_fields / total_fields * 100)
            
            # Data accuracy (based on validation errors)
            accurate_responses = len([r for r in responses if r.is_valid])
            accuracy_rate = (accurate_responses / len(responses) * 100) if responses else 0
            
            # Data consistency
            consistency_score = self._calculate_consistency_score(responses)
            
            return {
                "data_completeness_rate": sum(completeness_scores) / len(completeness_scores) if completeness_scores else 0,
                "data_accuracy_rate": accuracy_rate,
                "data_consistency_score": consistency_score,
                "quality_distribution": {
                    "excellent": len([s for s in completeness_scores if s > 90]),
                    "good": len([s for s in completeness_scores if 70 <= s <= 90]),
                    "fair": len([s for s in completeness_scores if 50 <= s < 70]),
                    "poor": len([s for s in completeness_scores if s < 50])
                }
            }
            
        except Exception as e:
            self.logger.error(f"❌ Failed to calculate quality metrics: {e}")
            raise
    
    def _calculate_consistency_score(self, responses: List[FormResponse]) -> float:
        """Calculate data consistency score"""
        if len(responses) < 2:
            return 100.0
        
        # Analyze value patterns for consistency
        field_values = defaultdict(list)
        
        for response in responses:
            for field_id, value in response.data.items():
                if value is not None:
                    field_values[field_id].append(str(value))
        
        consistency_scores = []
        
        for field_id, values in field_values.items():
            if len(values) > 1:
                # Calculate variation coefficient
                unique_values = len(set(values))
                total_values = len(values)
                consistency = (1 - (unique_values - 1) / total_values) * 100
                consistency_scores.append(max(consistency, 0))
        
        return sum(consistency_scores) / len(consistency_scores) if consistency_scores else 100.0
    
    async def _generate_insights(
        self,
        field_metrics: List[FieldMetrics],
        conversion_funnel: ConversionFunnel,
        performance_metrics: PerformanceMetrics
    ) -> List[Dict[str, Any]]:
        """Generate actionable insights from analytics data"""
        insights = []
        
        # Field performance insights
        low_completion_fields = [f for f in field_metrics if f.completion_rate < 70]
        if low_completion_fields:
            insights.append({
                "type": "field_performance",
                "severity": "medium",
                "title": "Low Completion Rate Fields",
                "description": f"{len(low_completion_fields)} fields have completion rates below 70%",
                "recommendation": "Review field labels, help text, and required status",
                "affected_fields": [f.field_name for f in low_completion_fields]
            })
        
        # Conversion insights
        if conversion_funnel.conversion_rates['view_to_submit'] < 20:
            insights.append({
                "type": "conversion",
                "severity": "high",
                "title": "Low Overall Conversion Rate",
                "description": f"Only {conversion_funnel.conversion_rates['view_to_submit']:.1f}% of viewers complete the form",
                "recommendation": "Simplify form design and reduce number of required fields",
                "drop_off_points": conversion_funnel.drop_off_points
            })
        
        # Performance insights
        if performance_metrics.average_load_time > 3000:  # 3 seconds
            insights.append({
                "type": "performance",
                "severity": "high",
                "title": "Slow Form Loading",
                "description": f"Average load time is {performance_metrics.average_load_time/1000:.1f} seconds",
                "recommendation": "Optimize form assets and consider progressive loading",
            })
        
        # Error rate insights
        if performance_metrics.error_rate > 10:
            insights.append({
                "type": "quality",
                "severity": "medium",
                "title": "High Error Rate",
                "description": f"Error rate is {performance_metrics.error_rate:.1f}%",
                "recommendation": "Review validation rules and provide better user guidance",
            })
        
        return insights
    
    async def _get_form_schema(self, db: AsyncSession, form_schema_id: uuid.UUID) -> Optional[FormSchema]:
        """Get form schema by ID"""
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_schema_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_responses(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[FormResponse]:
        """Get form responses in date range"""
        result = await db.execute(
            select(FormResponse)
            .where(FormResponse.form_schema_id == form_schema_id)
            .where(FormResponse.submitted_at >= start_date)
            .where(FormResponse.submitted_at <= end_date)
        )
        return result.scalars().all()
    
    async def _get_form_views(
        self,
        db: AsyncSession,
        form_schema_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> int:
        """Get form view count (placeholder - would need tracking implementation)"""
        # This would require implementing view tracking
        # For now, estimate based on responses
        responses = await self._get_responses(db, form_schema_id, start_date, end_date)
        return max(len(responses) * 3, 100)  # Rough estimate