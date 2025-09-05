"""
Notification Service
Email and other notification handling for form submissions and system events.
"""

import logging
import smtplib
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, Template
from pydantic import BaseModel

from ..config import settings

logger = logging.getLogger(__name__)


class EmailNotification(BaseModel):
    """Email notification model"""
    to_emails: List[str]
    subject: str
    html_body: str
    text_body: Optional[str] = None
    attachments: Optional[List[str]] = None
    priority: str = "normal"  # low, normal, high


class NotificationService:
    """Service for sending notifications"""
    
    def __init__(self):
        self.smtp_host = settings.EMAIL_HOST
        self.smtp_port = settings.EMAIL_PORT
        self.smtp_username = settings.EMAIL_USERNAME
        self.smtp_password = settings.EMAIL_PASSWORD
        self.from_email = settings.EMAIL_USERNAME or "noreply@concertmaster.com"
        
        # Initialize Jinja2 for email templates
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        template_dir.mkdir(parents=True, exist_ok=True)
        
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=True
        )
        
        # Create default templates if they don't exist
        self._ensure_default_templates()
        
    def _ensure_default_templates(self):
        """Create default email templates"""
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        
        # Admin notification template
        admin_template = template_dir / "admin_notification.html"
        if not admin_template.exists():
            admin_template.write_text("""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>New Form Submission</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; }
        .content { margin: 20px 0; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        .data-table th { background-color: #f8f9fa; }
        .footer { margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>New Form Submission: {{ form_name }}</h2>
        <p>Received at: {{ submitted_at }}</p>
    </div>
    
    <div class="content">
        <h3>Form Data:</h3>
        <table class="data-table">
            {% for key, value in form_data.items() %}
            <tr>
                <th>{{ key }}</th>
                <td>{{ value }}</td>
            </tr>
            {% endfor %}
        </table>
        
        {% if metadata %}
        <h3>Submission Metadata:</h3>
        <ul>
            <li><strong>IP Address:</strong> {{ metadata.get('ip_address', 'N/A') }}</li>
            <li><strong>User Agent:</strong> {{ metadata.get('user_agent', 'N/A') }}</li>
            <li><strong>Referrer:</strong> {{ metadata.get('referrer', 'N/A') }}</li>
        </ul>
        {% endif %}
    </div>
    
    <div class="footer">
        <p>This is an automated notification from ConcertMaster Form System.</p>
    </div>
</body>
</html>
            """.strip())
        
        # User confirmation template
        user_template = template_dir / "user_confirmation.html"
        if not user_template.exists():
            user_template.write_text("""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Form Submission Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px; }
        .content { margin: 20px 0; line-height: 1.6; }
        .footer { margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Thank You for Your Submission!</h2>
    </div>
    
    <div class="content">
        <p>Dear {{ user_name or 'Valued Customer' }},</p>
        
        <p>Thank you for submitting the <strong>{{ form_name }}</strong> form. We have successfully received your information.</p>
        
        <p><strong>Submission Details:</strong></p>
        <ul>
            <li>Form: {{ form_name }}</li>
            <li>Submitted: {{ submitted_at }}</li>
            <li>Reference ID: {{ response_id }}</li>
        </ul>
        
        <p>We will review your submission and get back to you as soon as possible.</p>
        
        <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>The ConcertMaster Team</p>
    </div>
    
    <div class="footer">
        <p>This is an automated confirmation email. Please do not reply to this message.</p>
    </div>
</body>
</html>
            """.strip())
    
    async def send_admin_notification(
        self,
        emails: List[str],
        form_name: str,
        response_data: Dict[str, Any]
    ) -> bool:
        """Send admin notification for form submission"""
        try:
            logger.info(f"Sending admin notification to {len(emails)} recipients")
            
            # Prepare template data
            template_data = {
                'form_name': form_name,
                'form_data': response_data.get('form_data', {}),
                'metadata': response_data.get('metadata', {}),
                'submitted_at': response_data.get('submitted_at'),
                'response_id': response_data.get('response_id')
            }
            
            # Render email template
            template = self.jinja_env.get_template('admin_notification.html')
            html_body = template.render(**template_data)
            
            # Create notification
            notification = EmailNotification(
                to_emails=emails,
                subject=f"New Form Submission: {form_name}",
                html_body=html_body,
                priority="high"
            )
            
            # Send email
            success = await self._send_email(notification)
            
            if success:
                logger.info(f"✅ Admin notification sent successfully")
            else:
                logger.error(f"❌ Failed to send admin notification")
                
            return success
            
        except Exception as e:
            logger.error(f"❌ Admin notification failed: {e}")
            return False
    
    async def send_user_confirmation(
        self,
        email: str,
        form_name: str,
        response_data: Dict[str, Any]
    ) -> bool:
        """Send user confirmation email"""
        try:
            logger.info(f"Sending user confirmation to {email}")
            
            # Extract user name from form data if available
            form_data = response_data.get('form_data', {})
            user_name = (
                form_data.get('name') or 
                form_data.get('full_name') or 
                form_data.get('first_name') or
                None
            )
            
            # Prepare template data
            template_data = {
                'form_name': form_name,
                'user_name': user_name,
                'submitted_at': response_data.get('submitted_at'),
                'response_id': response_data.get('response_id'),
                'form_data': form_data
            }
            
            # Render email template
            template = self.jinja_env.get_template('user_confirmation.html')
            html_body = template.render(**template_data)
            
            # Create notification
            notification = EmailNotification(
                to_emails=[email],
                subject=f"Confirmation: {form_name} Submission",
                html_body=html_body,
                priority="normal"
            )
            
            # Send email
            success = await self._send_email(notification)
            
            if success:
                logger.info(f"✅ User confirmation sent successfully")
            else:
                logger.error(f"❌ Failed to send user confirmation")
                
            return success
            
        except Exception as e:
            logger.error(f"❌ User confirmation failed: {e}")
            return False
    
    async def send_custom_notification(
        self,
        notification_config: Dict[str, Any],
        response_data: Dict[str, Any]
    ) -> bool:
        """Send custom notification based on configuration"""
        try:
            notification_type = notification_config.get('type', 'email')
            
            if notification_type == 'email':
                return await self._send_custom_email_notification(notification_config, response_data)
            elif notification_type == 'webhook':
                return await self._send_webhook_notification(notification_config, response_data)
            elif notification_type == 'slack':
                return await self._send_slack_notification(notification_config, response_data)
            else:
                logger.warning(f"Unknown notification type: {notification_type}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Custom notification failed: {e}")
            return False
    
    async def _send_custom_email_notification(
        self,
        config: Dict[str, Any],
        response_data: Dict[str, Any]
    ) -> bool:
        """Send custom email notification"""
        try:
            to_emails = config.get('emails', [])
            subject_template = config.get('subject', 'Form Submission')
            body_template = config.get('body', 'New form submission received.')
            
            # Render templates with response data
            subject = self._render_template_string(subject_template, response_data)
            body = self._render_template_string(body_template, response_data)
            
            notification = EmailNotification(
                to_emails=to_emails,
                subject=subject,
                html_body=body,
                priority=config.get('priority', 'normal')
            )
            
            return await self._send_email(notification)
            
        except Exception as e:
            logger.error(f"Failed to send custom email notification: {e}")
            return False
    
    async def _send_webhook_notification(
        self,
        config: Dict[str, Any],
        response_data: Dict[str, Any]
    ) -> bool:
        """Send webhook notification"""
        try:
            import httpx
            
            webhook_url = config.get('url')
            if not webhook_url:
                logger.error("Webhook URL not configured")
                return False
            
            # Prepare payload
            payload = {
                'notification_type': 'form_submission',
                'timestamp': datetime.utcnow().isoformat(),
                'data': response_data
            }
            
            # Add custom headers if configured
            headers = config.get('headers', {})
            headers.setdefault('Content-Type', 'application/json')
            
            # Send webhook
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code in [200, 201, 202]:
                    logger.info(f"✅ Webhook notification sent successfully")
                    return True
                else:
                    logger.error(f"❌ Webhook notification failed: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}")
            return False
    
    async def _send_slack_notification(
        self,
        config: Dict[str, Any],
        response_data: Dict[str, Any]
    ) -> bool:
        """Send Slack notification"""
        try:
            import httpx
            
            webhook_url = config.get('webhook_url')
            if not webhook_url:
                logger.error("Slack webhook URL not configured")
                return False
            
            # Prepare Slack message
            form_name = response_data.get('form_name', 'Unknown Form')
            submitted_at = response_data.get('submitted_at', 'Unknown Time')
            
            message = {
                'text': f"New form submission: {form_name}",
                'attachments': [
                    {
                        'color': 'good',
                        'title': f'Form: {form_name}',
                        'fields': [
                            {
                                'title': 'Submitted At',
                                'value': submitted_at,
                                'short': True
                            },
                            {
                                'title': 'Response ID',
                                'value': response_data.get('response_id', 'N/A'),
                                'short': True
                            }
                        ]
                    }
                ]
            }
            
            # Send to Slack
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook_url,
                    json=message,
                    timeout=30
                )
                
                if response.status_code == 200:
                    logger.info(f"✅ Slack notification sent successfully")
                    return True
                else:
                    logger.error(f"❌ Slack notification failed: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            return False
    
    async def _send_email(self, notification: EmailNotification) -> bool:
        """Send email notification using SMTP"""
        try:
            if not self.smtp_host:
                logger.warning("SMTP not configured, skipping email notification")
                return True  # Don't fail if SMTP is not configured
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = self.from_email
            msg['To'] = ', '.join(notification.to_emails)
            msg['Subject'] = notification.subject
            
            # Set priority
            if notification.priority == 'high':
                msg['X-Priority'] = '1'
                msg['Importance'] = 'high'
            elif notification.priority == 'low':
                msg['X-Priority'] = '5'
                msg['Importance'] = 'low'
            
            # Attach HTML body
            html_part = MIMEText(notification.html_body, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Attach text body if provided
            if notification.text_body:
                text_part = MIMEText(notification.text_body, 'plain', 'utf-8')
                msg.attach(text_part)
            
            # Add attachments if any
            if notification.attachments:
                for attachment_path in notification.attachments:
                    await self._add_attachment(msg, attachment_path)
            
            # Send email
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_username,
                password=self.smtp_password,
                use_tls=True if self.smtp_port == 587 else False,
                start_tls=True if self.smtp_port == 587 else False,
                timeout=30
            )
            
            logger.info(f"✅ Email sent successfully to {len(notification.to_emails)} recipients")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send email: {e}")
            return False
    
    async def _add_attachment(self, msg: MIMEMultipart, attachment_path: str):
        """Add file attachment to email"""
        try:
            file_path = Path(attachment_path)
            
            if not file_path.exists():
                logger.warning(f"Attachment file not found: {attachment_path}")
                return
            
            # Read file content
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            # Create attachment
            attachment = MIMEBase('application', 'octet-stream')
            attachment.set_payload(file_content)
            encoders.encode_base64(attachment)
            attachment.add_header(
                'Content-Disposition',
                f'attachment; filename= {file_path.name}'
            )
            
            msg.attach(attachment)
            logger.info(f"Added attachment: {file_path.name}")
            
        except Exception as e:
            logger.error(f"Failed to add attachment {attachment_path}: {e}")
    
    def _render_template_string(self, template_str: str, data: Dict[str, Any]) -> str:
        """Render template string with data"""
        try:
            template = Template(template_str)
            return template.render(**data)
        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            return template_str  # Return original string if rendering fails
    
    async def send_system_notification(
        self,
        notification_type: str,
        title: str,
        message: str,
        recipients: List[str],
        priority: str = "normal"
    ) -> bool:
        """Send system notification (errors, warnings, etc.)"""
        try:
            logger.info(f"Sending system notification: {notification_type}")
            
            # Create system notification HTML
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>{title}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 20px; }}
                    .alert {{ padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                    .alert-error {{ background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }}
                    .alert-warning {{ background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }}
                    .alert-info {{ background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }}
                </style>
            </head>
            <body>
                <div class="alert alert-{notification_type}">
                    <h3>{title}</h3>
                    <p>{message}</p>
                    <p><small>Timestamp: {datetime.utcnow().isoformat()}</small></p>
                </div>
            </body>
            </html>
            """
            
            notification = EmailNotification(
                to_emails=recipients,
                subject=f"[ConcertMaster] {title}",
                html_body=html_body,
                priority=priority
            )
            
            return await self._send_email(notification)
            
        except Exception as e:
            logger.error(f"❌ System notification failed: {e}")
            return False
    
    async def test_email_configuration(self) -> Dict[str, Any]:
        """Test email configuration"""
        try:
            if not self.smtp_host:
                return {
                    'success': False,
                    'error': 'SMTP host not configured'
                }
            
            # Test SMTP connection
            await aiosmtplib.SMTP(
                hostname=self.smtp_host,
                port=self.smtp_port,
                timeout=10
            ).connect()
            
            return {
                'success': True,
                'message': 'SMTP configuration is valid'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'SMTP test failed: {str(e)}'
            }