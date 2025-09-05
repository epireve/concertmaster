#!/usr/bin/env python3
"""
ConcertMaster Backend - Temporary Bypass Version
Simple FastAPI server for testing and demonstration
"""
import os
import sys
from typing import Dict, List, Any, Optional
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

try:
    from fastapi import FastAPI, HTTPException, Depends
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import JSONResponse, FileResponse
    from pydantic import BaseModel, Field
    import uvicorn
    FASTAPI_AVAILABLE = True
    
    # Simple response models
    class HealthResponse(BaseModel):
        status: str = "healthy"
        message: str = "ConcertMaster Backend is running"
        mode: str = "bypass"
        timestamp: str = ""

    class FormSchema(BaseModel):
        id: Optional[str] = None
        name: str
        title: str
        description: Optional[str] = None
        version: str = "1.0.0"
        fields: List[Dict[str, Any]] = []
        sections: List[Dict[str, Any]] = []
        settings: Dict[str, Any] = {}
        styling: Dict[str, Any] = {}

    class WorkflowSchema(BaseModel):
        id: Optional[str] = None
        name: str
        description: Optional[str] = None
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        
except ImportError:
    print("⚠️  FastAPI not installed. Using minimal HTTP server mode...")
    FASTAPI_AVAILABLE = False

if FASTAPI_AVAILABLE:
    # Initialize FastAPI app
    app = FastAPI(
        title="ConcertMaster API - Bypass Mode",
        description="Temporary bypass API for testing and demonstration",
        version="1.0.0-bypass",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # In production, specify allowed origins
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # In-memory storage for bypass mode
    forms_db: Dict[str, FormSchema] = {}
    workflows_db: Dict[str, WorkflowSchema] = {}
    
    # Create sample data
    sample_form = FormSchema(
        id="sample-form",
        name="sample-form",
        title="Sample Data Collection Form",
        description="A sample form for testing the bypass mode",
        fields=[
            {
                "id": "name",
                "type": "text",
                "label": "Full Name",
                "required": True,
                "placeholder": "Enter your full name"
            },
            {
                "id": "email",
                "type": "email",
                "label": "Email Address",
                "required": True,
                "placeholder": "Enter your email"
            },
            {
                "id": "company",
                "type": "text",
                "label": "Company",
                "required": False,
                "placeholder": "Enter your company name"
            }
        ],
        settings={
            "allowMultipleSubmissions": False,
            "requireAuthentication": False,
            "showProgressBar": True,
            "submitButtonText": "Submit Form"
        }
    )
    
    sample_workflow = WorkflowSchema(
        id="sample-workflow",
        name="Sample Data Processing Workflow",
        description="A sample workflow for testing the bypass mode",
        nodes=[
            {
                "id": "start",
                "type": "trigger",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": "Form Submitted",
                    "type": "webhook",
                    "description": "Triggers when form is submitted"
                }
            },
            {
                "id": "process",
                "type": "transform",
                "position": {"x": 300, "y": 100},
                "data": {
                    "label": "Process Data",
                    "type": "transform",
                    "description": "Validates and transforms form data"
                }
            }
        ],
        edges=[
            {
                "id": "start-to-process",
                "source": "start",
                "target": "process",
                "type": "default"
            }
        ]
    )
    
    # Initialize sample data
    forms_db[sample_form.id] = sample_form
    workflows_db[sample_workflow.id] = sample_workflow

    # Routes
    @app.get("/", response_class=FileResponse)
    async def root():
        """Serve the frontend if available"""
        frontend_dist = Path(__file__).parent.parent / "frontend" / "dist" / "index.html"
        if frontend_dist.exists():
            return FileResponse(frontend_dist)
        return JSONResponse({
            "message": "ConcertMaster Backend - Bypass Mode",
            "status": "running",
            "frontend": "not built",
            "api_docs": "/api/docs"
        })

    @app.get("/api/health", response_model=HealthResponse)
    async def health_check():
        """Health check endpoint"""
        from datetime import datetime
        return HealthResponse(
            timestamp=datetime.utcnow().isoformat(),
            message="Backend is running in bypass mode"
        )

    @app.get("/api/forms", response_model=List[FormSchema])
    async def list_forms():
        """List all forms"""
        return list(forms_db.values())

    @app.get("/api/forms/{form_id}", response_model=FormSchema)
    async def get_form(form_id: str):
        """Get a specific form"""
        if form_id not in forms_db:
            raise HTTPException(status_code=404, detail="Form not found")
        return forms_db[form_id]

    @app.post("/api/forms", response_model=FormSchema)
    async def create_form(form: FormSchema):
        """Create a new form"""
        import uuid
        if not form.id:
            form.id = str(uuid.uuid4())
        forms_db[form.id] = form
        return form

    @app.put("/api/forms/{form_id}", response_model=FormSchema)
    async def update_form(form_id: str, form: FormSchema):
        """Update an existing form"""
        if form_id not in forms_db:
            raise HTTPException(status_code=404, detail="Form not found")
        form.id = form_id
        forms_db[form_id] = form
        return form

    @app.get("/api/workflows", response_model=List[WorkflowSchema])
    async def list_workflows():
        """List all workflows"""
        return list(workflows_db.values())

    @app.get("/api/workflows/{workflow_id}", response_model=WorkflowSchema)
    async def get_workflow(workflow_id: str):
        """Get a specific workflow"""
        if workflow_id not in workflows_db:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return workflows_db[workflow_id]

    @app.post("/api/workflows", response_model=WorkflowSchema)
    async def create_workflow(workflow: WorkflowSchema):
        """Create a new workflow"""
        import uuid
        if not workflow.id:
            workflow.id = str(uuid.uuid4())
        workflows_db[workflow.id] = workflow
        return workflow

    @app.post("/api/forms/{form_id}/submit")
    async def submit_form(form_id: str, data: Dict[str, Any]):
        """Submit form data"""
        if form_id not in forms_db:
            raise HTTPException(status_code=404, detail="Form not found")
        
        return {
            "status": "success",
            "message": f"Form {form_id} submitted successfully",
            "submission_id": f"sub_{form_id}_{len(str(data))}",
            "data": data
        }

    # Mount static files if frontend is built
    frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
    if frontend_dist.exists():
        app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")

