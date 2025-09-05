"""
File Upload Service
Secure file handling for form attachments with validation, virus scanning, and storage.
"""

import os
import hashlib
import mimetypes
import uuid
import logging
import asyncio
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
from datetime import datetime, timezone

import aiofiles
import magic
from fastapi import UploadFile, HTTPException
from PIL import Image
from pydantic import BaseModel

from ..config import settings

logger = logging.getLogger(__name__)


class FileValidationResult(BaseModel):
    """File validation result model"""
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    file_info: Optional[Dict[str, Any]] = None


class FileUploadResult(BaseModel):
    """File upload result model"""
    success: bool
    file_path: str
    file_size: int
    content_type: str
    file_hash: str
    errors: List[str] = []


class FileUploadService:
    """Service for handling file uploads with security and validation"""
    
    def __init__(self):
        self.upload_base_path = Path(settings.upload_path)
        self.max_file_size = settings.MAX_UPLOAD_SIZE
        
        # Allowed MIME types for security
        self.allowed_mime_types = {
            # Documents
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-powerpoint': ['.ppt'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
            'text/plain': ['.txt'],
            'text/csv': ['.csv'],
            'application/json': ['.json'],
            'application/xml': ['.xml'],
            'text/xml': ['.xml'],
            
            # Images
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp'],
            'image/bmp': ['.bmp'],
            'image/tiff': ['.tiff', '.tif'],
            'image/svg+xml': ['.svg'],
            
            # Archives
            'application/zip': ['.zip'],
            'application/x-rar-compressed': ['.rar'],
            'application/x-7z-compressed': ['.7z'],
            'application/x-tar': ['.tar'],
            'application/gzip': ['.gz'],
            
            # Audio/Video (limited)
            'audio/mpeg': ['.mp3'],
            'audio/wav': ['.wav'],
            'video/mp4': ['.mp4'],
            'video/mpeg': ['.mpeg', '.mpg'],
        }
        
        # Dangerous file extensions to always block
        self.blocked_extensions = {
            '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
            '.sh', '.ps1', '.msi', '.dll', '.app', '.deb', '.rpm', '.dmg'
        }
        
        # Image processing settings
        self.max_image_dimensions = (4000, 4000)  # Max width/height for images
        self.image_quality = 85  # JPEG quality for compression
        
        # Create upload directories
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Create necessary upload directories"""
        directories = [
            self.upload_base_path,
            self.upload_base_path / "forms",
            self.upload_base_path / "temp",
            self.upload_base_path / "processed",
            self.upload_base_path / "quarantine"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            
            # Set secure permissions (owner only)
            os.chmod(directory, 0o700)
    
    async def validate_file(self, file: UploadFile) -> FileValidationResult:
        """Comprehensive file validation"""
        errors = []
        warnings = []
        file_info = {}
        
        try:
            logger.info(f"Validating file: {file.filename}")
            
            # Basic file checks
            if not file.filename:
                errors.append("Filename is required")
                return FileValidationResult(is_valid=False, errors=errors)
            
            # Check file extension
            file_ext = Path(file.filename).suffix.lower()
            if file_ext in self.blocked_extensions:
                errors.append(f"File type '{file_ext}' is not allowed for security reasons")
                return FileValidationResult(is_valid=False, errors=errors)
            
            # Read file content for validation
            content = await file.read()
            file_size = len(content)
            
            # Reset file pointer
            await file.seek(0)
            
            # Check file size
            if file_size == 0:
                errors.append("File is empty")
                return FileValidationResult(is_valid=False, errors=errors)
            
            if file_size > self.max_file_size:
                errors.append(f"File size ({file_size} bytes) exceeds maximum allowed size ({self.max_file_size} bytes)")
                return FileValidationResult(is_valid=False, errors=errors)
            
            # Detect actual file type using python-magic
            actual_mime_type = magic.from_buffer(content, mime=True)
            
            # Verify MIME type is allowed
            if actual_mime_type not in self.allowed_mime_types:
                errors.append(f"File type '{actual_mime_type}' is not allowed")
                return FileValidationResult(is_valid=False, errors=errors)
            
            # Check if extension matches MIME type
            allowed_extensions = self.allowed_mime_types[actual_mime_type]
            if file_ext not in allowed_extensions:
                warnings.append(f"File extension '{file_ext}' doesn't match detected type '{actual_mime_type}'")
            
            # Additional validation for images
            if actual_mime_type.startswith('image/'):
                image_validation = await self._validate_image_file(content)
                if not image_validation.is_valid:
                    errors.extend(image_validation.errors)
                    warnings.extend(image_validation.warnings)
                else:
                    file_info.update(image_validation.file_info or {})
            
            # Additional validation for documents
            elif actual_mime_type.startswith('application/'):
                doc_validation = await self._validate_document_file(content, actual_mime_type)
                if not doc_validation.is_valid:
                    errors.extend(doc_validation.errors)
                    warnings.extend(doc_validation.warnings)
            
            # Generate file hash for deduplication
            file_hash = hashlib.sha256(content).hexdigest()
            
            file_info.update({
                'size': file_size,
                'mime_type': actual_mime_type,
                'hash': file_hash,
                'extension': file_ext
            })
            
            # Basic malware detection (simple patterns)
            malware_check = await self._basic_malware_scan(content, file_ext)
            if not malware_check:
                errors.append("File failed security scan")
                return FileValidationResult(is_valid=False, errors=errors)
            
            logger.info(f"✅ File validation completed: {file.filename}")
            
            return FileValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings,
                file_info=file_info
            )
            
        except Exception as e:
            logger.error(f"❌ File validation failed: {e}")
            errors.append(f"File validation error: {str(e)}")
            return FileValidationResult(is_valid=False, errors=errors)
    
    async def _validate_image_file(self, content: bytes) -> FileValidationResult:
        """Validate image files specifically"""
        errors = []
        warnings = []
        file_info = {}
        
        try:
            # Use PIL to validate image
            from io import BytesIO
            image = Image.open(BytesIO(content))
            
            # Get image info
            width, height = image.size
            format_name = image.format
            mode = image.mode
            
            file_info.update({
                'width': width,
                'height': height,
                'format': format_name,
                'mode': mode
            })
            
            # Check image dimensions
            if width > self.max_image_dimensions[0] or height > self.max_image_dimensions[1]:
                warnings.append(f"Image dimensions ({width}x{height}) exceed recommended size")
            
            # Check for suspicious image properties
            if width * height > 50000000:  # 50 megapixels
                errors.append("Image resolution too high - potential memory exhaustion attack")
            
            # Validate image mode
            if mode not in ['RGB', 'RGBA', 'L', 'P']:
                warnings.append(f"Unusual image mode: {mode}")
            
            logger.debug(f"Image validation: {width}x{height}, {format_name}, {mode}")
            
            return FileValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings,
                file_info=file_info
            )
            
        except Exception as e:
            logger.error(f"Image validation failed: {e}")
            return FileValidationResult(
                is_valid=False,
                errors=[f"Invalid image file: {str(e)}"]
            )
    
    async def _validate_document_file(self, content: bytes, mime_type: str) -> FileValidationResult:
        """Validate document files"""
        errors = []
        warnings = []
        
        try:
            # Basic document validation
            if mime_type == 'application/pdf':
                # Check PDF signature
                if not content.startswith(b'%PDF-'):
                    errors.append("Invalid PDF file signature")
            
            elif mime_type == 'application/json':
                # Validate JSON structure
                import json
                try:
                    json.loads(content.decode('utf-8'))
                except json.JSONDecodeError as e:
                    errors.append(f"Invalid JSON structure: {str(e)}")
            
            elif mime_type in ['application/xml', 'text/xml']:
                # Basic XML validation
                try:
                    from xml.etree import ElementTree as ET
                    ET.fromstring(content)
                except ET.ParseError as e:
                    errors.append(f"Invalid XML structure: {str(e)}")
            
            # Check for embedded executables or scripts
            if b'<script' in content.lower() and mime_type not in ['text/html', 'application/xml']:
                warnings.append("File contains script tags")
            
            # Check for macro indicators in Office documents
            if mime_type.startswith('application/vnd.') and b'vbaProject' in content:
                warnings.append("Document may contain macros")
            
            return FileValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"Document validation failed: {e}")
            return FileValidationResult(
                is_valid=False,
                errors=[f"Document validation error: {str(e)}"]
            )
    
    async def _basic_malware_scan(self, content: bytes, file_ext: str) -> bool:
        """Enhanced malware detection using signature patterns"""
        try:
            # Common malware signatures to detect
            malware_patterns = [
                b'MZ\x90\x00',  # PE executable header
                b'\x7fELF',      # ELF executable header
                b'\xca\xfe\xba\xbe',  # Java class file
                b'exec(',        # Python exec function
                b'eval(',        # Python eval function
                b'<script>',     # JavaScript
                b'javascript:',  # JavaScript URL
                b'vbscript:',    # VBScript URL
                b'<?php',        # PHP code
                b'<%',           # ASP/JSP code
                b'\x00\x00\x01\x00',  # ICO header (could be malicious)
                b'EICAR',        # EICAR test string
            ]
            
            content_lower = content.lower()
            
            # Check for known malware patterns
            for pattern in malware_patterns:
                if pattern in content_lower:
                    logger.warning(f"Suspicious pattern detected: {pattern}")
                    return False
            
            # Enhanced suspicious strings
            suspicious_strings = [
                b'powershell.exe',
                b'cmd.exe',
                b'rundll32.exe',
                b'regsvr32.exe',
                b'certutil.exe',
                b'wscript.exe',
                b'cscript.exe',
                b'mshta.exe',
                b'bitsadmin.exe',
                b'schtasks.exe',
                b'at.exe',
                b'reg.exe',
                b'regedit.exe',
                b'netsh.exe',
                b'taskkill.exe',
                b'systeminfo.exe',
                b'whoami.exe',
                b'net.exe',
                b'ping.exe',
                b'nslookup.exe',
                b'ipconfig.exe',
                b'arp.exe',
                b'route.exe',
                b'netstat.exe',
            ]
            
            for sus_string in suspicious_strings:
                if sus_string in content_lower:
                    logger.warning(f"Suspicious string detected: {sus_string}")
                    return False
            
            # Check for encoded/obfuscated content
            obfuscation_patterns = [
                b'base64,',      # Base64 data URLs
                b'fromCharCode', # JavaScript obfuscation
                b'String.fromCharCode',
                b'unescape(',    # JavaScript decode
                b'decodeURI',    # JavaScript decode
                b'atob(',        # Base64 decode
                b'btoa(',        # Base64 encode
            ]
            
            for pattern in obfuscation_patterns:
                if pattern in content_lower:
                    logger.warning(f"Obfuscation pattern detected: {pattern}")
                    # Don't immediately fail, but increase suspicion
                    if content_lower.count(pattern) > 3:  # Multiple occurrences
                        return False
            
            # Check file-specific patterns
            if file_ext == '.pdf':
                # Check for embedded JavaScript in PDFs
                if b'/js' in content_lower or b'/javascript' in content_lower:
                    logger.warning("JavaScript detected in PDF file")
                    return False
                
                # Check for suspicious PDF objects
                if b'/launch' in content_lower or b'/importdata' in content_lower:
                    logger.warning("Suspicious PDF objects detected")
                    return False
            
            elif file_ext in ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']:
                # Check for VBA macros (enhanced detection)
                vba_patterns = [
                    b'vbaproject.bin',
                    b'document.xml.rels',
                    b'activex',
                    b'oleobject',
                    b'application/vnd.ms-office.vbaproject',
                ]
                
                for pattern in vba_patterns:
                    if pattern in content_lower:
                        logger.warning("VBA/ActiveX content detected in Office document")
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Malware scan failed: {e}")
            return False
    
    async def upload_file(self, file: UploadFile, category: str = "general") -> FileUploadResult:
        """Upload file with security checks and processing"""
        try:
            logger.info(f"Uploading file: {file.filename} (category: {category})")
            
            # Validate file first
            validation_result = await self.validate_file(file)
            if not validation_result.is_valid:
                return FileUploadResult(
                    success=False,
                    file_path="",
                    file_size=0,
                    content_type="",
                    file_hash="",
                    errors=validation_result.errors
                )
            
            # Generate secure filename
            file_ext = Path(file.filename).suffix.lower()
            secure_filename = f"{uuid.uuid4().hex}{file_ext}"
            
            # Determine upload directory
            upload_dir = self.upload_base_path / category
            upload_dir.mkdir(exist_ok=True)
            
            # Create subdirectory by date for organization
            date_dir = upload_dir / datetime.now().strftime("%Y/%m/%d")
            date_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = date_dir / secure_filename
            
            # Read file content
            content = await file.read()
            file_size = len(content)
            
            # Write file securely
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            # Set secure file permissions
            os.chmod(file_path, 0o600)  # Owner read/write only
            
            # Generate file hash
            file_hash = hashlib.sha256(content).hexdigest()
            
            # Process file based on type
            processed_path = await self._process_uploaded_file(file_path, validation_result.file_info)
            
            logger.info(f"✅ File uploaded successfully: {secure_filename}")
            
            return FileUploadResult(
                success=True,
                file_path=str(processed_path or file_path),
                file_size=file_size,
                content_type=validation_result.file_info.get('mime_type', file.content_type),
                file_hash=file_hash,
                errors=[]
            )
            
        except Exception as e:
            logger.error(f"❌ File upload failed: {e}")
            return FileUploadResult(
                success=False,
                file_path="",
                file_size=0,
                content_type="",
                file_hash="",
                errors=[f"Upload failed: {str(e)}"]
            )
    
    async def _process_uploaded_file(self, file_path: Path, file_info: Dict[str, Any]) -> Optional[Path]:
        """Process uploaded file (resize images, optimize, etc.)"""
        try:
            mime_type = file_info.get('mime_type', '')
            
            # Process images
            if mime_type.startswith('image/'):
                return await self._process_image_file(file_path, file_info)
            
            # Process documents
            elif mime_type.startswith('application/'):
                return await self._process_document_file(file_path, file_info)
            
            return None  # No processing needed
            
        except Exception as e:
            logger.error(f"File processing failed: {e}")
            return None
    
    async def _process_image_file(self, file_path: Path, file_info: Dict[str, Any]) -> Optional[Path]:
        """Process and optimize image files"""
        try:
            width = file_info.get('width', 0)
            height = file_info.get('height', 0)
            
            # Check if image needs resizing
            if width > self.max_image_dimensions[0] or height > self.max_image_dimensions[1]:
                logger.info(f"Resizing image: {width}x{height}")
                
                # Create processed directory
                processed_dir = self.upload_base_path / "processed" / "images"
                processed_dir.mkdir(parents=True, exist_ok=True)
                
                processed_path = processed_dir / file_path.name
                
                # Resize image
                with Image.open(file_path) as img:
                    # Calculate new dimensions maintaining aspect ratio
                    ratio = min(
                        self.max_image_dimensions[0] / width,
                        self.max_image_dimensions[1] / height
                    )
                    
                    new_width = int(width * ratio)
                    new_height = int(height * ratio)
                    
                    # Resize and save
                    resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    
                    # Save with optimization
                    if img.format == 'JPEG':
                        resized_img.save(processed_path, 'JPEG', quality=self.image_quality, optimize=True)
                    else:
                        resized_img.save(processed_path, optimize=True)
                
                logger.info(f"✅ Image resized: {new_width}x{new_height}")
                return processed_path
            
            return None
            
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            return None
    
    async def _process_document_file(self, file_path: Path, file_info: Dict[str, Any]) -> Optional[Path]:
        """Process document files"""
        try:
            mime_type = file_info.get('mime_type', '')
            
            # Basic document processing (could be extended)
            if mime_type == 'application/json':
                # Validate and pretty-print JSON
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = f.read()
                
                try:
                    import json
                    parsed_data = json.loads(data)
                    
                    # Create processed version with pretty formatting
                    processed_dir = self.upload_base_path / "processed" / "documents"
                    processed_dir.mkdir(parents=True, exist_ok=True)
                    
                    processed_path = processed_dir / file_path.name
                    
                    with open(processed_path, 'w', encoding='utf-8') as f:
                        json.dump(parsed_data, f, indent=2, ensure_ascii=False)
                    
                    return processed_path
                    
                except json.JSONDecodeError:
                    # If JSON is invalid, keep original
                    return None
            
            return None
            
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            return None
    
    async def delete_file(self, file_path: str) -> bool:
        """Safely delete uploaded file"""
        try:
            path = Path(file_path)
            
            # Security check: ensure file is in allowed upload directory
            if not path.is_relative_to(self.upload_base_path):
                logger.warning(f"Attempted to delete file outside upload directory: {file_path}")
                return False
            
            if path.exists():
                path.unlink()
                logger.info(f"✅ File deleted: {file_path}")
                return True
            else:
                logger.warning(f"File not found for deletion: {file_path}")
                return False
                
        except Exception as e:
            logger.error(f"❌ File deletion failed: {e}")
            return False
    
    async def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get information about uploaded file"""
        try:
            path = Path(file_path)
            
            if not path.exists():
                return None
            
            stat = path.stat()
            mime_type, _ = mimetypes.guess_type(str(path))
            
            return {
                'path': str(path),
                'size': stat.st_size,
                'mime_type': mime_type,
                'created_at': datetime.fromtimestamp(stat.st_ctime, timezone.utc),
                'modified_at': datetime.fromtimestamp(stat.st_mtime, timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"Failed to get file info: {e}")
            return None
    
    async def cleanup_old_files(self, days_old: int = 30) -> int:
        """Clean up old uploaded files"""
        try:
            cutoff_time = datetime.now(timezone.utc).timestamp() - (days_old * 24 * 3600)
            deleted_count = 0
            
            # Walk through upload directory
            for root, dirs, files in os.walk(self.upload_base_path):
                for file in files:
                    file_path = Path(root) / file
                    
                    try:
                        if file_path.stat().st_mtime < cutoff_time:
                            file_path.unlink()
                            deleted_count += 1
                    except (OSError, IOError) as e:
                        logger.warning(f"Failed to delete old file {file_path}: {e}")
            
            logger.info(f"✅ Cleaned up {deleted_count} old files")
            return deleted_count
            
        except Exception as e:
            logger.error(f"❌ File cleanup failed: {e}")
            return 0
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            total_size = 0
            file_count = 0
            
            for root, dirs, files in os.walk(self.upload_base_path):
                for file in files:
                    file_path = Path(root) / file
                    try:
                        total_size += file_path.stat().st_size
                        file_count += 1
                    except (OSError, IOError):
                        continue
            
            return {
                'total_files': file_count,
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'upload_path': str(self.upload_base_path)
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage stats: {e}")
            return {'error': str(e)}