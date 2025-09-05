"""
Form Analytics and Reporting API
Comprehensive analytics endpoints for form performance, user behavior, and insights.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc, text
from sqlalchemy.orm import selectinload

from ..database.connection import get_db_session
from ..models.forms import FormSchema, FormResponse, FormAttachment, FormAnalytics
from ..schemas.form_extended import FormAnalyticsResponse
from ..auth.security import get_current_user, require_permissions
from ..config import settings

router = APIRouter(prefix="/api/v1/form-analytics", tags=["form-analytics"])
logger = logging.getLogger(__name__)


class AnalyticsPeriod(str, Enum):
    """Analytics time period options"""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class MetricType(str, Enum):
    """Available metric types"""
    RESPONSES = "responses"
    VIEWS = "views"
    CONVERSION = "conversion"
    ABANDONMENT = "abandonment"
    COMPLETION_TIME = "completion_time"
    DEVICE_BREAKDOWN = "device_breakdown"
    LOCATION_BREAKDOWN = "location_breakdown"
    FIELD_ANALYTICS = "field_analytics"
    ERROR_RATES = "error_rates"


@router.get("/forms/{form_id}/overview")
async def get_form_analytics_overview(
    form_id: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Get comprehensive form analytics overview"""
    try:
        logger.info(f"Getting analytics overview for form: {form_id}")
        
        # Verify form exists
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        form = result.scalar_one_or_none()
        
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Build base query for responses
        response_query = select(FormResponse).where(
            and_(
                FormResponse.form_schema_id == form_id,
                FormResponse.submitted_at >= start_date,
                FormResponse.submitted_at <= end_date
            )
        )
        
        # Get total responses
        total_responses_result = await db.execute(
            select(func.count(FormResponse.id)).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date
                )
            )
        )
        total_responses = total_responses_result.scalar() or 0
        
        # Get completion rate (assuming you track form views separately)
        # For now, we'll calculate based on responses vs failed validations
        valid_responses_result = await db.execute(
            select(func.count(FormResponse.id)).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date,
                    FormResponse.is_valid == True
                )
            )
        )
        valid_responses = valid_responses_result.scalar() or 0
        completion_rate = (valid_responses / total_responses * 100) if total_responses > 0 else 0
        
        # Get average completion time
        avg_time_result = await db.execute(
            select(func.avg(FormResponse.completion_time_seconds)).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date,
                    FormResponse.completion_time_seconds.is_not(None)
                )
            )
        )
        avg_completion_time = avg_time_result.scalar() or 0
        
        # Get responses by day for trend analysis
        daily_responses = await _get_responses_by_period(
            db, form_id, start_date, end_date, "day"
        )
        
        # Get device breakdown
        device_breakdown = await _get_device_breakdown(
            db, form_id, start_date, end_date
        )
        
        # Get top error fields
        field_errors = await _get_field_error_analytics(
            db, form_id, start_date, end_date
        )
        
        # Get conversion funnel data
        funnel_data = await _get_conversion_funnel(
            db, form_id, start_date, end_date
        )
        
        overview = {
            "form_id": form_id,
            "form_name": form.name,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": (end_date - start_date).days
            },
            "key_metrics": {
                "total_responses": total_responses,
                "valid_responses": valid_responses,
                "completion_rate": round(completion_rate, 2),
                "average_completion_time": round(avg_completion_time, 2),
                "abandonment_rate": round(100 - completion_rate, 2)
            },
            "trends": {
                "daily_responses": daily_responses
            },
            "demographics": {
                "device_breakdown": device_breakdown
            },
            "quality": {
                "field_errors": field_errors,
                "error_rate": round((total_responses - valid_responses) / total_responses * 100, 2) if total_responses > 0 else 0
            },
            "conversion": funnel_data,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        return overview
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get form analytics overview: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/forms/{form_id}/trends")
async def get_form_trends(
    form_id: str,
    period: AnalyticsPeriod = Query(AnalyticsPeriod.DAILY),
    metric: MetricType = Query(MetricType.RESPONSES),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Get form analytics trends over time"""
    try:
        logger.info(f"Getting {metric} trends for form: {form_id}")
        
        # Verify form exists
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        form = result.scalar_one_or_none()
        
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        # Set default date range
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            if period == AnalyticsPeriod.HOURLY:
                start_date = end_date - timedelta(days=7)
            elif period == AnalyticsPeriod.DAILY:
                start_date = end_date - timedelta(days=30)
            elif period == AnalyticsPeriod.WEEKLY:
                start_date = end_date - timedelta(days=90)
            else:  # MONTHLY
                start_date = end_date - timedelta(days=365)
        
        trends_data = {}
        
        if metric == MetricType.RESPONSES:
            trends_data = await _get_responses_by_period(
                db, form_id, start_date, end_date, period.value
            )
        elif metric == MetricType.COMPLETION_TIME:
            trends_data = await _get_completion_time_trends(
                db, form_id, start_date, end_date, period.value
            )
        elif metric == MetricType.ERROR_RATES:
            trends_data = await _get_error_rate_trends(
                db, form_id, start_date, end_date, period.value
            )
        else:
            # Add more metric types as needed
            trends_data = {"message": f"Metric type {metric} not yet implemented"}
        
        return {
            "form_id": form_id,
            "metric": metric,
            "period": period,
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "data": trends_data,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get form trends: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/forms/{form_id}/field-analytics")
async def get_field_analytics(
    form_id: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Get detailed field-level analytics"""
    try:
        logger.info(f"Getting field analytics for form: {form_id}")
        
        # Verify form exists and get field definitions
        result = await db.execute(
            select(FormSchema).where(FormSchema.id == form_id)
        )
        form = result.scalar_one_or_none()
        
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        # Set default date range
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Get all responses for the form in the date range
        responses_result = await db.execute(
            select(FormResponse).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date
                )
            )
        )
        responses = responses_result.scalars().all()
        
        total_responses = len(responses)
        field_analytics = {}
        
        # Analyze each field defined in the form schema
        for field_def in form.fields:
            field_id = field_def.get('id')
            field_type = field_def.get('type')
            field_label = field_def.get('label', field_id)
            
            # Initialize field analytics
            field_stats = {
                "field_id": field_id,
                "field_label": field_label,
                "field_type": field_type,
                "total_responses": total_responses,
                "filled_count": 0,
                "empty_count": 0,
                "completion_rate": 0,
                "validation_errors": 0,
                "unique_values": 0,
                "value_distribution": {},
                "average_length": 0,
                "common_errors": []
            }
            
            field_values = []
            validation_errors = 0
            
            # Analyze field data across all responses
            for response in responses:
                form_data = response.data
                validation_errors_data = response.validation_errors or {}
                
                if field_id in form_data:
                    field_value = form_data[field_id]
                    
                    # Check if field has a value
                    if field_value not in [None, '', [], {}]:
                        field_stats["filled_count"] += 1
                        field_values.append(field_value)
                        
                        # Track value distribution for select fields
                        if field_type in ['select', 'radio']:
                            field_stats["value_distribution"][str(field_value)] = \
                                field_stats["value_distribution"].get(str(field_value), 0) + 1
                    else:
                        field_stats["empty_count"] += 1
                
                # Count validation errors for this field
                if field_id in validation_errors_data:
                    validation_errors += 1
            
            # Calculate derived metrics
            field_stats["completion_rate"] = (field_stats["filled_count"] / total_responses * 100) if total_responses > 0 else 0
            field_stats["validation_errors"] = validation_errors
            field_stats["unique_values"] = len(set(str(v) for v in field_values))
            
            # Calculate average length for text fields
            if field_type in ['text', 'textarea'] and field_values:
                text_lengths = [len(str(v)) for v in field_values if v]
                field_stats["average_length"] = sum(text_lengths) / len(text_lengths) if text_lengths else 0
            
            field_analytics[field_id] = field_stats
        
        return {
            "form_id": form_id,
            "form_name": form.name,
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "total_responses": total_responses,
            "field_analytics": field_analytics,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get field analytics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/forms/{form_id}/export")
async def export_form_analytics(
    form_id: str,
    format: str = Query("json", regex="^(json|csv|xlsx)$"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    include_raw_data: bool = Query(False),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """Export form analytics data"""
    try:
        logger.info(f"Exporting analytics for form: {form_id} in format: {format}")
        
        # Get comprehensive analytics data
        overview = await get_form_analytics_overview(
            form_id, start_date, end_date, db, current_user
        )
        
        field_analytics = await get_field_analytics(
            form_id, start_date, end_date, db, current_user
        )
        
        export_data = {
            "overview": overview,
            "field_analytics": field_analytics,
            "export_info": {
                "format": format,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "exported_by": str(current_user.id) if current_user else "unknown"
            }
        }
        
        # Include raw response data if requested
        if include_raw_data:
            responses_result = await db.execute(
                select(FormResponse).where(
                    and_(
                        FormResponse.form_schema_id == form_id,
                        FormResponse.submitted_at >= (start_date or datetime.now(timezone.utc) - timedelta(days=30)),
                        FormResponse.submitted_at <= (end_date or datetime.now(timezone.utc))
                    )
                )
            )
            responses = responses_result.scalars().all()
            
            export_data["raw_responses"] = [
                {
                    "id": str(response.id),
                    "data": response.data,
                    "metadata": response.metadata,
                    "submitted_at": response.submitted_at.isoformat(),
                    "is_valid": response.is_valid,
                    "completion_time": response.completion_time_seconds
                }
                for response in responses
            ]
        
        if format == "json":
            return export_data
        elif format == "csv":
            # Convert to CSV format (simplified)
            return {"message": "CSV export not yet implemented", "data": export_data}
        elif format == "xlsx":
            # Convert to Excel format (simplified)
            return {"message": "Excel export not yet implemented", "data": export_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to export form analytics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Helper functions for analytics calculations

async def _get_responses_by_period(
    db: AsyncSession,
    form_id: str,
    start_date: datetime,
    end_date: datetime,
    period: str
) -> Dict[str, Any]:
    """Get response counts grouped by time period"""
    try:
        # Choose appropriate SQL date truncation based on period
        if period == "hour":
            date_trunc = "hour"
        elif period == "day":
            date_trunc = "day"
        elif period == "week":
            date_trunc = "week"
        elif period == "month":
            date_trunc = "month"
        else:
            date_trunc = "day"
        
        # Use raw SQL for date_trunc function (PostgreSQL specific)
        query = text(f"""
            SELECT 
                date_trunc('{date_trunc}', submitted_at) as period,
                COUNT(*) as response_count
            FROM form_responses 
            WHERE form_schema_id = :form_id 
                AND submitted_at >= :start_date 
                AND submitted_at <= :end_date
            GROUP BY date_trunc('{date_trunc}', submitted_at)
            ORDER BY period
        """)
        
        result = await db.execute(query, {
            "form_id": form_id,
            "start_date": start_date,
            "end_date": end_date
        })
        
        return [
            {
                "period": row.period.isoformat(),
                "count": row.response_count
            }
            for row in result
        ]
        
    except Exception as e:
        logger.error(f"Failed to get responses by period: {e}")
        return []


async def _get_device_breakdown(
    db: AsyncSession,
    form_id: str,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, int]:
    """Get device type breakdown from response metadata"""
    try:
        responses_result = await db.execute(
            select(FormResponse.metadata).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date
                )
            )
        )
        
        device_counts = {"desktop": 0, "mobile": 0, "tablet": 0, "unknown": 0}
        
        for (metadata,) in responses_result:
            if metadata and "device_info" in metadata:
                device_type = metadata["device_info"].get("device_type", "unknown")
                device_counts[device_type] = device_counts.get(device_type, 0) + 1
            else:
                device_counts["unknown"] += 1
        
        return device_counts
        
    except Exception as e:
        logger.error(f"Failed to get device breakdown: {e}")
        return {}


async def _get_field_error_analytics(
    db: AsyncSession,
    form_id: str,
    start_date: datetime,
    end_date: datetime
) -> List[Dict[str, Any]]:
    """Get field error statistics"""
    try:
        responses_result = await db.execute(
            select(FormResponse.validation_errors).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date,
                    FormResponse.validation_errors.is_not(None)
                )
            )
        )
        
        field_errors = {}
        
        for (validation_errors,) in responses_result:
            if validation_errors:
                for error in validation_errors:
                    field_id = error.get("field_id")
                    error_type = error.get("error_type")
                    
                    if field_id:
                        if field_id not in field_errors:
                            field_errors[field_id] = {}
                        
                        field_errors[field_id][error_type] = \
                            field_errors[field_id].get(error_type, 0) + 1
        
        return [
            {
                "field_id": field_id,
                "errors": errors
            }
            for field_id, errors in field_errors.items()
        ]
        
    except Exception as e:
        logger.error(f"Failed to get field error analytics: {e}")
        return []