else:
    # Fallback without FastAPI
    print("🚨 FastAPI not available. Creating minimal HTTP server...")
    
    def create_minimal_server():
        """Create a minimal HTTP server without FastAPI"""
        from http.server import HTTPServer, SimpleHTTPRequestHandler
        import json
        
        class BypassHandler(SimpleHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/api/health':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    response = {
                        "status": "healthy",
                        "message": "Minimal server running",
                        "mode": "minimal-bypass"
                    }
                    self.wfile.write(json.dumps(response).encode())
                else:
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    html = """
                    <html>
                    <head><title>ConcertMaster - Bypass Mode</title></head>
                    <body>
                        <h1>ConcertMaster Backend - Minimal Bypass Mode</h1>
                        <p>FastAPI is not installed. This is a minimal HTTP server for testing.</p>
                        <p>Install dependencies with: <code>pip install fastapi uvicorn</code></p>
                        <p>Health check: <a href="/api/health">/api/health</a></p>
                    </body>
                    </html>
                    """
                    self.wfile.write(html.encode())
        
        return HTTPServer, BypassHandler

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🚀 Starting ConcertMaster Backend - Bypass Mode")
    print(f"📍 Server: http://{host}:{port}")
    
    if FASTAPI_AVAILABLE:
        print(f"📚 API Docs: http://{host}:{port}/api/docs")
        print(f"🔧 Health Check: http://{host}:{port}/api/health")
        print("✅ FastAPI mode enabled")
        
        uvicorn.run(
            "main.bypass:app",
            host=host,
            port=port,
            reload=False,
            log_level="info"
        )
    else:
        print("⚠️  Minimal HTTP server mode (install FastAPI for full functionality)")
        HTTPServer, BypassHandler = create_minimal_server()
        server = HTTPServer((host, port), BypassHandler)
        
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
            server.server_close()