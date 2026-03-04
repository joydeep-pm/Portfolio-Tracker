const mockMarket = require("./_lib/mockMarket");
const { buildLiveMarketView, getLiveComparisonSeries, normalizeExchange } = require("./_lib/angelLiveMarket");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, parseCookies } = require("./_lib/http");

function toBool(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "1" || key === "true" || key === "yes" || key === "y";
}

function angelSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const accessToken = String(cookies.pt_angel_jwt || "").trim();
  const clientCode = String(cookies.pt_angel_client || "").trim();
  const expiresAt = String(cookies.pt_angel_expires || "").trim();
  const expiresMs = new Date(expiresAt).getTime();
  const connected = Boolean(accessToken && clientCode && Number.isFinite(expiresMs) && Date.now() < expiresMs);
  return {
    connected,
    accessToken,
    clientCode,
    expiresAt: expiresAt || null,
  };
}

function liveMarketEnabled() {
  const value = process.env.ENABLE_ANGEL_MARKET_DATA;
  if (value === undefined || value === null || String(value).trim() === "") return true;
  return toBool(value);
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "comparison-api");
  const respond = (statusCode, payload) =>
    json(res, statusCode, {
      ...(payload || {}),
      meta: {
        contractVersion: CONTRACTS.comparison,
        traceId: trace.traceId,
      },
    });
  const route = String(req.query?.route || "").toLowerCase();

  if (route !== "series") {
    return respond(404, { error: "Not found" });
  }

  if (req.method !== "GET") {
    return respond(405, { error: "Method not allowed" });
  }

  const exchange = normalizeExchange(req.query?.exchange);
  const angelSession = angelSessionFromRequest(req);
  if (liveMarketEnabled() && angelSession.connected) {
    try {
      const liveView = await buildLiveMarketView({
        exchange,
        session: angelSession,
      });
      const livePayload = getLiveComparisonSeries({
        view: liveView,
        clusterIds: req.query?.clusterIds,
        window: req.query?.window,
        exchange,
        points: req.query?.points,
      });
      if (livePayload) {
        traceLog(trace, "info", "comparison.series.live.success", {
          exchange: livePayload.exchange,
          clusters: Object.keys(livePayload.seriesByClusterId || {}).length,
        });
        return respond(200, livePayload);
      }
    } catch (error) {
      traceLog(trace, "warn", "comparison.series.live.fallback", {
        exchange,
        message: error.message,
      });
    }
  }

  const payload = mockMarket.getComparisonSeries({
    clusterIds: req.query?.clusterIds,
    window: req.query?.window,
    exchange: req.query?.exchange,
    points: req.query?.points,
  });

  traceLog(trace, "info", "comparison.series.success", {
    exchange: payload.exchange,
    clusters: Object.keys(payload.seriesByClusterId || {}).length,
  });
  return respond(200, payload);
};