async def _get_completion_time_trends(
    db: AsyncSession,
    form_id: str,
    start_date: datetime,
    end_date: datetime,
    period: str
) -> List[Dict[str, Any]]:
    """Get completion time trends over time"""
    try:
        # Similar to _get_responses_by_period but with average completion time
        date_trunc = period if period in ["hour", "day", "week", "month"] else "day"
        
        query = text(f"""
            SELECT 
                date_trunc('{date_trunc}', submitted_at) as period,
                AVG(completion_time_seconds) as avg_completion_time,
                COUNT(*) as response_count
            FROM form_responses 
            WHERE form_schema_id = :form_id 
                AND submitted_at >= :start_date 
                AND submitted_at <= :end_date
                AND completion_time_seconds IS NOT NULL
            GROUP BY date_trunc('{date_trunc}', submitted_at)
            ORDER BY period
        """)
        
        result = await db.execute(query, {
            "form_id": form_id,
            "start_date": start_date,
            "end_date": end_date
        })
        
        return [
            {
                "period": row.period.isoformat(),
                "avg_completion_time": float(row.avg_completion_time) if row.avg_completion_time else 0,
                "response_count": row.response_count
            }
            for row in result
        ]
        
    except Exception as e:
        logger.error(f"Failed to get completion time trends: {e}")
        return []


