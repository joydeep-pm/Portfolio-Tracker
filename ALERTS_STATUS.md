# Alerts System Status Report

**Generated**: 2026-03-10
**TL;DR**: Alert infrastructure works perfectly, but **automatic alert generation rules are not implemented yet**.

---

## ✅ What's Built and Working

### 1. Alert Delivery Infrastructure (100% Working)
- ✅ Telegram integration via Apprise
- ✅ SQLite alert queue database
- ✅ Multi-channel support (Telegram + Notion)
- ✅ Delivery tracking and audit log
- ✅ Success/failure status tracking

**Test result**:
```json
{
  "sent": true,
  "deliveries": [{
    "channel": "telegram",
    "status": "success"
  }]
}
```

### 2. Alert Dispatch System (100% Working)
- ✅ Processes pending alerts from queue
- ✅ Sends to configured channels
- ✅ Updates alert status (pending → sent/failed)
- ✅ Records delivery metadata

**Endpoints working**:
- `/api/v1/alerts/test` - Send test alert
- `/api/v1/alerts/enqueue` - Queue alert for dispatch
- `/api/v1/alerts/dispatch` - Process queued alerts
- `/api/v1/alerts/events` - View alert history
- `/api/v1/alerts/channels/status` - Check channel connectivity

### 3. Cron Automation (Configured)
- ✅ External cron job on cron-job.org
- ✅ Calls `/api/alerts?route=dispatch` hourly
- ✅ Protected by `CRON_SECRET` auth
- ✅ Runs even when app is idle

**Status**: Infrastructure ready, runs hourly.

---

## ❌ What's NOT Implemented Yet

### Missing: Automatic Alert Generation Rules

**The UI shows these "Active Alert Rules"**:
1. ⚠️ **Macro / Regulatory Swings** - NOT IMPLEMENTED
2. ⚠️ **Technical Breakouts** - NOT IMPLEMENTED
3. ⚠️ **AI Agent Rebalances** - NOT IMPLEMENTED

**What this means**:
- No code monitors macro sentiment changes
- No code watches for technical breakouts
- No code detects AI rebalance suggestions
- **Nothing automatically creates pending alerts**

**How it currently works**:
```
User clicks "Test Channels"
  → Alert created manually
    → Cron dispatch sends it
      → Telegram receives it ✅

BUT:

Market conditions change
  → ❌ No monitoring code exists
    → ❌ No alert created
      → ❌ Nothing sent
```

---

## 🔧 What Needs to Be Built

To make alerts **automatic**, you need alert generation logic:

### Option A: Add Alert Rules to Existing Agents

Modify these files to create alerts when conditions are met:

**1. Macro Sentiment Alerts** (`api/_lib/macroContextEngine.js`)
```javascript
// After analyzing macro context
if (sentiment_score > 0.7 || sentiment_score < -0.7) {
  // CREATE ALERT: High conviction macro shift detected
  await enqueueAlert({
    title: `Macro Alert: ${key_catalyst}`,
    body: `Sentiment score: ${sentiment_score}. Impacted clusters: ${impacted_clusters.join(', ')}`,
    event_type: 'macro_swing',
    severity: 'high'
  });
}
```

**2. Technical Breakout Alerts** (`api/_lib/hotspotService.js` or `quant-engine/routers/technical.py`)
```javascript
// After PKScreener scan
if (scanFlags.includes('bullish_breakout') && userHoldsSymbol(symbol)) {
  await enqueueAlert({
    title: `Breakout Alert: ${symbol}`,
    body: `Candlestick pattern detected: ${pattern}`,
    event_type: 'technical_breakout',
    severity: 'medium'
  });
}
```

**3. AI Rebalance Alerts** (`api/_lib/multiAgentEngine.js`)
```javascript
// After portfolio analysis
if (action === 'SELL' && confidence > 0.7) {
  await enqueueAlert({
    title: `Portfolio Alert: Consider reducing ${symbol}`,
    body: `AI Decision: ${action} (${confidence}% confidence)\nRationale: ${rationale}`,
    event_type: 'ai_rebalance',
    severity: 'medium'
  });
}
```

### Option B: Create Dedicated Alert Monitor Service

Create `quant-engine/routers/alert_monitor.py`:
```python
@router.post("/monitor/scan")
def scan_and_alert():
    """Runs on cron, checks all conditions, enqueues alerts"""

    # 1. Check macro sentiment
    macro_alerts = check_macro_conditions()

    # 2. Check technical breakouts
    technical_alerts = check_technical_conditions()

    # 3. Check portfolio decisions
    portfolio_alerts = check_portfolio_conditions()

    # 4. Enqueue all alerts
    for alert in macro_alerts + technical_alerts + portfolio_alerts:
        enqueue_alert(alert)

    return {"alerts_created": len(...)}
```

Then cron calls TWO endpoints:
1. `/api/v1/alerts/monitor/scan` (checks conditions, creates alerts)
2. `/api/v1/alerts/dispatch` (sends queued alerts)

---

## 🎯 Recommended Implementation Plan

### Phase 1: High-Value Quick Win (2 hours)
**Goal**: Get 1 automatic alert working end-to-end

