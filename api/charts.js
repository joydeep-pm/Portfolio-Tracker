const mockMarket = require("./_lib/mockMarket");
const { buildLiveMarketView, getLiveComparisonSeries, normalizeExchange } = require("./_lib/angelLiveMarket");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, parseCookies } = require("./_lib/http");
const { listDecisionAuditEvents } = require("./_lib/snapshots");
const { bootstrapPortfolio } = require("./_lib/portfolioService");

const MARKER_STYLE = {
  BUY: { position: "belowBar", shape: "arrowUp", color: "#1aa56f" },
  ACCUMULATE: { position: "belowBar", shape: "circle", color: "#2da8a6" },
  REDUCE: { position: "aboveBar", shape: "circle", color: "#d9a14a" },
  SELL: { position: "aboveBar", shape: "arrowDown", color: "#cb4b63" },
};

function toBool(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "1" || key === "true" || key === "yes" || key === "y";
}

function normalizeWindow(value) {
  const windowKey = String(value || "1M").toUpperCase();
  if (["1D", "5D", "1M", "6M", "YTD"].includes(windowKey)) return windowKey;
  return "1M";
}

function normalizePoints(value, fallback = 40) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(120, Math.max(5, parsed));
}

function normalizeExchangeUpper(value) {
  const key = String(value || "NSE").toUpperCase();
  if (key === "NSE" || key === "BSE") return key;
  return "NSE";
}

