# Portfolio Tracker User Guide

## 🚀 Quick Start (Start Here!)

### Your App URLs
- **Production (Live)**: https://portfolio-tracker-kappa-woad.vercel.app
- **Local Dev**: Run `npx vercel dev --listen 4173` then open http://127.0.0.1:4173

### First-Time Setup Checklist
- [ ] Open the production URL above
- [ ] Connect your Zerodha account (Portfolio view → "Reconnect Zerodha" button)
- [ ] Navigate to **Themes** view to see 175 micro-clusters across 2,486 stocks
- [ ] Go to **Portfolio** view to see your holdings with AI decisions
- [ ] Check **Alerts** view to test Telegram notifications

---

## 📊 Your 4 Use Cases Explained

### a) Theme Trackers for Sector Rotation & Money Flow

**What it does**: Shows you where money is moving across 175 Indian micro-clusters in real-time.

**How to use it**:

1. **Go to Themes View** (default landing page)
   - You'll see a grid of colored cells representing each micro-cluster
   - Color = performance (red = down, green = up)
   - Size/intensity = magnitude of movement

2. **Identify sector rotation**:
   - Click "Movers" button to filter only rising themes
   - Click "Laggards" to see what's falling
   - Search for specific sectors (e.g., "PSU Banks", "IT Services")

3. **Advanced: Use Comparison View**
   - Navigate to **Comparison** tab
   - Select 3-5 clusters to compare (e.g., "IT Services", "FMCG", "Auto OEM")
   - Choose timeframe (1D, 5D, 1M, 6M, YTD)
   - The chart shows normalized returns - **which cluster is outperforming**

4. **Check Momentum Radar**:
   - In Comparison view, scroll to "Momentum Radar" panel
   - Shows technical breakouts/consolidations across themes
   - **This tells you which sectors have technical momentum**

**Money Flow Indicator**:
- Green clusters gaining = money flowing IN
- Red clusters weakening = money flowing OUT
- Use 5D and 1M timeframes to spot rotation trends

---

### b) Backtesting Feature

**What it does**: Tests how a momentum-rotation strategy would have performed over 5 years using real India market data.

**How to use it**:

1. **Navigate to Comparison View**
2. **Scroll to Momentum Radar panel** (right sidebar)
3. **Click "Run 5-Year Backtest" button**
   - This runs a 50/200 SMA crossover strategy on the top momentum cluster
   - Powered by Python vectorbt engine

4. **Read the results**:
   - **Win Rate**: % of profitable periods
   - **Max Drawdown**: Worst peak-to-trough decline
   - **CAGR**: Annualized return
   - **Sharpe Ratio**: Risk-adjusted returns

5. **Interpret for decisions**:
   - High win rate + low drawdown = reliable momentum signal
   - Negative CAGR = avoid that cluster/strategy
   - Compare multiple clusters to find best risk/reward

**Example**: If you see IT Services has 65% win rate, 15% max drawdown, and 12% CAGR, it's a strong momentum play.

---

### c) Accumulate/Buy/Sell Decisions on Portfolio Holdings

**What it does**: AI-powered decision engine that analyzes your Zerodha holdings and recommends BUY/ACCUMULATE/HOLD/REDUCE/SELL with explanations.

**How to use it**:

1. **Connect Zerodha**:
   - Go to **Portfolio** view
   - Click "Reconnect Zerodha" if status shows "Disconnected"
   - Complete Zerodha login flow
   - Your holdings will auto-load

2. **View AI Decisions**:
   - Each holding shows a colored decision badge:
     - 🟢 **BUY**: Strong bullish signal
     - 🔵 **ACCUMULATE**: Add more on dips
     - ⚪ **HOLD**: Neutral, maintain position
     - 🟡 **REDUCE**: Trim position
     - 🔴 **SELL**: Exit recommended

3. **Understand WHY**:
   - Click on any row in the portfolio table
   - Right panel shows **"Signal Rationale"** with:
     - Technical context (momentum, breakout flags)
     - Macro sentiment (regulatory/policy impact)
     - Transcript summary (earnings insights)
     - Risk flags and confidence score

4. **Filter by decision**:
   - Use pill buttons at top: "Buy", "Accumulate", "Hold", "Reduce", "Sell"
   - Focus on actionable signals (Buy/Sell)

5. **Advanced: Optimal Sizing**:
   - Go to **Signals & Analysis** view
   - Select a stock from your portfolio in "Focus Selector"
   - Click "Calculate Optimal Sizing"
   - Shows how much ₹ to allocate based on max-Sharpe portfolio optimization