**Add Portfolio Decision Alert** (easiest):
1. Edit `api/_lib/multiAgentEngine.js`
2. After building recommendations, check for high-conviction SELL signals
3. Call enqueue endpoint for each match
4. Test: Force a SELL decision → verify alert arrives

**Files to modify**:
- `api/_lib/multiAgentEngine.js` (add alert enqueue logic)
- `api/agents.js` (add helper function to call enqueue)

**Test**:
```bash
# Trigger portfolio analysis
curl -X POST "https://portfolio-tracker-kappa-woad.vercel.app/api/v1/agents/analyze" \
  -H "Content-Type: application/json" \
  -d '{"symbols":["SBIN"],"exchange":"nse"}'

# Wait for cron (or manually trigger dispatch)
curl -X POST "https://portfolio-tracker-kappa-woad.vercel.app/api/alerts?route=dispatch"

# Check Telegram - should receive alert
```

---

### Phase 2: Technical Breakout Alerts (3 hours)
**Goal**: Alert when candlestick patterns detected on holdings

**Implementation**:
1. After PKScreener scan completes (`hotspotService.js` or `technical.py`)
2. Cross-reference scan results with portfolio holdings
3. Enqueue alert for bullish/bearish patterns on owned stocks

**Trigger**: Runs automatically when hotspot scan executes

---

### Phase 3: Macro Sentiment Alerts (2 hours)
**Goal**: Alert when macro score shifts significantly

**Implementation**:
1. After macro harvest (`api/_lib/macroContextEngine.js`)
2. Compare new sentiment_score to previous value (store in SQLite)
3. If delta > 0.3 (big shift), enqueue alert

**Trigger**: Runs when "Force Macro Harvest" executes

---

## 🧪 How to Test Alert Rules (When Built)

### Manual Testing Flow:
```bash
# 1. Trigger the condition monitor
# (depends on which rule you implement first)
# Example: Force portfolio analysis
curl -X POST "https://portfolio-tracker-kappa-woad.vercel.app/api/v1/agents/analyze"

# 2. Check if alerts were enqueued
curl "https://portfolio-tracker-kappa-woad.vercel.app/api/v1/alerts/events"
# Should show status: "pending"

# 3. Manually trigger dispatch (don't wait for cron)
curl -X POST "https://portfolio-tracker-kappa-woad.vercel.app/api/alerts?route=dispatch"

# 4. Check Telegram - alert should arrive

# 5. Verify status changed to "sent"
curl "https://portfolio-tracker-kappa-woad.vercel.app/api/v1/alerts/events"
```

---

## 📊 Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ALERT INFRASTRUCTURE                      │
│                     (100% Working)                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Enqueue    │    │   Dispatch   │    │  Telegram    │  │
│  │   Endpoint   │───▶│   Endpoint   │───▶│  Delivery    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ▲                    ▲                               │
│         │                    │                               │
│         │            ┌───────┴────────┐                     │
│         │            │  Cron Job      │                     │
│         │            │  (Every hour)  │                     │
│         │            └────────────────┘                     │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          │  ❌ MISSING CONNECTION
          │
┌─────────┴────────────────────────────────────────────────────┐
│              ALERT GENERATION RULES                           │
│                  (NOT IMPLEMENTED)                            │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ❌ Macro Monitor   (should check sentiment changes)         │
│  ❌ Breakout Monitor (should scan technical patterns)        │
│  ❌ Portfolio Monitor (should track AI decisions)            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**The gap**: Nothing calls `/enqueue` automatically based on market conditions.

---

## 🚀 Quick Start: Implement Your First Alert Rule

### **Implement Portfolio SELL Alert (Easiest, 30 minutes)**

I can help you add this right now. It will:
- Monitor portfolio AI decisions
- Create alert when high-conviction SELL appears
- Send to Telegram hourly (via cron)

**Want me to implement this for you now?**

---

## 🔐 Cron Security Note

Your handoff notes mention:
> `CRON_SECRET` value was exposed in a screenshot during debugging.
> Rotate secret immediately.

**Action needed**:
1. Generate new secret: `openssl rand -hex 32`
2. Update Vercel env: `CRON_SECRET=<new_value>`
3. Update cron-job.org Authorization header
4. Redeploy Vercel

---

## ✅ Summary

**What you have**:
- ✅ Working Telegram integration
- ✅ Alert queue and dispatch system
- ✅ Cron automation running hourly
- ✅ Full audit trail

**What's missing**:
- ❌ Macro sentiment change detector
- ❌ Technical breakout detector
- ❌ Portfolio decision monitor

**Bottom line**:
Your alerts infrastructure is **production-ready**, but you need to **connect the triggers**. The system can send alerts perfectly - it just needs to know **WHEN** to send them.

---

## 🎯 Next Steps

1. **Decide which alert rule to implement first**:
   - Portfolio decisions (easiest)
   - Technical breakouts (medium)
   - Macro swings (harder)

2. **I can implement it for you** (20-30 minutes per rule)

3. **Test manually** before relying on cron

4. **Rotate CRON_SECRET** for security

**Want me to build the first alert rule now?** I recommend starting with Portfolio SELL alerts since that's directly tied to your use case (c).
