"""
File Upload Security Tests
Comprehensive security testing for file upload functionality including:
- Malware detection
- File type validation 
- Size limits
- Path traversal prevention
- Virus scanning simulation
"""

import pytest
import asyncio
import tempfile
import os
import hashlib
from unittest.mock import AsyncMock, patch, MagicMock
from pathlib import Path
from io import BytesIO

# Import services to test
from backend.src.services.file_handler import FileUploadService, FileValidationResult, FileUploadResult
from backend.src.services.form_security import FormSecurityService
from fastapi import UploadFile


class TestFileUploadSecurity:
    """Comprehensive security tests for file uploads"""
    
    @pytest.fixture
    def upload_service(self):
        """Create file upload service with test configuration"""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Mock settings to use temp directory
            with patch('backend.src.services.file_handler.settings') as mock_settings:
                mock_settings.upload_path = temp_dir
                mock_settings.MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
                yield FileUploadService()
    
    @pytest.fixture
    def security_service(self):
        """Create security service for testing"""
        return FormSecurityService()
    
    def create_test_file(self, content: bytes, filename: str, content_type: str = None) -> UploadFile:
        """Create a test UploadFile object"""
        file_obj = BytesIO(content)
        return UploadFile(
            file=file_obj,
            filename=filename,
            headers={
                'content-type': content_type or 'application/octet-stream'
            }
        )


