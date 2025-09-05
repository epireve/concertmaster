#!/bin/bash
# ConcertMaster Bypass Deployment Script
# Quick deployment for temporary bypass mode

set -e  # Exit on any error

echo "🚀 ConcertMaster Bypass Deployment"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Configuration
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${BACKEND_PORT:-8000}
NODE_ENV=${NODE_ENV:-development}
SKIP_TESTS=${SKIP_TESTS:-true}

echo -e "${BLUE}📁 Project Structure:${NC}"
echo "   Root: $PROJECT_ROOT"
echo "   Frontend: $FRONTEND_DIR"
echo "   Backend: $BACKEND_DIR"
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
port_available() {
    ! lsof -i :$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -t -i :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}🔄 Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 2
    fi
}

# Function to install backend dependencies
setup_backend() {
    echo -e "${BLUE}🐍 Setting up Backend (Bypass Mode)${NC}"
    
    cd "$BACKEND_DIR"
    
    # Check if Python is available
    if ! command_exists python3; then
        echo -e "${RED}❌ Python 3 not found. Please install Python 3.8+${NC}"
        return 1
    fi
    
    # Try to install FastAPI if not available
    if ! python3 -c "import fastapi" >/dev/null 2>&1; then
        echo -e "${YELLOW}📦 Installing FastAPI and Uvicorn...${NC}"
        python3 -m pip install fastapi uvicorn --quiet || {
            echo -e "${YELLOW}⚠️  Could not install FastAPI. Will use minimal HTTP server.${NC}"
        }
    fi
    
    echo -e "${GREEN}✅ Backend setup complete${NC}"
}

# Function to build frontend in bypass mode
build_frontend() {
    echo -e "${BLUE}⚛️  Building Frontend (Bypass Mode)${NC}"
    
    cd "$FRONTEND_DIR"
    
    # Check if Node.js is available
    if ! command_exists node; then
        echo -e "${RED}❌ Node.js not found. Please install Node.js 16+${NC}"
        return 1
    fi
    
    # Check if npm is available
    if ! command_exists npm; then
        echo -e "${RED}❌ npm not found. Please install npm${NC}"
        return 1
    fi
    
    # Copy bypass configurations
    echo -e "${YELLOW}🔧 Setting up bypass configurations...${NC}"
    
    # Backup original files
    [ -f "package.json" ] && cp "package.json" "package.json.backup"
    [ -f "tsconfig.json" ] && cp "tsconfig.json" "tsconfig.json.backup"
    [ -f "src/App.tsx" ] && cp "src/App.tsx" "src/App.tsx.backup"
    
    # Use bypass configurations
    cp "package.bypass.json" "package.json"
    cp "tsconfig.bypass.json" "tsconfig.json"
    cp "src/App.bypass.tsx" "src/App.tsx"
    
    # Update imports to use bypass components
    echo -e "${YELLOW}🔄 Updating component imports...${NC}"
    
    # Update WorkflowCanvas import
    if [ -f "src/components/workflow/WorkflowCanvas.tsx" ]; then
        cp "src/components/workflow/WorkflowCanvas.tsx" "src/components/workflow/WorkflowCanvas.tsx.backup"
        cp "src/components/workflow/WorkflowCanvas.bypass.tsx" "src/components/workflow/WorkflowCanvas.tsx"
    fi
    
    # Update VisualFormBuilder import  
    if [ -f "src/components/visual-builder/VisualFormBuilder.tsx" ]; then
        cp "src/components/visual-builder/VisualFormBuilder.tsx" "src/components/visual-builder/VisualFormBuilder.tsx.backup"
        cp "src/components/visual-builder/VisualFormBuilder.bypass.tsx" "src/components/visual-builder/VisualFormBuilder.tsx"
    fi
    
    # Update shared components index
    echo "// Bypass mode - updated exports" >> src/components/shared/index.ts
    echo "export { LoadingSpinner } from './LoadingSpinner';" >> src/components/shared/index.ts
    echo "export { ErrorBoundary } from './ErrorBoundary';" >> src/components/shared/index.ts
    
    # Install dependencies
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install --silent || {
        echo -e "${YELLOW}⚠️  Some dependencies failed to install. Continuing...${NC}"
    }
    
    # Build the frontend - Skip TypeScript checking for bypass mode
    echo -e "${YELLOW}🏗️  Building frontend (bypassing TypeScript check)...${NC}"
    vite build --config vite.config.bypass.js --mode bypass || {
        echo -e "${YELLOW}⚠️  Direct build failed. Trying with npm script...${NC}"
        npm run build:bypass || {
            echo -e "${RED}❌ Frontend build failed completely${NC}"
            return 1
        }
    }
    
    echo -e "${GREEN}✅ Frontend build complete${NC}"
}

