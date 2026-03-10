#!/bin/bash
# Test all quant-engine endpoints after deployment

QUANT_URL="https://portfolio-tracker-if7l.onrender.com"

echo "🧪 Testing Quant Engine Endpoints..."
echo "======================================"
echo ""

# Test 1: Health check
echo "1️⃣  Testing /health..."
HEALTH=$(curl -sS "$QUANT_URL/health" -w "\nHTTP:%{http_code}")
echo "$HEALTH"
echo ""

# Test 2: Alerts test
echo "2️⃣  Testing /api/v1/alerts/test..."
ALERTS=$(curl -sS "$QUANT_URL/api/v1/alerts/test" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Testing","channels":["telegram"]}' \
  -w "\nHTTP:%{http_code}")
echo "$ALERTS"
echo ""

# Test 3: Backtest (should work after fix)
echo "3️⃣  Testing /api/v1/quant/backtests/thematic-rotation..."
BACKTEST=$(curl -sS "$QUANT_URL/api/v1/quant/backtests/thematic-rotation" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"tickers":["SBIN.NS","TCS.NS"],"lookback_years":5,"initial_capital":100000}' \
  -w "\nHTTP:%{http_code}")
echo "$BACKTEST" | head -20
echo ""

# Test 4: Allocation (should work after fix)
echo "4️⃣  Testing /api/v1/quant/optimize-allocation..."
ALLOCATION=$(curl -sS "$QUANT_URL/api/v1/quant/optimize-allocation" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"tickers":["RELIANCE.NS","TCS.NS","INFY.NS"],"total_capital":100000}' \
  -w "\nHTTP:%{http_code}")
echo "$ALLOCATION" | head -20
echo ""

# Test 5: Alert events
echo "5️⃣  Testing /api/v1/alerts/events..."
EVENTS=$(curl -sS "$QUANT_URL/api/v1/alerts/events" -w "\nHTTP:%{http_code}")
echo "$EVENTS" | head -20
echo ""

echo "======================================"
echo "✅ Test complete!"
echo ""
echo "Expected results:"
echo "  - Health: mode should be 'full-engine' (not 'alerts-only')"
echo "  - Alerts: HTTP:200 with deliveries"
echo "  - Backtest: HTTP:200 with metrics (not 404)"
echo "  - Allocation: HTTP:200 with weights (not 404)"
echo "  - Events: HTTP:200 with events array"