function asEpochSeconds(value) {
  const ms = new Date(String(value || "")).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function nearestPointTime(series, eventSec) {
  if (!Array.isArray(series) || !series.length || !Number.isFinite(eventSec)) return null;
  let best = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const point of series) {
    const pointSec = asEpochSeconds(point.ts);
    if (!Number.isFinite(pointSec)) continue;
    const delta = Math.abs(pointSec - eventSec);
    if (delta < bestDelta) {
      best = pointSec;
      bestDelta = delta;
    }
  }
  return best;
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

function parseClusterIds(raw, fallback = "") {
  return String(raw || fallback)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function compareWindowToMomentumKey(windowKey) {
  if (windowKey === "5D") return "1W";
  return windowKey;
}

function buildClusterStockResolver(view, exchangeKey) {
  const stocksByCluster = new Map();
  const list = Array.isArray(view?.stocks) ? view.stocks : [];
  list.forEach((stock) => {
    if (exchangeKey !== "all" && String(stock.exchange || "").toLowerCase() !== exchangeKey) return;
    const clusterId = String(stock.clusterId || "");
    if (!clusterId) return;
    if (!stocksByCluster.has(clusterId)) stocksByCluster.set(clusterId, []);
    stocksByCluster.get(clusterId).push(stock);
  });
  return stocksByCluster;
}

function resolveLeaderFromCluster(view, clusterId, exchangeKey, windowKey) {
  if (!clusterId) return null;
  const byCluster = buildClusterStockResolver(view, exchangeKey);
  const candidates = byCluster.get(clusterId) || [];
  const momentumKey = compareWindowToMomentumKey(windowKey);
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => {
    const left = Number(a?.returns?.[momentumKey] || 0);
    const right = Number(b?.returns?.[momentumKey] || 0);
    if (right !== left) return right - left;
    return String(`${a.exchange}:${a.symbol}`).localeCompare(String(`${b.exchange}:${b.symbol}`));
  });
  return sorted[0] || null;
}

async function buildComparisonContext(req, options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const window = normalizeWindow(options.window);
  const points = normalizePoints(options.points, 40);
  const clusterIds = parseClusterIds(options.clusterIds || options.clusterId);
  const angelSession = angelSessionFromRequest(req);

  if (liveMarketEnabled() && angelSession.connected) {
    try {
      const liveView = await buildLiveMarketView({
        exchange,
        session: angelSession,
      });
      const livePayload = getLiveComparisonSeries({
        view: liveView,
        clusterIds: clusterIds.join(","),
        window,
        exchange,
        points,
      });
      if (livePayload) {
        return {
          exchange,
          window,
          points,
          clusterIds,
          view: liveView,
          payload: {
            ...livePayload,
            source: livePayload.source || "angel-live",
          },
          source: "angel-live",
        };
      }
    } catch (_error) {
      // fall through to mock path
    }
  }

  const mockPayload = mockMarket.getComparisonSeries({
    clusterIds: clusterIds.join(","),
    window,
    exchange,
    points,
  });

  return {
    exchange,
    window,
    points,
    clusterIds,
    view: mockMarket.buildView(exchange),
    payload: {
      ...mockPayload,
      source: "mock-market",
    },
    source: "mock-market",
  };
}

async function buildDecisionMarkers(req) {
  const clusterId = String(req.query?.clusterId || parseClusterIds(req.query?.clusterIds)[0] || "");
  const context = await buildComparisonContext(req, {
    clusterId,
    window: req.query?.window,
    exchange: req.query?.exchange,
    points: req.query?.points,
  });

  const series = context.payload?.seriesByClusterId?.[clusterId] || [];
  if (!series.length) {
    return {
      asOf: context.payload?.asOf || new Date().toISOString(),
      symbol: null,
      exchange: null,
      clusterId,
      window: context.window,
      source: context.source,
      markers: [],
      fallbackUsed: false,
    };
  }

  let symbol = String(req.query?.symbol || "").toUpperCase();
  let exchange = normalizeExchangeUpper(req.query?.symbolExchange || req.query?.markerExchange || req.query?.exchange);
  if (!symbol) {
    const leader = resolveLeaderFromCluster(context.view, clusterId, context.exchange, context.window);
    symbol = String(leader?.symbol || "").toUpperCase();
    if (leader?.exchange) exchange = normalizeExchangeUpper(leader.exchange);
  }

  const events = symbol
    ? await listDecisionAuditEvents({
        symbol,
        exchange,
        limit: normalizePoints(req.query?.limit, 60),
      })
    : [];

  const markers = events
    .filter((entry) => Object.prototype.hasOwnProperty.call(MARKER_STYLE, String(entry.action || "").toUpperCase()))
    .map((entry) => {
      const action = String(entry.action || "").toUpperCase();
      const style = MARKER_STYLE[action];
      const eventSec = asEpochSeconds(entry.asOf || entry.createdAt);
      const time = nearestPointTime(series, eventSec);
      if (!Number.isFinite(time)) return null;
      const confidence = Number(entry.confidence || 0);
      return {
        time,
        action,
        confidence: Number.parseFloat(confidence.toFixed(1)),
        text: `${action} ${Number.parseFloat(confidence.toFixed(1))}%`,
        color: style.color,
        shape: style.shape,
        position: style.position,
        source: "history",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  if (!markers.length && symbol) {
    try {
      const snapshot = await bootstrapPortfolio({
        exchange: "all",
        forceRefresh: false,
      });
      const row = (snapshot.rows || []).find(
        (item) => String(item.symbol || "").toUpperCase() === symbol && String(item.exchange || "").toUpperCase() === exchange,
      );
      const action = String(row?.decision?.action || "HOLD").toUpperCase();
      if (row && Object.prototype.hasOwnProperty.call(MARKER_STYLE, action)) {
        const style = MARKER_STYLE[action];
        const latestSec = asEpochSeconds(series[series.length - 1]?.ts);
        if (Number.isFinite(latestSec)) {
          const confidence = Number(row.decision?.confidence || 0);
          markers.push({
            time: latestSec,
            action,
            confidence: Number.parseFloat(confidence.toFixed(1)),
            text: `${action} ${Number.parseFloat(confidence.toFixed(1))}%`,
            color: style.color,
            shape: style.shape,
            position: style.position,
            source: "latest-decision",
          });
        }
      }
    } catch (_error) {
      // ignore fallback failure
    }
  }

  return {
    asOf: context.payload?.asOf || new Date().toISOString(),
    symbol: symbol || null,
    exchange: symbol ? exchange : null,
    clusterId,
    window: context.window,
    source: context.source,
    markers,
    fallbackUsed: markers.some((item) => item.source === "latest-decision"),
  };
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "charts-api");
  const route = String(req.query?.route || "").toLowerCase();
  const contractVersionForRoute = route === "series" ? CONTRACTS.comparison : CONTRACTS.charts;
  const respond = (statusCode, payload) =>
    json(res, statusCode, {
      ...(payload || {}),
      meta: {
        contractVersion: contractVersionForRoute,
        traceId: trace.traceId,
      },
    });

  if (route === "series") {
    if (req.method !== "GET") return respond(405, { error: "Method not allowed" });
    try {
      const context = await buildComparisonContext(req, {
        clusterIds: req.query?.clusterIds,
        window: req.query?.window,
        exchange: req.query?.exchange,
        points: req.query?.points,
      });
      traceLog(trace, "info", "comparison.series.success", {
        exchange: context.payload?.exchange,
        clusters: Object.keys(context.payload?.seriesByClusterId || {}).length,
      });
      return respond(200, context.payload);
    } catch (error) {
      traceLog(trace, "error", "comparison.series.failed", { message: error.message });
      return respond(500, {
        error: "comparison-series-failed",
        message: error.message,
      });
    }
  }

  if (route === "normalized-returns") {
    if (req.method !== "GET") return respond(405, { error: "Method not allowed" });
    try {
      const context = await buildComparisonContext(req, {
        clusterIds: req.query?.clusterIds,
        window: req.query?.window,
        exchange: req.query?.exchange,
        points: req.query?.points,
      });
      traceLog(trace, "info", "charts.normalized-returns.success", {
        clusters: Object.keys(context.payload?.seriesByClusterId || {}).length,
        source: context.source,
      });
      return respond(200, context.payload);
    } catch (error) {
      traceLog(trace, "error", "charts.normalized-returns.failed", { message: error.message });
      return respond(500, {
        error: "charts-normalized-returns-failed",
        message: error.message,
      });
    }
  }

  if (route === "decision-markers") {
    if (req.method !== "GET") return respond(405, { error: "Method not allowed" });
    try {
      const payload = await buildDecisionMarkers(req);
      traceLog(trace, "info", "charts.decision-markers.success", {
        symbol: payload.symbol,
        markers: payload.markers.length,
        fallbackUsed: payload.fallbackUsed,
      });
      return respond(200, payload);
    } catch (error) {
      traceLog(trace, "error", "charts.decision-markers.failed", { message: error.message });
      return respond(500, {
        error: "charts-decision-markers-failed",
        message: error.message,
      });
    }
  }

  return respond(404, { error: "Not found" });
};
