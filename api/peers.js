const mockMarket = require("./_lib/mockMarket");
const { buildLiveMarketView, getLiveComparisonSeries, normalizeExchange } = require("./_lib/angelLiveMarket");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, parseCookies } = require("./_lib/http");

function toBool(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "1" || key === "true" || key === "yes" || key === "y";
}

function normalizeWindow(value) {
  const windowKey = String(value || "1M").toUpperCase();
  if (["1D", "5D", "1M", "6M", "YTD"].includes(windowKey)) return windowKey;
  return "1M";
}

function compareWindowToMomentumKey(windowKey) {
  if (windowKey === "5D") return "1W";
  return windowKey;
}

function normalizePoints(value, fallback = 40) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(120, Math.max(5, parsed));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function serializeStock(stock) {
  return {
    symbol: String(stock.symbol || "").toUpperCase(),
    exchange: String(stock.exchange || "NSE").toUpperCase(),
    name: String(stock.name || stock.symbol || ""),
    returns: {
      "1D": Number(stock?.returns?.["1D"] || 0),
      "1W": Number(stock?.returns?.["1W"] || 0),
      "1M": Number(stock?.returns?.["1M"] || 0),
      "6M": Number(stock?.returns?.["6M"] || 0),
      YTD: Number(stock?.returns?.YTD || 0),
    },
  };
}

async function buildMarketView(req, exchange) {
  const angelSession = angelSessionFromRequest(req);
  if (liveMarketEnabled() && angelSession.connected) {
    try {
      const liveView = await buildLiveMarketView({
        exchange,
        session: angelSession,
      });
      return {
        view: liveView,
        source: "angel-live",
      };
    } catch (_error) {
      // fall through to mock mode
    }
  }

  return {
    view: mockMarket.buildView(exchange),
    source: "mock-market",
  };
}

async function buildClusterSeries(req, options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const windowKey = normalizeWindow(options.window);
  const points = normalizePoints(options.points, 40);
  const clusterId = String(options.clusterId || "");
  const angelSession = angelSessionFromRequest(req);

  if (liveMarketEnabled() && angelSession.connected) {
    try {
      const liveView = await buildLiveMarketView({ exchange, session: angelSession });
      const payload = getLiveComparisonSeries({
        view: liveView,
        clusterIds: clusterId,
        window: windowKey,
        exchange,
        points,
      });
      if (payload?.seriesByClusterId?.[clusterId]?.length) {
        return {
          series: payload.seriesByClusterId[clusterId],
          asOf: payload.asOf,
          source: "angel-live",
        };
      }
    } catch (_error) {
      // fall through
    }
  }

  const payload = mockMarket.getComparisonSeries({
    clusterIds: clusterId,
    window: windowKey,
    exchange,
    points,
  });
  return {
    series: payload?.seriesByClusterId?.[clusterId] || [],
    asOf: payload?.asOf || new Date().toISOString(),
    source: "mock-market",
  };
}

