/**
 * Alert Enqueue Helper
 * Centralizes alert creation logic for automatic alert generation rules
 */

const QUANT_ENGINE_URL = process.env.QUANT_ENGINE_URL || "http://localhost:8000";

/**
 * Enqueue an alert to be dispatched by cron
 * @param {Object} alert Alert details
 * @param {string} alert.title Alert title
 * @param {string} alert.body Alert body message
 * @param {string} alert.event_type Event type (macro_swing, technical_breakout, portfolio_decision, etc.)
 * @param {string} alert.severity Severity level (info, medium, high, critical)
 * @param {string[]} alert.channels Delivery channels (default: ["telegram"])
 * @returns {Promise<Object>} Enqueue response
 */
async function enqueueAlert(alert) {
  const payload = {
    title: String(alert.title || "Portfolio Tracker Alert"),
    body: String(alert.body || ""),
    event_type: String(alert.event_type || "generic"),
    severity: String(alert.severity || "info"),
    channels: Array.isArray(alert.channels) ? alert.channels : ["telegram"],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${QUANT_ENGINE_URL}/api/v1/alerts/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Alert enqueue failed: ${response.status} ${text}`);
    }

    const result = await response.json();
    return {
      success: true,
      event_id: result.event_id,
      status: result.status,
    };
  } catch (error) {
    console.error("[alertEnqueue] Failed to enqueue alert:", error.message);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create alert for high-conviction portfolio decision
 * @param {Object} params
 * @param {string} params.symbol Stock symbol
 * @param {string} params.exchange Exchange (NSE/BSE)
 * @param {string} params.action AI decision (BUY/SELL/ACCUMULATE/REDUCE/HOLD)
 * @param {number} params.confidence Confidence score (0-100)
 * @param {string[]} params.rationale Rationale bullet points
 * @param {Object} params.current Current position info (pnl, value, qty)
 * @returns {Promise<Object>}
 */
async function enqueuePortfolioDecisionAlert(params) {
  const { symbol, exchange, action, confidence, rationale, current } = params;

  // Only alert on high-conviction SELL or strong BUY signals
  const shouldAlert =
    (action === "SELL" && confidence >= 70) ||
    (action === "BUY" && confidence >= 80) ||
    (action === "REDUCE" && confidence >= 75);

  if (!shouldAlert) {
    return { success: true, skipped: true, reason: "Low conviction or non-actionable signal" };
  }

  const actionEmoji = {
    BUY: "🟢",
    SELL: "🔴",
    ACCUMULATE: "🔵",
    REDUCE: "🟡",
    HOLD: "⚪",
  }[action] || "⚪";

  const severityMap = {
    SELL: "high",
    REDUCE: "medium",
    BUY: "medium",
    ACCUMULATE: "info",
  };

  const title = `${actionEmoji} Portfolio Alert: ${symbol}`;

  const rationaleText = Array.isArray(rationale) && rationale.length
    ? rationale.map((line) => `• ${line}`).join("\n")
    : "No rationale available";

  const currentPnLText = current?.pnl != null
    ? `Current P&L: ${current.pnl >= 0 ? "+" : ""}${current.pnl.toFixed(2)}%`
    : "";

  const body = `
${actionEmoji} AI Decision: ${action} (${confidence}% confidence)
${exchange}:${symbol}

Rationale:
${rationaleText}

${currentPnLText}

🔗 View in app: Portfolio > ${symbol}
  `.trim();

  return await enqueueAlert({
    title,
    body,
    event_type: "portfolio_decision",
    severity: severityMap[action] || "info",
    channels: ["telegram"],
  });
}

/**
 * Create alert for macro sentiment swing
 * @param {Object} params
 * @param {string} params.catalyst Key catalyst
 * @param {number} params.sentiment_score Sentiment score (-1 to 1)
 * @param {string[]} params.impacted_clusters List of affected clusters
 * @returns {Promise<Object>}
 */
async function enqueueMacroSwingAlert(params) {
  const { catalyst, sentiment_score, impacted_clusters } = params;

  // Only alert on significant swings (abs value > 0.5)
  if (Math.abs(sentiment_score) < 0.5) {
    return { success: true, skipped: true, reason: "Sentiment swing not significant" };
  }

  const direction = sentiment_score > 0 ? "Bullish" : "Bearish";
  const emoji = sentiment_score > 0 ? "📈" : "📉";
  const severity = Math.abs(sentiment_score) > 0.7 ? "high" : "medium";

  const title = `${emoji} Macro Alert: ${direction} Shift`;
  const clusterText = Array.isArray(impacted_clusters) && impacted_clusters.length
    ? impacted_clusters.slice(0, 5).join(", ")
    : "Multiple sectors";

  const body = `
${emoji} ${direction} macro shift detected
Sentiment Score: ${(sentiment_score * 100).toFixed(0)}%

Catalyst: ${catalyst}

Impacted Clusters:
${clusterText}

🔗 View in app: Signals > Macro Context
  `.trim();

  return await enqueueAlert({
    title,
    body,
    event_type: "macro_swing",
    severity,
    channels: ["telegram"],
  });
}

/**
 * Create alert for technical breakout on portfolio holding
 * @param {Object} params
 * @param {string} params.symbol Stock symbol
 * @param {string} params.exchange Exchange
 * @param {string} params.pattern Candlestick pattern
 * @param {string} params.signal Signal type (bullish/bearish)
 * @returns {Promise<Object>}
 */
async function enqueueTechnicalBreakoutAlert(params) {
  const { symbol, exchange, pattern, signal } = params;

  const emoji = signal === "bullish" ? "🚀" : "⚠️";
  const title = `${emoji} Breakout: ${symbol}`;
  const severity = signal === "bullish" ? "medium" : "high";

  const body = `
${emoji} ${signal === "bullish" ? "Bullish" : "Bearish"} pattern detected
${exchange}:${symbol}

Pattern: ${pattern}
Signal: ${signal.toUpperCase()}

🔗 View in app: Signals > Technical Scanner
  `.trim();

  return await enqueueAlert({
    title,
    body,
    event_type: "technical_breakout",
    severity,
    channels: ["telegram"],
  });
}

module.exports = {
  enqueueAlert,
  enqueuePortfolioDecisionAlert,
  enqueueMacroSwingAlert,
  enqueueTechnicalBreakoutAlert,
};