**Pro Tip**: Don't follow AI blindly. Use the rationale panel to understand the "why" behind each decision. Look for confluence of technical + macro + fundamentals.

---

### d) Alerts to Telegram for New Ideas

**What it does**: Sends automated notifications to your Telegram when:
- Macro/regulatory sentiment shifts
- Technical breakouts detected on holdings
- AI suggests rebalance/rotation

**How to set up**:

1. **Configure Telegram** (one-time setup):
   - Create a Telegram bot via [@BotFather](https://t.me/botfather)
   - Get your bot token and chat ID
   - Add to `quant-engine/.env` file:
     ```
     TELEGRAM_URL=tgram://<bot_token>/<chat_id>
     ```
   - Redeploy quant-engine

2. **Test connectivity**:
   - Go to **Alerts** view in the app
   - Click "Test Channels" button
   - Check your Telegram - you should receive a test message

3. **Verify automation is running**:
   - Alerts are triggered by a cron job (external cron-job.org)
   - Manual trigger: Click "Force Run Automation Engine"
   - Check "Alert Delivery Log" table for status

4. **Active alert rules** (automatic):
   - **Macro swings**: When RBI/SEBI news shifts sentiment
   - **Technical breakouts**: Candlestick reversals on your holdings
   - **AI rebalances**: When command/portfolio agents suggest rotation

5. **View alert history**:
   - Alerts view shows delivery log with:
     - Event type
     - Status (pending/sent/failed)
     - Delivery channels (Telegram/Notion)
   - Auto-refreshes every 30 seconds

**Troubleshooting**:
- If no alerts arriving → check "Channel Connection Status" card
- Green = connected, Red = configuration issue
- Click "Test Channels" to diagnose

---

## 🎯 Feature-by-Feature Walkthrough

### 1. Themes View (Money Flow Intelligence)
**Purpose**: Real-time heatmap of 175 micro-clusters across NSE/BSE

**Key controls**:
- **Search bar**: Find specific stocks/clusters
- **Show All / Movers / Laggards**: Filter by performance
- **Pause Live**: Stop auto-refresh (default: updates every 15s)
- **Click any cell**: See constituent stocks in that micro-cluster

**What the colors mean**:
- Deep red: -8% or worse
- Light red: -2% to -8%
- White/neutral: -2% to +2%
- Light green: +2% to +8%
- Deep green: +8% or better

**Pro usage**:
- Morning: Check movers to see overnight shifts
- Intraday: Monitor for momentum clusters (rising intensity)
- EOD: Check laggards for reversal opportunities

---

### 2. Portfolio View (Your Holdings + AI Signals)
**Purpose**: Live Zerodha portfolio with explainable Buy/Sell decisions

**Key metrics displayed**:
- Symbol, Qty, Value
- 1D/1W/1M/6M/YTD returns
- AI Decision (BUY/ACCUMULATE/HOLD/REDUCE/SELL)

**How to interpret**:
1. **Green background**: Positive returns
2. **Red background**: Negative returns
3. **Decision badge color**:
   - Green (BUY) = add to position
   - Blue (ACCUMULATE) = average down
   - Gray (HOLD) = do nothing
   - Yellow (REDUCE) = trim
   - Red (SELL) = exit

**Click any row** → Right panel shows:
- **Macro Context**: Regulatory/policy sentiment
- **Technical Signals**: Candlestick patterns, momentum
- **Transcript Summary**: Latest earnings insights
- **Risk Flags**: Drawdown, volatility warnings

**Filters**:
- Action filter: Show only BUY/SELL signals
- Exchange: NSE/BSE/All
- Search: Find specific symbol
- Confidence slider: Minimum AI confidence (0-100)

---

### 3. Signals & Analysis View (Deep Research Hub)
**Purpose**: Unified workspace for technical, macro, earnings research on selected stock

**Workflow**:
1. **Select a stock** from Focus Selector (portfolio holdings only)
2. **Auto-loads**:
   - Candlestick pattern (bullish/bearish/neutral)
   - Macro sentiment gauge (bearish/neutral/bullish)
   - 3-bullet earnings transcript summary

3. **Macro Sentiment Spectrum**:
   - Visual gauge showing RBI/SEBI policy impact
   - "Current Catalyst" explains the driver
   - "Impacted Micro-Clusters" shows which sectors affected

4. **Earnings Copilot**:
   - **Upload PDF**: Sync transcript to vector DB
   - **Auto-summary**: 3 key points from latest call
   - **Chat**: Ask grounded questions (e.g., "What's management guidance on margins?")

5. **AI Execution Console**:
   - Type natural language command: "Rotate 10% of IT into PSU Banks"
   - Returns mock basket (sell legs + buy legs)
   - **Not live execution** - for research only

6. **Optimal Sizing**:
   - After getting BUY signals, click "Calculate Optimal Sizing"
   - Uses PyPortfolioOpt max-Sharpe allocation
   - Shows exact shares to buy with ₹100k capital

**Data Controls**:
- "Force Macro Harvest": Refresh RBI/SEBI news
- "View Market Hotspots": On-demand thematic ranking

---

### 4. Comparison View (Cross-Cluster Performance)
**Purpose**: Compare up to 5 micro-clusters on normalized returns chart

**How to use**:
1. **Type cluster name** in search box (e.g., "Auto", "Banks", "IT")
2. **Click to add** - appears as colored chip
3. **Select timeframe**: 1D, 5D, 1M, 6M, YTD
4. **Chart shows**: Normalized % returns (all start at 0%)

**Advanced features**:
- **Momentum Radar**: Technical breakouts in compared clusters
- **Run 5-Year Backtest**: Test momentum strategy (see section b above)
- **Peer Relative Strength**: Pick a stock → see top 3 competitors

**Peer RS workflow**:
1. Type stock symbol in "Peer Stock Input"
2. Auto-loads top 3 cluster peers
3. Chart shows relative strength comparison
4. Use to identify sector leaders

---

### 5. Alerts View (Automation Dashboard)
**Purpose**: Monitor Telegram/Notion delivery and test connectivity

**Actions**:
- **Test Channels**: Send test notification now
- **Create Pending Test Event**: Queue an event for dispatch
- **Force Run Automation Engine**: Manually trigger dispatcher

**Alert Delivery Log**:
- Shows all sent/failed/pending alerts
- Columns: Event type, Status, Channels, Timestamp
- Auto-refreshes every 30s

**Active Alert Rules**:
- Macro/regulatory swings
- Technical breakouts on holdings
- AI agent rebalance suggestions

**Channel Status**:
- Green dot = connected
- Red dot = config issue
- Check `.env` files if red

---

### 6. Network View (Diagnostics)
**Purpose**: Verify broker connections, data sources, API health

**Panels**:
- **Provider Connections**: Zerodha/Angel session status
- **Data Flow Sources**: Which feeds are live/fallback
- **API Endpoint Diagnostics**: Health check for all routes

**When to use**:
- After deployment changes
- When portfolio shows "Disconnected"
- To verify live vs synthetic data mode

---

### 7. Growth Triggers View (Catalyst Discovery)
**Purpose**: Track industry/company signals driving earnings/re-rating

**Features**:
- **Featured Trigger**: Highest-conviction setup
- **Trigger Feed**: Ranked by breadth + momentum
- **Coverage Cloud**: Sectors with active catalysts

**Filters**:
- Focus: All/Industries/Portfolio/Breakouts
- Catalyst: Breakout/Earnings/Policy/Demand/Capex

**How to interpret**:
- High breadth + strong momentum = sector rotation underway
- Portfolio-linked triggers = actionable for your holdings
- Breakout focus = technical setups only

---

## 🛠️ Operational Commands

### Run locally
```bash
cd "/Users/joy/Portfolio Tracker"
npx vercel dev --listen 4173
# Open http://127.0.0.1:4173
```

### Run tests
```bash
node --test tests/*.test.js
```

### Refresh live catalog (2,486 stocks, 175 clusters)
```bash
node scripts/ingest-bharatfintrack.js --target-stocks 2486 --target-clusters 175 --require-live --output ./data/thematic_index_catalog.json
```

### Snapshot your portfolio (CLI)
```bash
node scripts/portfolio-snapshot.js --mode live --exchange all --format json
```

### Check hotspots (CLI)
```bash
node scripts/hotspots-snapshot.js
```

### Test macro context (CLI)
```bash
node scripts/macro-context-analyze.js
```

---

## 🔧 Troubleshooting

### "Disconnected" in Portfolio view
**Fix**: Click "Reconnect Zerodha" → complete login flow

### Alerts not arriving in Telegram
**Fix**:
1. Check Alerts → "Channel Connection Status"
2. Verify `quant-engine/.env` has correct `TELEGRAM_URL`
3. Click "Test Channels" to diagnose

### "Synthetic data" instead of live
**Causes**:
- Broker session expired (reconnect)
- Market closed (expected behavior)
- API down (check Network view)

### Backtest button does nothing
**Likely**: Quant engine not responding
**Fix**:
1. Check `https://portfolio-tracker-if7l.onrender.com/health`
2. May need to redeploy quant-engine on Render

### No macro sentiment showing
**Fix**:
1. Go to Signals view
2. Click "Force Macro Harvest"
3. Wait 10-15s for RBI/SEBI news scrape

### Earnings summary shows "No data"
**Fix**:
1. Select a stock in Signals view
2. Upload transcript PDF in "Knowledge Base Ingestion"
3. Click "Sync to Vector DB"
4. Summary auto-generates

---

## 📚 Advanced Tips

### Best workflow for daily use:
1. **Morning (9:00 AM)**:
   - Open Themes → check "Movers"
   - Note which clusters are gapping up

2. **Pre-market (9:00-9:15 AM)**:
   - Check Portfolio → any new BUY/SELL signals?
   - Read rationale for changes

3. **Intraday**:
   - Watch Comparison view for rotation trends
   - Check Alerts for breakout notifications

4. **Post-close (3:30 PM)**:
   - Review Portfolio performance
   - Check Growth Triggers for tomorrow's setup

### Optimal sizing strategy:
- Use "Calculate Optimal Sizing" for NEW buys only
- Don't resize existing positions (creates tax events)
- Mock capital = ₹100k default, but scale proportionally

### AI decision reliability:
- Confidence > 70% = high conviction
- Confidence 50-70% = moderate
- Confidence < 50% = low conviction, verify manually
- Always read the rationale, never blindly follow

### Data freshness indicators:
- "LIVE DATA" pill (top right) = real broker feed
- "SYNTHETIC DATA" = fallback mode, less reliable
- Check Network view for exact source

---

## 🚨 Important Notes

### What this system DOES:
- ✅ Real-time thematic market intelligence
- ✅ Explainable AI signals on your holdings
- ✅ Backtesting momentum strategies
- ✅ Telegram alerting for new ideas
- ✅ Earnings transcript Q&A

### What this system DOES NOT do:
- ❌ Execute live trades automatically
- ❌ Guarantee profit (markets are uncertain)
- ❌ Replace your judgment (tool, not oracle)

### Risk disclaimer:
- All AI decisions are research aids, not financial advice
- Backtest results ≠ future performance
- Always verify signals before trading
- Position sizing is a suggestion, not a mandate

---

## 📞 Need Help?

### Check in order:
1. This guide (you are here)
2. `/docs/runbooks/claude-handoff.md` - technical architecture
3. `/tasks/roadmap.md` - what features exist
4. `/tasks/handoff.md` - recent changes
5. GitHub issues (if public repo)

### Common questions:
**Q: Is my Zerodha data safe?**
A: Session cookies stored locally, never logged. Code is open for audit.

**Q: Can I use without Zerodha?**
A: Yes, but Portfolio view won't work. Themes/Comparison/Alerts still functional.

**Q: How often do alerts trigger?**
A: Cron runs hourly, dispatches pending events. Not every hour = alert.

**Q: Can I backtest my own strategy?**
A: Not from UI yet. Use `quant-engine/routers/backtest.py` and customize logic.

**Q: What if a feature is broken?**
A: Check Network view diagnostics → file issue with reproduction steps.

---

## 🎓 Learning Path

### Week 1: Foundation
- Day 1-2: Explore Themes, understand color coding
- Day 3-4: Connect Zerodha, review Portfolio signals
- Day 5-7: Set up Telegram alerts, test delivery

### Week 2: Analysis
- Learn Comparison view, compare 3-5 clusters daily
- Try Peer RS on your holdings
- Run first backtest

### Week 3: Research
- Use Signals view for deep dives
- Upload an earnings transcript
- Chat with copilot

### Week 4: Automation
- Verify alerts arriving regularly
- Refine trigger sensitivity (if configurable)
- Integrate into daily routine

---

## ✅ Success Checklist

After reading this guide, you should be able to:
- [ ] Open production URL and navigate all views
- [ ] Connect Zerodha and see live portfolio
- [ ] Identify sector rotation in Themes view
- [ ] Run a 5-year backtest on a cluster
- [ ] Understand BUY/SELL decisions on holdings
- [ ] Receive test alert on Telegram
- [ ] Use Signals view to research a stock
- [ ] Compare 3 clusters on normalized returns chart
- [ ] Know when data is "live" vs "synthetic"
- [ ] Troubleshoot basic connection issues

---

**Last updated**: 2026-03-10
**App version**: Waves 1-7 complete (see `/tasks/roadmap.md`)
