"""
ConcertMaster Webhook Service
Webhook management and processing for workflow triggers
"""

import hashlib
import hmac
import json
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging
import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import Webhook, WorkflowExecution, Workflow
from ..services.celery_worker import ExecuteWorkflowTask
from ..config import settings

logger = logging.getLogger(__name__)

class WebhookService:
    """Service for managing webhooks and processing webhook requests"""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
    
    async def create_webhook(self, workflow_id: uuid.UUID, webhook_data: Dict[str, Any]) -> Webhook:
        """Create a new webhook for a workflow"""
        try:
            # Generate unique URL path
            url_path = webhook_data.get('url_path') or self._generate_webhook_path()
            
            # Create webhook record
            webhook = Webhook(
                workflow_id=workflow_id,
                name=webhook_data.get('name', f'Webhook for {workflow_id}'),
                url_path=url_path,
                secret_key=webhook_data.get('secret_key') or self._generate_secret_key(),
                is_active=webhook_data.get('is_active', True)
            )
            
            self.db.add(webhook)
            await self.db.commit()
            await self.db.refresh(webhook)
            
            logger.info(f"Created webhook {webhook.id} for workflow {workflow_id}")
            return webhook
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create webhook for workflow {workflow_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to create webhook")
    
    async def get_webhook_by_path(self, url_path: str) -> Optional[Webhook]:
        """Get webhook by URL path"""
        try:
            result = await self.db.execute(
                "SELECT * FROM webhooks WHERE url_path = %s AND is_active = TRUE",
                (url_path,)
            )
            webhook_data = result.fetchone()
            
            if webhook_data:
                return Webhook(**dict(webhook_data))
            return None
            
        except Exception as e:
            logger.error(f"Failed to get webhook by path {url_path}: {str(e)}")
            return None
    
    async def process_webhook_request(self, url_path: str, headers: Dict[str, str], 
                                    body: bytes, method: str = "POST") -> Dict[str, Any]:
        """Process incoming webhook request"""
        try:
            # Get webhook configuration
            webhook = await self.get_webhook_by_path(url_path)
            if not webhook:
                raise HTTPException(status_code=404, detail="Webhook not found")
            
            # Validate webhook signature if secret key is set
            if webhook.secret_key:
                signature = headers.get('X-Webhook-Signature') or headers.get('X-Hub-Signature-256')
                if not signature:
                    raise HTTPException(status_code=401, detail="Missing webhook signature")
                
                if not self._verify_signature(body, webhook.secret_key, signature):
                    raise HTTPException(status_code=401, detail="Invalid webhook signature")
            
            # Parse request body
            try:
                payload = json.loads(body.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                payload = {"raw_body": body.decode('utf-8', errors='ignore')}
            
            # Get workflow
            result = await self.db.execute(
                "SELECT * FROM workflows WHERE id = %s AND status = 'active'",
                (webhook.workflow_id,)
            )
            workflow_data = result.fetchone()
            
            if not workflow_data:
                raise HTTPException(status_code=404, detail="Associated workflow not found or inactive")
            
            # Create workflow execution
            execution_id = uuid.uuid4()
            trigger_data = {
                "webhook_path": url_path,
                "method": method,
                "headers": dict(headers),
                "payload": payload,
                "timestamp": datetime.now().isoformat()
            }
            
            await self.db.execute(
                """INSERT INTO workflow_executions 
                   (id, workflow_id, trigger_type, trigger_data, status, started_at) 
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (execution_id, webhook.workflow_id, "webhook", json.dumps(trigger_data), 
                 "pending", datetime.now())
            )
            
            # Update webhook stats
            await self.db.execute(
                """UPDATE webhooks 
                   SET request_count = request_count + 1, last_triggered_at = %s 
                   WHERE id = %s""",
                (datetime.now(), webhook.id)
            )
            
            await self.db.commit()
            
            # Queue workflow execution
            task = ExecuteWorkflowTask.delay(str(execution_id))
            
            logger.info(f"Webhook {webhook.id} triggered workflow execution {execution_id}")
            
            return {
                "success": True,
                "execution_id": str(execution_id),
                "task_id": task.id,
                "message": "Webhook processed successfully"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to process webhook request for {url_path}: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def list_webhooks(self, workflow_id: uuid.UUID) -> List[Webhook]:
        """List webhooks for a workflow"""
        try:
            result = await self.db.execute(
                "SELECT * FROM webhooks WHERE workflow_id = %s ORDER BY created_at DESC",
                (workflow_id,)
            )
            webhooks_data = result.fetchall()
            
            return [Webhook(**dict(webhook_data)) for webhook_data in webhooks_data]
            
        except Exception as e:
            logger.error(f"Failed to list webhooks for workflow {workflow_id}: {str(e)}")
            return []
    
    async def update_webhook(self, webhook_id: uuid.UUID, update_data: Dict[str, Any]) -> Optional[Webhook]:
        """Update webhook configuration"""
        try:
            # Build update query
            set_clauses = []
            values = []
            
            for field in ['name', 'secret_key', 'is_active']:
                if field in update_data:
                    set_clauses.append(f"{field} = %s")
                    values.append(update_data[field])
            
            if not set_clauses:
                return None
            
            set_clauses.append("updated_at = %s")
            values.append(datetime.now())
            values.append(webhook_id)
            
            query = f"UPDATE webhooks SET {', '.join(set_clauses)} WHERE id = %s RETURNING *"
            result = await self.db.execute(query, values)
            webhook_data = result.fetchone()
            
            if webhook_data:
                await self.db.commit()
                return Webhook(**dict(webhook_data))
            
            return None
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update webhook {webhook_id}: {str(e)}")
            return None
    
    async def delete_webhook(self, webhook_id: uuid.UUID) -> bool:
        """Delete webhook"""
        try:
            result = await self.db.execute(
                "DELETE FROM webhooks WHERE id = %s",
                (webhook_id,)
            )
            
            await self.db.commit()
            return result.rowcount > 0
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to delete webhook {webhook_id}: {str(e)}")
            return False
    
    async def get_webhook_stats(self, webhook_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get webhook statistics"""
        try:
            # Get webhook info
            webhook_result = await self.db.execute(
                "SELECT * FROM webhooks WHERE id = %s",
                (webhook_id,)
            )
            webhook_data = webhook_result.fetchone()
            
            if not webhook_data:
                return None
            
            # Get execution stats
            stats_result = await self.db.execute(
                """SELECT 
                       COUNT(*) as total_executions,
                       COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
                       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
                       AVG(execution_time) as avg_execution_time
                   FROM workflow_executions 
                   WHERE workflow_id = %s AND trigger_type = 'webhook'
                   AND trigger_data->>'webhook_path' = %s""",
                (webhook_data['workflow_id'], webhook_data['url_path'])
            )
            stats_data = stats_result.fetchone()
            
            return {
                "webhook_id": str(webhook_id),
                "request_count": webhook_data['request_count'],
                "last_triggered_at": webhook_data['last_triggered_at'],
                "total_executions": stats_data['total_executions'] or 0,
                "successful_executions": stats_data['successful_executions'] or 0,
                "failed_executions": stats_data['failed_executions'] or 0,
                "success_rate": (
                    (stats_data['successful_executions'] / stats_data['total_executions'] * 100)
                    if stats_data['total_executions'] > 0 else 0
                ),
                "avg_execution_time": float(stats_data['avg_execution_time'] or 0)
            }
            
        except Exception as e:
            logger.error(f"Failed to get webhook stats for {webhook_id}: {str(e)}")
            return None
    
    def _generate_webhook_path(self) -> str:
        """Generate unique webhook URL path"""
        return f"/webhook/{uuid.uuid4().hex[:16]}"
    
    def _generate_secret_key(self) -> str:
        """Generate secret key for webhook signature validation"""
        return uuid.uuid4().hex
    
    def _verify_signature(self, payload: bytes, secret: str, signature: str) -> bool:
        """Verify webhook signature"""
        try:
            # Support GitHub-style signatures (sha256=...)
            if signature.startswith('sha256='):
                signature = signature[7:]
                hash_method = hashlib.sha256
            elif signature.startswith('sha1='):
                signature = signature[5:]
                hash_method = hashlib.sha1
            else:
                # Assume sha256 if no prefix
                hash_method = hashlib.sha256
            
            # Calculate expected signature
            expected_signature = hmac.new(
                secret.encode('utf-8'),
                payload,
                hash_method
            ).hexdigest()
            
            # Constant-time comparison
            return hmac.compare_digest(expected_signature, signature)
            
        except Exception as e:
            logger.error(f"Signature verification error: {str(e)}")
            return False

class WebhookClient:
    """Client for sending webhook notifications"""
    
    def __init__(self):
        self.http_client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
        )
    
    async def send_webhook(self, url: str, payload: Dict[str, Any], 
                          secret: Optional[str] = None, headers: Optional[Dict[str, str]] = None) -> bool:
        """Send webhook notification"""
        try:
            # Prepare payload
            json_payload = json.dumps(payload)
            
            # Prepare headers
            webhook_headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'ConcertMaster-Webhook/1.0'
            }
            
            if headers:
                webhook_headers.update(headers)
            
            # Add signature if secret provided
            if secret:
                signature = hmac.new(
                    secret.encode('utf-8'),
                    json_payload.encode('utf-8'),
                    hashlib.sha256
                ).hexdigest()
                webhook_headers['X-Webhook-Signature'] = f'sha256={signature}'
            
            # Send webhook
            response = await self.http_client.post(
                url,
                content=json_payload,
                headers=webhook_headers
            )
            
            # Check response
            if response.status_code < 400:
                logger.info(f"Webhook sent successfully to {url}")
                return True
            else:
                logger.warning(f"Webhook failed with status {response.status_code}: {url}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send webhook to {url}: {str(e)}")
            return False
    
    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()