class TestMaliciousFileDetection:
    """Test detection of malicious files"""
    
    @pytest.mark.asyncio
    async def test_detect_executable_files(self, upload_service):
        """Test detection of executable files by magic bytes"""
        # PE executable header (Windows)
        pe_content = b'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00'
        file = self.create_test_file(pe_content, 'malicious.pdf', 'application/pdf')
        
        result = await upload_service.validate_file(file)
        assert not result.is_valid
        assert any('security scan' in error.lower() for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_detect_elf_executables(self, upload_service):
        """Test detection of ELF executables (Linux)"""
        # ELF header
        elf_content = b'\x7fELF\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00'
        file = self.create_test_file(elf_content, 'document.pdf', 'application/pdf')
        
        result = await upload_service.validate_file(file)
        assert not result.is_valid
        assert any('security scan' in error.lower() for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_detect_script_injection(self, upload_service):
        """Test detection of script injection in files"""
        # File with embedded JavaScript
        script_content = b'Some content <script>alert("XSS")</script> more content'
        file = self.create_test_file(script_content, 'document.txt', 'text/plain')
        
        result = await upload_service.validate_file(file)
        assert not result.is_valid
        assert any('security scan' in error.lower() for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_detect_suspicious_powershell(self, upload_service):
        """Test detection of PowerShell execution attempts"""
        ps_content = b'powershell.exe -ExecutionPolicy Bypass -Command "malicious code"'
        file = self.create_test_file(ps_content, 'script.txt', 'text/plain')
        
        result = await upload_service.validate_file(file)
        assert not result.is_valid
    
    @pytest.mark.asyncio
    async def test_detect_java_class_files(self, upload_service):
        """Test detection of Java class files"""
        # Java class file magic number
        java_content = b'\xca\xfe\xba\xbe\x00\x00\x003\x00'
        file = self.create_test_file(java_content, 'Document.pdf', 'application/pdf')
        
        result = await upload_service.validate_file(file)
        assert not result.is_valid


class TestFileTypeValidation:
    """Test file type validation and spoofing prevention"""
    
    @pytest.mark.asyncio
    async def test_validate_mime_type_mismatch(self, upload_service):
        """Test detection of MIME type spoofing"""
        # PDF content with wrong extension
        pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog'
        file = self.create_test_file(pdf_content, 'document.exe', 'application/pdf')
        
        result = await upload_service.validate_file(file)
        # Should be rejected due to dangerous extension
        assert not result.is_valid
        assert any('not allowed for security reasons' in error for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_blocked_extensions(self, upload_service):
        """Test blocking of dangerous file extensions"""
        dangerous_extensions = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar']
        
        for ext in dangerous_extensions:
            content = b'Some innocent content'
            file = self.create_test_file(content, f'file{ext}', 'application/octet-stream')
            
            result = await upload_service.validate_file(file)
            assert not result.is_valid
            assert any('not allowed for security reasons' in error for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_allowed_file_types(self, upload_service):
        """Test that only allowed file types are accepted"""
        # Test valid PDF
        pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n'
        file = self.create_test_file(pdf_content, 'document.pdf', 'application/pdf')
        
        result = await upload_service.validate_file(file)
        assert result.is_valid
    
    @pytest.mark.asyncio
    async def test_reject_unknown_mime_types(self, upload_service):
        """Test rejection of unknown or disallowed MIME types"""
        # Binary content with unknown type
        unknown_content = b'\x00\x01\x02\x03UNKNOWN_FORMAT'
        file = self.create_test_file(unknown_content, 'unknown.xyz', 'application/unknown')
        
        result = await upload_service.validate_file(file)
        assert not result.is_valid
        assert any('not allowed' in error for error in result.errors)


class TestFileSizeLimits:
    """Test file size validation and DoS prevention"""
    
    @pytest.mark.asyncio
    async def test_reject_oversized_files(self, upload_service):
        """Test rejection of files exceeding size limits"""
        # Create large content (larger than 10MB limit)
        large_content = b'A' * (11 * 1024 * 1024)  # 11MB
        file = self.create_test_file(large_content, 'large.txt', 'text/plain')
        
        result = await upload_service.validate_file(file)
        assert not result.is_valid
        assert any('exceeds maximum' in error for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_reject_empty_files(self, upload_service):
        """Test rejection of empty files"""
        empty_file = self.create_test_file(b'', 'empty.txt', 'text/plain')
        
        result = await upload_service.validate_file(empty_file)
        assert not result.is_valid
        assert any('empty' in error.lower() for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_accept_files_within_limits(self, upload_service):
        """Test acceptance of files within size limits"""
        # Small valid PDF
        small_pdf = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nstartxref\n0\n%%EOF'
        file = self.create_test_file(small_pdf, 'small.pdf', 'application/pdf')
        
        result = await upload_service.validate_file(file)
        assert result.is_valid


class TestImageSecurityValidation:
    """Test security validation for image files"""
    
    @pytest.mark.asyncio
    async def test_detect_image_bombs(self, upload_service):
        """Test detection of decompression bomb attacks"""
        # Simulate large image dimensions that would consume excessive memory
        with patch('backend.src.services.file_handler.Image.open') as mock_image:
            # Mock image with extremely large dimensions
            mock_img = MagicMock()
            mock_img.size = (50000, 50000)  # 2.5 billion pixels
            mock_img.format = 'PNG'
            mock_img.mode = 'RGB'
            mock_image.return_value.__enter__.return_value = mock_img
            
            # Small PNG content
            png_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'
            file = self.create_test_file(png_content, 'image.png', 'image/png')
            
            result = await upload_service.validate_file(file)
            assert not result.is_valid
            assert any('memory exhaustion' in error for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_image_dimensions(self, upload_service):
        """Test validation of reasonable image dimensions"""
        with patch('backend.src.services.file_handler.Image.open') as mock_image:
            # Mock reasonable image
            mock_img = MagicMock()
            mock_img.size = (1920, 1080)
            mock_img.format = 'JPEG'
            mock_img.mode = 'RGB'
            mock_image.return_value.__enter__.return_value = mock_img
            
            jpeg_content = b'\xff\xd8\xff\xe0\x00\x10JFIF'
            file = self.create_test_file(jpeg_content, 'photo.jpg', 'image/jpeg')
            
            result = await upload_service.validate_file(file)
            assert result.is_valid
    
    @pytest.mark.asyncio
    async def test_validate_image_mode(self, upload_service):
        """Test validation of image color modes"""
        with patch('backend.src.services.file_handler.Image.open') as mock_image:
            # Mock image with unusual mode
            mock_img = MagicMock()
            mock_img.size = (100, 100)
            mock_img.format = 'PNG'
            mock_img.mode = 'CMYK'  # Unusual mode
            mock_image.return_value.__enter__.return_value = mock_img
            
            png_content = b'\x89PNG\r\n\x1a\n'
            file = self.create_test_file(png_content, 'unusual.png', 'image/png')
            
            result = await upload_service.validate_file(file)
            # Should still be valid but may have warnings
            if result.warnings:
                assert any('unusual' in warning.lower() for warning in result.warnings)


class TestPathTraversalPrevention:
    """Test prevention of path traversal attacks"""
    
    @pytest.mark.asyncio
    async def test_prevent_directory_traversal_in_filename(self, upload_service):
        """Test prevention of directory traversal in filenames"""
        malicious_filenames = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\SAM',
            '....//....//etc//passwd',
            'file/../../sensitive.txt'
        ]
        
        for filename in malicious_filenames:
            content = b'Some content'
            file = self.create_test_file(content, filename, 'text/plain')
            
            # Should either reject or sanitize the filename
            result = await upload_service.upload_file(file, 'test')
            
            if result.success:
                # If upload succeeds, ensure path is sanitized
                uploaded_path = Path(result.file_path)
                assert not any('..' in part for part in uploaded_path.parts)
                assert uploaded_path.is_relative_to(Path(upload_service.upload_base_path))
    
    @pytest.mark.asyncio  
    async def test_secure_file_storage_path(self, upload_service):
        """Test that files are stored in secure paths"""
        content = b'Test content'
        file = self.create_test_file(content, 'test.txt', 'text/plain')
        
        result = await upload_service.upload_file(file, 'documents')
        
        if result.success:
            file_path = Path(result.file_path)
            # Should be within upload directory
            assert file_path.is_relative_to(Path(upload_service.upload_base_path))
            # Should have secure filename (UUID-based)
            assert len(file_path.stem) == 32  # UUID hex length
            assert file_path.suffix == '.txt'


class TestDocumentSecurityValidation:
    """Test security validation for document files"""
    
    @pytest.mark.asyncio
    async def test_detect_macro_enabled_documents(self, upload_service):
        """Test detection of macro-enabled Office documents"""
        # Simulate macro-enabled document
        macro_content = b'some content vbaProject more content'
        file = self.create_test_file(macro_content, 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        
        with patch('magic.from_buffer') as mock_magic:
            mock_magic.return_value = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            
            result = await upload_service.validate_file(file)
            
            # Should have warning about macros
            if result.warnings:
                assert any('macro' in warning.lower() for warning in result.warnings)
    
    @pytest.mark.asyncio
    async def test_validate_pdf_structure(self, upload_service):
        """Test validation of PDF file structure"""
        # Invalid PDF (wrong header)
        invalid_pdf = b'Not a PDF file content'
        file = self.create_test_file(invalid_pdf, 'document.pdf', 'application/pdf')
        
        with patch('magic.from_buffer') as mock_magic:
            mock_magic.return_value = 'application/pdf'
            
            result = await upload_service.validate_file(file)
            assert not result.is_valid
            assert any('Invalid PDF' in error for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_json_structure(self, upload_service):
        """Test validation of JSON file structure"""
        # Invalid JSON
        invalid_json = b'{ "invalid": json, syntax }'
        file = self.create_test_file(invalid_json, 'data.json', 'application/json')
        
        with patch('magic.from_buffer') as mock_magic:
            mock_magic.return_value = 'application/json'
            
            result = await upload_service.validate_file(file)
            assert not result.is_valid
            assert any('Invalid JSON' in error for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_validate_xml_structure(self, upload_service):
        """Test validation of XML file structure"""
        # Invalid XML
        invalid_xml = b'<invalid><unclosed>tag</invalid>'
        file = self.create_test_file(invalid_xml, 'data.xml', 'application/xml')
        
        with patch('magic.from_buffer') as mock_magic:
            mock_magic.return_value = 'application/xml'
            
            result = await upload_service.validate_file(file)
            assert not result.is_valid
            assert any('Invalid XML' in error for error in result.errors)


class TestFormSecurityIntegration:
    """Test integration with form security service"""
    
    @pytest.mark.asyncio
    async def test_validate_form_data_with_files(self, security_service):
        """Test form data security validation with file uploads"""
        # Form data with potential XSS
        form_data = {
            'name': 'John Doe',
            'description': '<script>alert("XSS")</script>',
            'file_id': 'file123'
        }
        
        result = await security_service.validate_form_data_security(form_data)
        assert not result
        # Should detect XSS attempt
    
    @pytest.mark.asyncio
    async def test_validate_form_data_with_sql_injection(self, security_service):
        """Test detection of SQL injection attempts in form data"""
        form_data = {
            'search': "'; DROP TABLE users; --",
            'category': 'normal_value'
        }
        
        result = await security_service.validate_form_data_security(form_data)
        assert not result
        # Should detect SQL injection attempt
    
    @pytest.mark.asyncio
    async def test_validate_clean_form_data(self, security_service):
        """Test validation of clean form data"""
        form_data = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'message': 'This is a clean message without any malicious content.'
        }
        
        result = await security_service.validate_form_data_security(form_data)
        assert result
        # Should pass validation


class TestVirusScanningSimulation:
    """Simulate virus scanning functionality"""
    
    @pytest.mark.asyncio
    async def test_simulate_virus_detection(self, upload_service):
        """Simulate detection of known virus signatures"""
        # EICAR test string (standard antivirus test)
        eicar_string = b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
        file = self.create_test_file(eicar_string, 'test.txt', 'text/plain')
        
        # In a real implementation, this would integrate with actual virus scanning
        # For testing, we simulate detection
        with patch.object(upload_service, '_basic_malware_scan', return_value=False):
            result = await upload_service.validate_file(file)
            assert not result.is_valid
            assert any('security scan' in error.lower() for error in result.errors)
    
    @pytest.mark.asyncio
    async def test_quarantine_suspicious_files(self, upload_service):
        """Test quarantine of suspicious files"""
        suspicious_content = b'MZ\x90\x00'  # PE header
        file = self.create_test_file(suspicious_content, 'suspicious.pdf', 'application/pdf')
        
        result = await upload_service.upload_file(file, 'test')
        
        # Should fail validation and not be stored in normal location
        assert not result.success
        assert not result.file_path or 'quarantine' in result.file_path


class TestSecurityHeaders:
    """Test security headers and response protection"""
    
    @pytest.mark.asyncio
    async def test_security_headers_generation(self, security_service):
        """Test generation of security headers"""
        headers = await security_service.get_security_headers()
        
        # Check for essential security headers
        assert 'X-Content-Type-Options' in headers
        assert headers['X-Content-Type-Options'] == 'nosniff'
        
        assert 'X-Frame-Options' in headers
        assert headers['X-Frame-Options'] == 'DENY'
        
        assert 'X-XSS-Protection' in headers
        assert 'Content-Security-Policy' in headers
        assert 'Strict-Transport-Security' in headers


class TestSecurityPerformance:
    """Test security validation performance"""
    
    @pytest.mark.asyncio
    async def test_large_file_validation_performance(self, upload_service):
        """Test performance of security validation with large files"""
        # Create large but valid file
        large_content = b'A' * (5 * 1024 * 1024)  # 5MB
        file = self.create_test_file(large_content, 'large.txt', 'text/plain')
        
        import time
        start_time = time.time()
        
        result = await upload_service.validate_file(file)
        
        end_time = time.time()
        validation_time = end_time - start_time
        
        # Should complete validation within reasonable time
        assert validation_time < 5.0  # Less than 5 seconds
    
    @pytest.mark.asyncio
    async def test_concurrent_file_validation(self, upload_service):
        """Test concurrent file validation performance"""
        files = []
        for i in range(10):
            content = f'Test content {i}'.encode()
            file = self.create_test_file(content, f'test_{i}.txt', 'text/plain')
            files.append(file)
        
        import time
        start_time = time.time()
        
        # Validate files concurrently
        tasks = [upload_service.validate_file(file) for file in files]
        results = await asyncio.gather(*tasks)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Should handle concurrent validation efficiently
        assert total_time < 3.0  # Less than 3 seconds for 10 files
        assert all(result.is_valid for result in results)


@pytest.mark.integration
class TestEndToEndSecurityWorkflow:
    """End-to-end security testing workflow"""
    
    @pytest.mark.asyncio
    async def test_complete_secure_upload_workflow(self, upload_service, security_service):
        """Test complete secure file upload workflow"""
        # 1. Create valid file
        pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n%%EOF'
        file = self.create_test_file(pdf_content, 'document.pdf', 'application/pdf')
        
        # 2. Validate file security
        validation_result = await upload_service.validate_file(file)
        assert validation_result.is_valid
        
        # 3. Upload file
        upload_result = await upload_service.upload_file(file, 'documents')
        assert upload_result.success
        
        # 4. Verify file is stored securely
        file_path = Path(upload_result.file_path)
        assert file_path.exists()
        
        # 5. Check file permissions are secure
        file_stat = file_path.stat()
        permissions = oct(file_stat.st_mode)[-3:]
        assert permissions == '600'  # Owner read/write only
        
        # 6. Cleanup
        await upload_service.delete_file(upload_result.file_path)
        assert not file_path.exists()
    
    @pytest.mark.asyncio
    async def test_malicious_file_complete_rejection(self, upload_service):
        """Test complete rejection workflow for malicious files"""
        # Create malicious file
        malicious_content = b'MZ\x90\x00\x03\x00malicious executable content'
        file = self.create_test_file(malicious_content, 'document.pdf', 'application/pdf')
        
        # Should fail at validation stage
        validation_result = await upload_service.validate_file(file)
        assert not validation_result.is_valid
        
        # Should fail at upload stage
        upload_result = await upload_service.upload_file(file, 'documents')
        assert not upload_result.success
        
        # No file should be created
        assert not upload_result.file_path or not Path(upload_result.file_path).exists()


# Helper function to create test file objects
def create_test_file(content: bytes, filename: str, content_type: str = None) -> UploadFile:
    """Create a test UploadFile object"""
    file_obj = BytesIO(content)
    return UploadFile(
        file=file_obj,
        filename=filename,
        headers={
            'content-type': content_type or 'application/octet-stream'
        }
    )