async def _get_error_rate_trends(
    db: AsyncSession,
    form_id: str,
    start_date: datetime,
    end_date: datetime,
    period: str
) -> List[Dict[str, Any]]:
    """Get error rate trends over time"""
    try:
        date_trunc = period if period in ["hour", "day", "week", "month"] else "day"
        
        query = text(f"""
            SELECT 
                date_trunc('{date_trunc}', submitted_at) as period,
                COUNT(*) as total_responses,
                COUNT(CASE WHEN is_valid = false THEN 1 END) as invalid_responses
            FROM form_responses 
            WHERE form_schema_id = :form_id 
                AND submitted_at >= :start_date 
                AND submitted_at <= :end_date
            GROUP BY date_trunc('{date_trunc}', submitted_at)
            ORDER BY period
        """)
        
        result = await db.execute(query, {
            "form_id": form_id,
            "start_date": start_date,
            "end_date": end_date
        })
        
        return [
            {
                "period": row.period.isoformat(),
                "total_responses": row.total_responses,
                "invalid_responses": row.invalid_responses,
                "error_rate": (row.invalid_responses / row.total_responses * 100) if row.total_responses > 0 else 0
            }
            for row in result
        ]
        
    except Exception as e:
        logger.error(f"Failed to get error rate trends: {e}")
        return []