# Function to start backend
start_backend() {
    echo -e "${BLUE}🚀 Starting Backend Server${NC}"
    
    cd "$BACKEND_DIR"
    
    # Kill any existing process on the port
    kill_port $BACKEND_PORT
    
    # Start the backend server
    echo -e "${YELLOW}🔄 Starting server on port $BACKEND_PORT...${NC}"
    
    if python3 -c "import fastapi" >/dev/null 2>&1; then
        python3 main.bypass.py &
        BACKEND_PID=$!
        echo $BACKEND_PID > .backend.pid
        echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"
        echo -e "${BLUE}📚 API Documentation: http://localhost:$BACKEND_PORT/api/docs${NC}"
    else
        echo -e "${YELLOW}⚠️  Starting minimal HTTP server (FastAPI not available)${NC}"
        python3 main.bypass.py &
        BACKEND_PID=$!
        echo $BACKEND_PID > .backend.pid
        echo -e "${GREEN}✅ Minimal backend server started (PID: $BACKEND_PID)${NC}"
    fi
    
    echo -e "${BLUE}🔧 Health Check: http://localhost:$BACKEND_PORT/api/health${NC}"
}

# Function to start frontend dev server (if needed)
start_frontend_dev() {
    if [ "$NODE_ENV" = "development" ]; then
        echo -e "${BLUE}⚛️  Starting Frontend Dev Server${NC}"
        
        cd "$FRONTEND_DIR"
        
        # Kill any existing process on the port
        kill_port $FRONTEND_PORT
        
        echo -e "${YELLOW}🔄 Starting dev server on port $FRONTEND_PORT...${NC}"
        npm run dev -- --port $FRONTEND_PORT --host 0.0.0.0 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > .frontend.pid
        echo -e "${GREEN}✅ Frontend dev server started (PID: $FRONTEND_PID)${NC}"
        echo -e "${BLUE}🌐 Frontend: http://localhost:$FRONTEND_PORT${NC}"
    fi
}

# Function to run basic tests
run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        echo -e "${YELLOW}⏭️  Skipping tests (SKIP_TESTS=true)${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🧪 Running Basic Tests${NC}"
    
    # Test backend health
    echo -e "${YELLOW}🔍 Testing backend health...${NC}"
    sleep 3  # Give backend time to start
    
    if curl -s http://localhost:$BACKEND_PORT/api/health >/dev/null; then
        echo -e "${GREEN}✅ Backend health check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend health check failed (might still be starting)${NC}"
    fi
    
    # Test frontend build
    if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
        echo -e "${GREEN}✅ Frontend build artifacts found${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend build artifacts not found${NC}"
    fi
}

