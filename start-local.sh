#!/bin/bash
# Start Portfolio Tracker Locally (While GitHub is Flagged)

echo "🚀 Starting Portfolio Tracker Locally..."
echo ""

# Colors
GREEN='\033[0.32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PORTFOLIO TRACKER - LOCAL MODE${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo ""

echo "📦 Step 1: Checking dependencies..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11+"
    exit 1
fi

if ! python3 -c "import fastapi" &> /dev/null; then
    echo "⚠️  FastAPI not installed. Installing core dependencies..."
    pip3 install --user -q fastapi uvicorn python-dotenv apprise yfinance pandas numpy PyPortfolioOpt vectorbt pydantic sentence-transformers faiss-cpu pypdf
fi

echo "✅ Dependencies OK"
echo ""

echo "🔧 Step 2: Starting Quant Engine (Port 8000)..."
cd "$(dirname "$0")/quant-engine"

# Kill any existing instance
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Start quant engine
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload > /tmp/quant-local.log 2>&1 &
QUANT_PID=$!
echo $QUANT_PID > /tmp/quant-engine.pid

echo "   Quant Engine PID: $QUANT_PID"
echo "   Log: /tmp/quant-local.log"
sleep 3

# Verify it started
if curl -sS http://127.0.0.1:8000/health > /dev/null 2>&1; then
    MODE=$(curl -sS http://127.0.0.1:8000/health | grep -o '"mode":"[^"]*' | cut -d'"' -f4)
    echo -e "   ${GREEN}✅ Quant Engine Running (Mode: $MODE)${NC}"
else
    echo "   ❌ Failed to start. Check /tmp/quant-local.log"
    tail -20 /tmp/quant-local.log
    exit 1
fi

echo ""
echo "🌐 Step 3: Starting Vercel Frontend (Port 4173)..."
cd "$(dirname "$0")"

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "QUANT_ENGINE_URL=http://127.0.0.1:8000" > .env.local
    echo "ENABLE_ANGEL_MARKET_DATA=true" >> .env.local
    echo "   Created .env.local"
fi

# Kill any existing Vercel process
lsof -ti:4173 | xargs kill -9 2>/dev/null

# Start Vercel dev server
npx vercel dev --listen 4173 > /tmp/vercel-local.log 2>&1 &
VERCEL_PID=$!
echo $VERCEL_PID > /tmp/vercel-dev.pid

echo "   Vercel Dev PID: $VERCEL_PID"
echo "   Log: /tmp/vercel-local.log"
sleep 5

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ ALL SERVICES RUNNING${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo "🌐 Open in browser:"
echo "   http://127.0.0.1:4173"
echo ""
echo "🧪 Test endpoints:"
echo "   curl http://127.0.0.1:8000/health"
echo "   curl http://127.0.0.1:4173/api/v1/market/bootstrap"
echo ""
echo "📋 Logs:"
echo "   Quant Engine: tail -f /tmp/quant-local.log"
echo "   Vercel Dev:   tail -f /tmp/vercel-local.log"
echo ""
echo "🛑 To stop:"
echo "   kill $(cat /tmp/quant-engine.pid) $(cat /tmp/vercel-dev.pid)"
echo "   # or run: ./stop-local.sh"
echo ""
