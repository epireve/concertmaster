#!/bin/bash
# Quick test script for bypass mode deployment

set -e

echo "🧪 Testing ConcertMaster Bypass Mode"
echo "===================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}📁 Project Root: $PROJECT_ROOT${NC}"

# Test 1: Check if bypass files exist
echo -e "\n${BLUE}🔍 Test 1: Checking bypass files...${NC}"
test_files=(
    "frontend/src/utils/iconFallbacks.tsx"
    "frontend/src/App.bypass.tsx"
    "frontend/tsconfig.bypass.json"
    "frontend/package.bypass.json"
    "frontend/src/components/visual-builder/VisualFormBuilder.bypass.tsx"
    "frontend/src/components/shared/ErrorBoundary.tsx"
    "frontend/src/components/shared/LoadingSpinner.tsx"
    "backend/main.bypass.py"
    "scripts/bypass-deploy.sh"
)

missing_files=()
for file in "${test_files[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        echo -e "   ✅ $file"
    else
        echo -e "   ❌ $file"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All bypass files present${NC}"
else
    echo -e "${RED}❌ Missing ${#missing_files[@]} files${NC}"
    exit 1
fi

# Test 2: Check Python availability
echo -e "\n${BLUE}🔍 Test 2: Checking Python environment...${NC}"
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "   ✅ Python: $PYTHON_VERSION"
else
    echo -e "   ❌ Python 3 not found"
    exit 1
fi

# Test 3: Check Node.js availability
echo -e "\n${BLUE}🔍 Test 3: Checking Node.js environment...${NC}"
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "   ✅ Node.js: $NODE_VERSION"
else
    echo -e "   ❌ Node.js not found"
    exit 1
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "   ✅ NPM: $NPM_VERSION"
else
    echo -e "   ❌ NPM not found"
    exit 1
fi

# Test 4: Check FastAPI availability (optional)
echo -e "\n${BLUE}🔍 Test 4: Checking FastAPI availability...${NC}"
if python3 -c "import fastapi" >/dev/null 2>&1; then
    echo -e "   ✅ FastAPI available (full backend mode)"
else
    echo -e "   ⚠️  FastAPI not available (minimal HTTP server mode)"
fi

# Test 5: Quick syntax check on Python backend
echo -e "\n${BLUE}🔍 Test 5: Python syntax check...${NC}"
if python3 -m py_compile "$PROJECT_ROOT/backend/main.bypass.py" 2>/dev/null; then
    echo -e "   ✅ Backend Python syntax valid"
else
    echo -e "   ❌ Backend Python syntax error"
    exit 1
fi

# Test 6: Quick TypeScript check on bypass config
echo -e "\n${BLUE}🔍 Test 6: TypeScript config validation...${NC}"
cd "$PROJECT_ROOT/frontend"
if [ -f "tsconfig.bypass.json" ]; then
    # Check if the file exists and has basic structure (TypeScript configs allow comments)
    if grep -q '"compilerOptions"' tsconfig.bypass.json && grep -q '"include"' tsconfig.bypass.json; then
        echo -e "   ✅ TypeScript bypass config has required sections"
    else
        echo -e "   ❌ TypeScript bypass config missing required sections"
        exit 1
    fi
else
    echo -e "   ❌ TypeScript bypass config not found"
    exit 1
fi

# Test 7: Check if ports are available
echo -e "\n${BLUE}🔍 Test 7: Checking port availability...${NC}"
BACKEND_PORT=8000
FRONTEND_PORT=3000

check_port() {
    if lsof -i :$1 >/dev/null 2>&1; then
        return 1  # Port in use
    else
        return 0  # Port available
    fi
}

if check_port $BACKEND_PORT; then
    echo -e "   ✅ Backend port $BACKEND_PORT available"
else
    echo -e "   ⚠️  Backend port $BACKEND_PORT in use (will be killed during deployment)"
fi

if check_port $FRONTEND_PORT; then
    echo -e "   ✅ Frontend port $FRONTEND_PORT available"
else
    echo -e "   ⚠️  Frontend port $FRONTEND_PORT in use (will be killed during deployment)"
fi

# Test 8: Try a quick build test (without full install)
echo -e "\n${BLUE}🔍 Test 8: Quick build preparation test...${NC}"
cd "$PROJECT_ROOT/frontend"

# Check if we can read the main package.json
if [ -f "package.json" ]; then
    echo -e "   ✅ Frontend package.json exists"
else
    echo -e "   ❌ Frontend package.json missing"
    exit 1
fi

# Check if we have basic React files
if [ -f "src/App.tsx" ]; then
    echo -e "   ✅ Main App.tsx exists"
else
    echo -e "   ❌ Main App.tsx missing"
    exit 1
fi

echo -e "\n${GREEN}🎉 All bypass mode tests passed!${NC}"
echo "=================================="
echo -e "${BLUE}📋 Test Summary:${NC}"
echo "   ✅ Bypass files created and present"
echo "   ✅ Python 3 environment ready"
echo "   ✅ Node.js environment ready"
echo "   ✅ Backend syntax validated"
echo "   ✅ TypeScript config validated"
echo "   ✅ Ports checked"
echo "   ✅ Basic file structure verified"
echo
echo -e "${GREEN}🚀 Ready for deployment!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "   1. Run: $SCRIPT_DIR/bypass-deploy.sh"
echo "   2. Wait for servers to start"
echo "   3. Test at: http://localhost:8000 (or :3000 for dev mode)"
echo
echo -e "${BLUE}💡 Deployment modes:${NC}"
echo "   Production: NODE_ENV=production $SCRIPT_DIR/bypass-deploy.sh"
echo "   Development: NODE_ENV=development $SCRIPT_DIR/bypass-deploy.sh"
echo "   Quick test: SKIP_TESTS=false $SCRIPT_DIR/bypass-deploy.sh"