async def _get_conversion_funnel(
    db: AsyncSession,
    form_id: str,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    """Get conversion funnel data"""
    try:
        # This is a simplified funnel - in a real implementation,
        # you'd track form views, starts, completions, etc.
        
        total_responses = await db.execute(
            select(func.count(FormResponse.id)).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date
                )
            )
        )
        total = total_responses.scalar() or 0
        
        valid_responses = await db.execute(
            select(func.count(FormResponse.id)).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date,
                    FormResponse.is_valid == True
                )
            )
        )
        valid = valid_responses.scalar() or 0
        
        processed_responses = await db.execute(
            select(func.count(FormResponse.id)).where(
                and_(
                    FormResponse.form_schema_id == form_id,
                    FormResponse.submitted_at >= start_date,
                    FormResponse.submitted_at <= end_date,
                    FormResponse.status == "processed"
                )
            )
        )
        processed = processed_responses.scalar() or 0
        
        return {
            "funnel_steps": [
                {"step": "submitted", "count": total, "conversion_rate": 100.0},
                {"step": "valid", "count": valid, "conversion_rate": (valid / total * 100) if total > 0 else 0},
                {"step": "processed", "count": processed, "conversion_rate": (processed / total * 100) if total > 0 else 0}
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get conversion funnel: {e}")
        return {"funnel_steps": []}