const { bootstrapPortfolio, pollPortfolio, getDecisions } = require("./_lib/portfolioService");
const { CONTRACTS } = require("./_lib/contracts");
const { RECOMMENDATION_DISCLAIMER, applyDecisionGuardrails } = require("./_lib/safety");
const { saveEodSnapshot } = require("./_lib/snapshots");
const { initTrace, traceLog } = require("./_lib/trace");
const { exchangeKey, json, parseJsonBody, parseCookies } = require("./_lib/http");
const { isSessionExpired } = require("./_lib/zerodhaSession");
const { enqueuePortfolioDecisionAlert } = require("./_lib/alertEnqueue");

function sessionFromRequest(req) {
  const cookies = parseCookies(req);
  const accessToken = String(cookies.kite_access_token || "").trim();
  const userId = String(cookies.kite_user_id || "").trim();
  const userName = String(cookies.kite_user_name || "").trim();
  const expiresAt = String(cookies.kite_expires_at || "").trim();
  const angelJwtToken = String(cookies.pt_angel_jwt || "").trim();
  const angelRefreshToken = String(cookies.pt_angel_refresh || "").trim();
  const angelFeedToken = String(cookies.pt_angel_feed || "").trim();
  const angelClientCode = String(cookies.pt_angel_client || "").trim();
  const angelExpiresAt = String(cookies.pt_angel_expires || "").trim();
  const angelExpiresMs = new Date(angelExpiresAt).getTime();
  const angelConnected = Boolean(angelJwtToken && Number.isFinite(angelExpiresMs) && Date.now() < angelExpiresMs);

  if (!accessToken || isSessionExpired({ expiresAt })) {
    return angelConnected
      ? {
          connected: false,
          accessToken: "",
          userId: null,
          userName: null,
          expiresAt: null,
          provider: "kite-direct",
          angel: {
            connected: true,
            accessToken: angelJwtToken,
            refreshToken: angelRefreshToken,
            feedToken: angelFeedToken,
            clientCode: angelClientCode || null,
            expiresAt: angelExpiresAt || null,
          },
        }
      : null;
  }

  return {
    connected: true,
    accessToken,
    userId: userId || null,
    userName: userName || null,
    expiresAt: expiresAt || null,
    provider: "kite-direct",
    angel: {
      connected: angelConnected,
      accessToken: angelJwtToken,
      refreshToken: angelRefreshToken,
      feedToken: angelFeedToken,
      clientCode: angelClientCode || null,
      expiresAt: angelExpiresAt || null,
    },
  };
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "portfolio-api");
  const withMeta = (payload) => ({
    ...(payload || {}),
    meta: {
      contractVersion: CONTRACTS.portfolio,
      traceId: trace.traceId,
    },
  });
  const respond = (statusCode, payload) => json(res, statusCode, withMeta(payload));

  const route = String(req.query?.route || "").toLowerCase();
  const sessionOverride = sessionFromRequest(req);

  if (route === "bootstrap") {
    if (req.method !== "GET") return respond(405, { error: "Method not allowed" });

    try {
      const payload = await bootstrapPortfolio({
        exchange: exchangeKey(req.query?.exchange),
        forceRefresh: String(req.query?.refresh || "").toLowerCase() === "true",
        sessionOverride,
      });

      traceLog(trace, "info", "portfolio.bootstrap.success", {
        rows: Array.isArray(payload.rows) ? payload.rows.length : 0,
      });
      return respond(200, payload);
    } catch (error) {
      traceLog(trace, "error", "portfolio.bootstrap.failed", { message: error.message });
      return respond(500, {
        error: "portfolio-bootstrap-failed",
        message: error.message,
      });
    }
  }

  if (route === "poll") {
    if (req.method !== "GET") return respond(405, { error: "Method not allowed" });

    try {
      const payload = await pollPortfolio({
        cursor: req.query?.cursor || "",
        exchange: exchangeKey(req.query?.exchange),
        sessionOverride,
      });

      traceLog(trace, "info", "portfolio.poll.success", {
        rows: Array.isArray(payload?.updates?.rows) ? payload.updates.rows.length : 0,
      });
      return respond(200, payload);
    } catch (error) {
      traceLog(trace, "error", "portfolio.poll.failed", { message: error.message });
      return respond(500, {
        error: "portfolio-poll-failed",
        message: error.message,
      });
    }
  }

  if (route === "decisions") {
    if (req.method !== "GET") return respond(405, { error: "Method not allowed" });

    try {
      const payload = await getDecisions({
        exchange: exchangeKey(req.query?.exchange),
        sessionOverride,
      });
      const decisions = Array.isArray(payload.decisions)
        ? payload.decisions.map((decision) => applyDecisionGuardrails(decision, { liveTradingEnabled: false }))
        : [];

      traceLog(trace, "info", "portfolio.decisions.success", {
        decisions: decisions.length,
      });

      // Background: Enqueue alerts for high-conviction decisions (non-blocking)
      setImmediate(() => {
        decisions
          .filter((d) => d.action !== "HOLD" && d.confidence >= 70)
          .forEach((decision) => {
            enqueuePortfolioDecisionAlert({
              symbol: decision.symbol,
              exchange: decision.exchange,
              action: decision.action,
              confidence: decision.confidence,
              rationale: decision.rationale || [],
              current: {
                pnl: decision.pnl || 0,
                value: decision.value || 0,
                qty: decision.qty || 0,
              },
            }).catch((err) => {
              // Silent fail - don't block response on alert enqueue errors
              console.error(`[portfolio.decisions] Alert enqueue failed for ${decision.symbol}:`, err.message);
            });
          });
      });

      return respond(200, {
        ...payload,
        decisions,
        disclaimer: RECOMMENDATION_DISCLAIMER,
      });
    } catch (error) {
      traceLog(trace, "error", "portfolio.decisions.failed", { message: error.message });
      return respond(500, {
        error: "portfolio-decisions-failed",
        message: error.message,
      });
    }
  }

  if (route === "snapshots-eod") {
    if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

    try {
      const body = await parseJsonBody(req);
      const payload = await saveEodSnapshot({
        snapshotDate: body.snapshotDate,
      });

      traceLog(trace, "info", "portfolio.snapshots-eod.success", {
        stored: Boolean(payload?.stored),
        mode: payload?.mode || null,
      });
      return respond(200, payload);
    } catch (error) {
      traceLog(trace, "error", "portfolio.snapshots-eod.failed", { message: error.message });
      return respond(500, {
        error: "portfolio-snapshot-failed",
        message: error.message,
      });
    }
  }

  return respond(404, { error: "Not found" });
};