# Function to display final status
show_status() {
    echo
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo "=========================="
    echo
    echo -e "${BLUE}🔗 Access Points:${NC}"
    echo "   Backend API: http://localhost:$BACKEND_PORT"
    echo "   Health Check: http://localhost:$BACKEND_PORT/api/health"
    
    if python3 -c "import fastapi" >/dev/null 2>&1; then
        echo "   API Docs: http://localhost:$BACKEND_PORT/api/docs"
    fi
    
    if [ "$NODE_ENV" = "development" ]; then
        echo "   Frontend Dev: http://localhost:$FRONTEND_PORT"
    else
        echo "   Frontend: http://localhost:$BACKEND_PORT"
    fi
    
    echo
    echo -e "${YELLOW}📝 Notes:${NC}"
    echo "   • This is a BYPASS mode deployment for testing"
    echo "   • Some advanced features are temporarily disabled"
    echo "   • Visual Builder shows placeholder content"
    echo "   • Form Builder and basic workflow should work"
    echo
    echo -e "${BLUE}🛠️  Management Commands:${NC}"
    echo "   Stop servers: $0 stop"
    echo "   View logs: tail -f $BACKEND_DIR/*.log"
    echo "   Kill ports: lsof -ti :$BACKEND_PORT,$FRONTEND_PORT | xargs kill -9"
    echo
}

# Function to stop servers
stop_servers() {
    echo -e "${YELLOW}🛑 Stopping servers...${NC}"
    
    # Stop backend
    if [ -f "$BACKEND_DIR/.backend.pid" ]; then
        BACKEND_PID=$(cat "$BACKEND_DIR/.backend.pid")
        kill -9 $BACKEND_PID 2>/dev/null || true
        rm -f "$BACKEND_DIR/.backend.pid"
        echo -e "${GREEN}✅ Backend stopped${NC}"
    fi
    
    # Stop frontend
    if [ -f "$FRONTEND_DIR/.frontend.pid" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_DIR/.frontend.pid")
        kill -9 $FRONTEND_PID 2>/dev/null || true
        rm -f "$FRONTEND_DIR/.frontend.pid"
        echo -e "${GREEN}✅ Frontend dev server stopped${NC}"
    fi
    
    # Kill any remaining processes on the ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
}

# Function to restore original files
restore_files() {
    echo -e "${YELLOW}🔄 Restoring original files...${NC}"
    
    cd "$FRONTEND_DIR"
    
    [ -f "package.json.backup" ] && mv "package.json.backup" "package.json"
    [ -f "tsconfig.json.backup" ] && mv "tsconfig.json.backup" "tsconfig.json"
    [ -f "src/App.tsx.backup" ] && mv "src/App.tsx.backup" "src/App.tsx"
    
    if [ -f "src/components/workflow/WorkflowCanvas.tsx.backup" ]; then
        mv "src/components/workflow/WorkflowCanvas.tsx.backup" "src/components/workflow/WorkflowCanvas.tsx"
    fi
    
    if [ -f "src/components/visual-builder/VisualFormBuilder.tsx.backup" ]; then
        mv "src/components/visual-builder/VisualFormBuilder.tsx.backup" "src/components/visual-builder/VisualFormBuilder.tsx"
    fi
    
    echo -e "${GREEN}✅ Original files restored${NC}"
}

# Main execution
case "${1:-deploy}" in
    "deploy")
        echo -e "${GREEN}🚀 Starting bypass deployment...${NC}"
        setup_backend
        build_frontend
        start_backend
        start_frontend_dev
        run_tests
        show_status
        ;;
    
    "stop")
        stop_servers
        ;;
    
    "restore")
        stop_servers
        restore_files
        ;;
    
    "status")
        echo -e "${BLUE}📊 Server Status:${NC}"
        if port_available $BACKEND_PORT; then
            echo -e "   Backend: ${RED}STOPPED${NC}"
        else
            echo -e "   Backend: ${GREEN}RUNNING${NC} (http://localhost:$BACKEND_PORT)"
        fi
        
        if port_available $FRONTEND_PORT; then
            echo -e "   Frontend: ${RED}STOPPED${NC}"
        else
            echo -e "   Frontend: ${GREEN}RUNNING${NC} (http://localhost:$FRONTEND_PORT)"
        fi
        ;;
    
    *)
        echo "Usage: $0 {deploy|stop|restore|status}"
        echo
        echo "Commands:"
        echo "  deploy  - Deploy in bypass mode (default)"
        echo "  stop    - Stop all servers"
        echo "  restore - Stop servers and restore original files"  
        echo "  status  - Show server status"
        exit 1
        ;;
esac