function buildSymbolSeries(baseSeries, stock, cluster, windowKey) {
  const symbol = String(stock.symbol || "").toUpperCase();
  const clusterMomentum = Number(cluster?.momentum?.[compareWindowToMomentumKey(windowKey)] || 0);
  const stockMomentum = Number(stock?.returns?.[compareWindowToMomentumKey(windowKey)] || 0);
  const relativeBias = stockMomentum - clusterMomentum;
  const seed = hashSeed(`${symbol}|${windowKey}|${cluster?.id || "cluster"}`) || 1;
  const random = mulberry32(seed);
  const phase = (seed % 628) / 100;

  return baseSeries.map((point, index) => {
    const wave = Math.sin((index / Math.max(baseSeries.length - 1, 1)) * Math.PI * 2 + phase) * 0.35;
    const noise = (random() - 0.5) * 0.3;
    const value = clamp(Number(point.value || 0) + relativeBias * 0.8 + wave + noise, -95, 95);
    return {
      ts: point.ts,
      value: Number.parseFloat(value.toFixed(4)),
    };
  });
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "peers-api");
  const respond = (statusCode, payload) =>
    json(res, statusCode, {
      ...(payload || {}),
      meta: {
        contractVersion: CONTRACTS.peers,
        traceId: trace.traceId,
      },
    });
  const route = String(req.query?.route || "").toLowerCase();

  if (route !== "relative-strength") {
    return respond(404, { error: "Not found" });
  }

  if (req.method !== "GET") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const exchange = normalizeExchange(req.query?.exchange);
    const windowKey = normalizeWindow(req.query?.window);
    const points = normalizePoints(req.query?.points, 40);
    const symbol = String(req.query?.symbol || "").toUpperCase();

    if (!symbol) {
      return respond(400, {
        error: "invalid-symbol",
        message: "symbol is required",
      });
    }

    const { view, source } = await buildMarketView(req, exchange);
    const stocks = Array.isArray(view?.stocks) ? view.stocks : [];

    const anchor = stocks.find((item) => {
      if (String(item.symbol || "").toUpperCase() !== symbol) return false;
      if (exchange === "all") return true;
      return String(item.exchange || "").toLowerCase() === exchange;
    });

    if (!anchor) {
      return respond(404, {
        error: "anchor-not-found",
        message: `Symbol ${symbol} not found in market view`,
      });
    }

    const cluster = (view.clusters || []).find((item) => item.id === anchor.clusterId);
    if (!cluster) {
      return respond(404, {
        error: "cluster-not-found",
        message: "Unable to resolve anchor cluster",
      });
    }

    const windowMomentumKey = compareWindowToMomentumKey(windowKey);
    const candidates = stocks
      .filter((item) => item.clusterId === cluster.id)
      .filter((item) => (exchange === "all" ? true : String(item.exchange || "").toLowerCase() === exchange));

    const ranked = candidates
      .filter((item) => String(item.symbol || "").toUpperCase() !== symbol)
      .map((item) => {
        const score =
          Math.abs(Number(item?.returns?.["1M"] || 0) - Number(anchor?.returns?.["1M"] || 0)) +
          0.6 * Math.abs(Number(item?.returns?.YTD || 0) - Number(anchor?.returns?.YTD || 0));
        return {
          stock: item,
          score: Number.parseFloat(score.toFixed(4)),
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        const leftMomentum = Number(left.stock?.returns?.[windowMomentumKey] || 0);
        const rightMomentum = Number(right.stock?.returns?.[windowMomentumKey] || 0);
        if (rightMomentum !== leftMomentum) return rightMomentum - leftMomentum;
        return String(right.stock?.symbol || "").localeCompare(String(left.stock?.symbol || ""));
      })
      .slice(0, 3);

    const baseSeriesPayload = await buildClusterSeries(req, {
      clusterId: cluster.id,
      window: windowKey,
      exchange,
      points,
    });

    const baseSeries = Array.isArray(baseSeriesPayload.series) ? baseSeriesPayload.series : [];
    const seriesBySymbol = {};
    if (baseSeries.length) {
      seriesBySymbol[symbol] = buildSymbolSeries(baseSeries, anchor, cluster, windowKey);
      ranked.forEach((entry) => {
        const peerSymbol = String(entry.stock.symbol || "").toUpperCase();
        seriesBySymbol[peerSymbol] = buildSymbolSeries(baseSeries, entry.stock, cluster, windowKey);
      });
    }

    const peers = ranked.map((entry) => ({
      ...serializeStock(entry.stock),
      competitorScore: entry.score,
    }));

    const payload = {
      asOf: baseSeriesPayload.asOf || new Date().toISOString(),
      exchange,
      window: windowKey,
      source,
      cluster: {
        id: cluster.id,
        name: cluster.name,
        headId: cluster.headId,
        headName: cluster.headName,
      },
      anchor: serializeStock(anchor),
      peers,
      seriesBySymbol,
    };

    traceLog(trace, "info", "peers.relative-strength.success", {
      symbol,
      peers: peers.length,
      clusterId: cluster.id,
      source,
    });

    return respond(200, payload);
  } catch (error) {
    traceLog(trace, "error", "peers.relative-strength.failed", { message: error.message });
    return respond(500, {
      error: "peers-relative-strength-failed",
      message: error.message,
    });
  }
};
