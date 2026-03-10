#!/bin/bash
# Stop local Portfolio Tracker services

echo "🛑 Stopping Portfolio Tracker local services..."

# Stop Quant Engine
if [ -f /tmp/quant-engine.pid ]; then
    PID=$(cat /tmp/quant-engine.pid)
    kill $PID 2>/dev/null && echo "✅ Stopped Quant Engine (PID: $PID)" || echo "⚠️  Quant Engine already stopped"
    rm /tmp/quant-engine.pid
fi

# Stop Vercel Dev
if [ -f /tmp/vercel-dev.pid ]; then
    PID=$(cat /tmp/vercel-dev.pid)
    kill $PID 2>/dev/null && echo "✅ Stopped Vercel Dev (PID: $PID)" || echo "⚠️  Vercel Dev already stopped"
    rm /tmp/vercel-dev.pid
fi

# Kill by port if PID files missing
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "✅ Cleaned up port 8000"
lsof -ti:4173 | xargs kill -9 2>/dev/null && echo "✅ Cleaned up port 4173"

echo "✅ All services stopped"
