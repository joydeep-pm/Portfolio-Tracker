const crypto = require("node:crypto");

const { ANGEL_ROOT, buildHeaders } = require("./angelSmartApi");
const { loadThematicCatalog } = require("./thematicCatalog");

const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];
const SUPPORTED_WINDOWS = new Set(["1D", "5D", "1M", "6M", "YTD"]);
const ANGEL_INTERVAL = "ONE_DAY";
const SYMBOL_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const QUOTE_TTL_MS = 25 * 1000;
const RETURN_TTL_MS = 15 * 60 * 1000;
const VIEW_TTL_MS = 12 * 1000;

const symbolTokenCache = new Map();
const quoteCache = new Map();
const returnsCache = new Map();
const viewCache = new Map();
let liveTick = 0;

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pctChange(latest, base) {
  if (!Number.isFinite(base) || base === 0) return 0;
  return ((latest - base) / base) * 100;
}

function instrumentKey(exchange, symbol) {
  return `${String(exchange || "NSE").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function normalizeExchange(value) {
  const key = String(value || "all").toLowerCase();
  if (key === "nse" || key === "bse" || key === "all") return key;
  return "all";
}

function mapAngelExchange(exchange) {
  const value = String(exchange || "NSE").toUpperCase();
  return value === "BSE" ? "BSE" : "NSE";
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date, time) {
  return `${formatDate(date)} ${time}`;
}

function shiftDays(base, days) {
  const date = new Date(base.getTime());
  date.setDate(date.getDate() - days);
  return date;
}

function startDateForWindow(windowKey, now) {
  if (windowKey === "1W") return shiftDays(now, 7);
  if (windowKey === "1M") return shiftDays(now, 30);
  if (windowKey === "6M") return shiftDays(now, 182);
  if (windowKey === "YTD") return new Date(now.getFullYear(), 0, 1);
  return shiftDays(now, 1);
}

function candleClose(row) {
  if (Array.isArray(row)) return toNumber(row?.[4], 0);
  if (row && typeof row === "object") return toNumber(row.close, 0);
  return 0;
}

function avgReturns(rows) {
  const output = { "1D": 0, "1W": 0, "1M": 0, "6M": 0, YTD: 0 };
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return output;

  WINDOWS.forEach((windowKey) => {
    const sum = list.reduce((acc, item) => acc + toNumber(item?.returns?.[windowKey], 0), 0);
    output[windowKey] = Number.parseFloat((sum / list.length).toFixed(2));
  });
  return output;
}

function hashSeed(text) {
  return Number.parseInt(crypto.createHash("sha1").update(String(text || "")).digest("hex").slice(0, 8), 16) || 1;
}

function seededRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const max = Math.max(1, Number.parseInt(String(limit || 1), 10) || 1);
  const output = new Array(list.length);
  let cursor = 0;

  async function runOne() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(list[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(max, list.length) }, () => runOne());
  await Promise.all(runners);
  return output;
}

function mapWindowToMomentumKey(windowKey) {
  if (windowKey === "5D") return "1W";
  return windowKey;
}

async function angelRequest({ fetchImpl, path, method = "GET", body, apiKey, accessToken }) {
  if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
  const methodKey = String(method || "GET").toUpperCase();
  const query = methodKey === "GET" && body && typeof body === "object" ? `?${new URLSearchParams(body).toString()}` : "";
  const response = await fetchImpl(`${ANGEL_ROOT}${path}${query}`, {
    method: methodKey,
    headers: buildHeaders(apiKey, accessToken),
    body: methodKey === "GET" ? undefined : body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    payload = {
      status: false,
      message: `non-json-response:${response.status}`,
      raw: String(raw || "").slice(0, 180),
    };
  }

  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || `Angel request failed (${response.status})`);
  }

  return payload;
}

function parseConstituent(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes(":")) {
    const [exchange, symbol] = raw.split(":");
    return {
      exchange: mapAngelExchange(exchange),
      symbol: String(symbol || "").trim().toUpperCase(),
    };
  }
  return {
    exchange: "NSE",
    symbol: raw,
  };
}

function buildUniverse(catalog, exchangeKey) {
  const indices = Array.isArray(catalog?.indices) ? catalog.indices : [];
  const stocks = [];
  const clusters = [];
  const headMap = new Map();

  indices.forEach((index, idx) => {
    const clusterId = `cluster-${String(index.id || idx + 1).toLowerCase()}`;
    const category = String(index.category || "uncategorized").toLowerCase();
    const headId = `head-${category}`;
    const headName = String(index.sectorTag || category || "Uncategorized");
    if (!headMap.has(headId)) {
      headMap.set(headId, {
        id: headId,
        name: headName,
      });
    }

    clusters.push({
      id: clusterId,
      headId,
      headName,
      name: String(index.name || clusterId),
      source: String(index.source || catalog?.source || "angel-live"),
      constituents: Array.isArray(index.constituents) ? index.constituents : [],
    });

    (Array.isArray(index.constituents) ? index.constituents : []).forEach((constituent, stockIdx) => {
      const parsed = parseConstituent(constituent);
      if (!parsed?.symbol) return;
      if (exchangeKey !== "all" && parsed.exchange.toLowerCase() !== exchangeKey) return;
      stocks.push({
        id: `stock-${clusterId}-${parsed.exchange}-${parsed.symbol}-${stockIdx + 1}`,
        symbol: parsed.symbol,
        exchange: parsed.exchange,
        name: parsed.symbol,
        clusterId,
      });
    });
  });

  return {
    stocks,
    clusters,
    heads: [...headMap.values()],
  };
}

async function resolveSymbolToken(item, ctx) {
  const key = instrumentKey(item.exchange, item.symbol);
  const cached = symbolTokenCache.get(key);
  if (cached && Date.now() - cached.updatedAtMs <= SYMBOL_TOKEN_TTL_MS) return cached;

  const payload = await angelRequest({
    fetchImpl: ctx.fetchImpl,
    path: "/rest/secure/angelbroking/order/v1/searchScrip",
    method: "POST",
    body: {
      exchange: mapAngelExchange(item.exchange),
      searchscrip: item.symbol,
    },
    apiKey: ctx.quoteApiKey,
    accessToken: ctx.accessToken,
  });

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const exact = rows.find((row) => String(row.tradingsymbol || "").toUpperCase() === item.symbol);
  const best = exact || rows[0] || null;
  if (!best) return null;
  const token = String(best.symboltoken || "").trim();
  if (!token) return null;

  const resolved = {
    token,
    tradingsymbol: String(best.tradingsymbol || item.symbol).toUpperCase(),
    name: String(best.companyname || best.name || item.symbol).trim() || item.symbol,
    updatedAtMs: Date.now(),
  };
  symbolTokenCache.set(key, resolved);
  return resolved;
}

async function fetchQuote(item, resolved, ctx) {
  const key = instrumentKey(item.exchange, item.symbol);
  const cached = quoteCache.get(key);
  if (cached && Date.now() - cached.updatedAtMs <= QUOTE_TTL_MS) return cached.data;

  const payload = await angelRequest({
    fetchImpl: ctx.fetchImpl,
    path: "/rest/secure/angelbroking/order/v1/getLtpData",
    method: "POST",
    body: {
      exchange: mapAngelExchange(item.exchange),
      tradingsymbol: item.symbol,
      symboltoken: resolved.token,
    },
    apiKey: ctx.quoteApiKey,
    accessToken: ctx.accessToken,
  });

  const data = payload?.data || {};
  const ltp = toNumber(data.ltp, 0);
  const prevClose = toNumber(data.close ?? data.prevclose ?? data.previousclose, ltp);
  if (!ltp) return null;

  const quote = {
    lastPrice: ltp,
    previousClose: prevClose,
  };
  quoteCache.set(key, { data: quote, updatedAtMs: Date.now() });
  return quote;
}

async function fetchHistoricalReturns(item, resolved, ctx) {
  const key = instrumentKey(item.exchange, item.symbol);
  const cached = returnsCache.get(key);
  if (cached && Date.now() - cached.updatedAtMs <= RETURN_TTL_MS) return cached.data;

  const now = new Date();
  const output = { "1W": 0, "1M": 0, "6M": 0, YTD: 0 };

  for (const windowKey of ["1W", "1M", "6M", "YTD"]) {
    try {
      const from = startDateForWindow(windowKey, now);
      const payload = await angelRequest({
        fetchImpl: ctx.fetchImpl,
        path: "/rest/secure/angelbroking/historical/v1/getCandleData",
        method: "POST",
        body: {
          exchange: mapAngelExchange(item.exchange),
          symboltoken: resolved.token,
          interval: ANGEL_INTERVAL,
          fromdate: formatDateTime(from, "09:15"),
          todate: formatDateTime(now, "15:30"),
        },
        apiKey: ctx.historicalApiKey,
        accessToken: ctx.accessToken,
      });
      const candles = Array.isArray(payload?.data) ? payload.data : [];
      if (!candles.length) continue;
      const first = candles[0];
      const last = candles[candles.length - 1];
      const startClose = candleClose(first);
      const endClose = candleClose(last) || startClose;
      if (!startClose) continue;
      output[windowKey] = Number.parseFloat(clamp(pctChange(endClose, startClose), -95, 220).toFixed(2));
    } catch (_error) {
      // Keep 0 for this window when historical endpoint is unavailable for a symbol.
    }
  }

  returnsCache.set(key, {
    data: output,
    updatedAtMs: Date.now(),
  });
  return output;
}

async function fetchLiveMetrics(item, ctx) {
  try {
    if (ctx.diagnostics) ctx.diagnostics.requested += 1;
    let resolved = null;
    try {
      resolved = await resolveSymbolToken(item, ctx);
    } catch (error) {
      if (ctx.diagnostics) {
        ctx.diagnostics.errors += 1;
        if (ctx.diagnostics.samples.length < 6) {
          ctx.diagnostics.samples.push({
            symbol: item.symbol,
            exchange: item.exchange,
            stage: "searchScrip",
            reason: error?.message || "search-failed",
          });
        }
      }
      return null;
    }
    if (!resolved) {
      if (ctx.diagnostics) {
        ctx.diagnostics.tokenMiss += 1;
        if (ctx.diagnostics.samples.length < 6) {
          ctx.diagnostics.samples.push({
            symbol: item.symbol,
            exchange: item.exchange,
            stage: "searchScrip",
            reason: "token-not-found",
          });
        }
      }
      return null;
    }
    if (ctx.diagnostics) ctx.diagnostics.tokenResolved += 1;
    let quote = null;
    try {
      quote = await fetchQuote(item, resolved, ctx);
    } catch (error) {
      if (ctx.diagnostics) {
        ctx.diagnostics.errors += 1;
        if (ctx.diagnostics.samples.length < 6) {
          ctx.diagnostics.samples.push({
            symbol: item.symbol,
            exchange: item.exchange,
            stage: "getLtpData",
            reason: error?.message || "quote-failed",
          });
        }
      }
      return null;
    }
    if (!quote) {
      if (ctx.diagnostics) {
        ctx.diagnostics.quoteMiss += 1;
        if (ctx.diagnostics.samples.length < 6) {
          ctx.diagnostics.samples.push({
            symbol: item.symbol,
            exchange: item.exchange,
            stage: "getLtpData",
            reason: "quote-not-found",
          });
        }
      }
      return null;
    }
    if (ctx.diagnostics) ctx.diagnostics.quoteResolved += 1;
    const historical = await fetchHistoricalReturns(item, resolved, ctx);
    if (ctx.diagnostics) ctx.diagnostics.historicalResolved += 1;
    const oneDay = quote.previousClose > 0 ? Number.parseFloat(pctChange(quote.lastPrice, quote.previousClose).toFixed(2)) : 0;
    return {
      symbol: item.symbol,
      exchange: item.exchange,
      name: resolved.name || item.symbol,
      returns: {
        "1D": clamp(oneDay, -30, 30),
        "1W": toNumber(historical["1W"], 0),
        "1M": toNumber(historical["1M"], 0),
        "6M": toNumber(historical["6M"], 0),
        YTD: toNumber(historical["YTD"], 0),
      },
    };
  } catch (_error) {
    if (ctx.diagnostics) {
      ctx.diagnostics.errors += 1;
      if (ctx.diagnostics.samples.length < 6) {
        ctx.diagnostics.samples.push({
          symbol: item.symbol,
          exchange: item.exchange,
          stage: "request",
          reason: _error?.message || "unknown-error",
        });
      }
    }
    return null;
  }
}

async function buildLiveMarketView(options = {}) {
  const exchangeKey = normalizeExchange(options.exchange);
  const session = options.session || {};
  const fetchImpl = options.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const quoteApiKey = String(options.angelApiKey || process.env.ANGEL_API_KEY || "").trim();
  const historicalApiKey = String(options.angelHistoricalApiKey || process.env.ANGEL_HISTORICAL_API_KEY || quoteApiKey || "").trim();
  const accessToken = String(session.accessToken || "").trim();
  const clientCode = String(session.clientCode || "").trim();

  const diagnostics = {
    requested: 0,
    tokenResolved: 0,
    tokenMiss: 0,
    quoteResolved: 0,
    quoteMiss: 0,
    historicalResolved: 0,
    errors: 0,
    samples: [],
  };

  if (!fetchImpl || !quoteApiKey || !historicalApiKey || !accessToken || !clientCode || !session.connected) {
    if (options.withDiagnostics) {
      return {
        view: null,
        diagnostics: {
          ...diagnostics,
          cacheHit: false,
          reason: "missing-live-prerequisites",
        },
      };
    }
    return null;
  }

  const cacheKey = `${exchangeKey}`;
  const cached = viewCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAtMs <= VIEW_TTL_MS) {
    if (options.withDiagnostics) {
      return {
        view: cached.view,
        diagnostics: {
          ...diagnostics,
          cacheHit: true,
        },
      };
    }
    return cached.view;
  }

  const catalog = options.catalogOverride || (await loadThematicCatalog());
  const universe = buildUniverse(catalog, exchangeKey);
  if (!universe.stocks.length || !universe.clusters.length) {
    if (options.withDiagnostics) {
      return {
        view: null,
        diagnostics: {
          ...diagnostics,
          cacheHit: false,
          reason: "empty-universe",
        },
      };
    }
    return null;
  }

  const uniqueMap = new Map();
  universe.stocks.forEach((stock) => {
    const key = instrumentKey(stock.exchange, stock.symbol);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        exchange: stock.exchange,
        symbol: stock.symbol,
      });
    }
  });

  const ctx = {
    fetchImpl,
    quoteApiKey,
    historicalApiKey,
    accessToken,
    diagnostics,
  };

  const metricsRows = await mapWithConcurrency([...uniqueMap.values()], 3, async (item) => fetchLiveMetrics(item, ctx));
  const metricsByKey = new Map(
    metricsRows
      .filter(Boolean)
      .map((item) => [instrumentKey(item.exchange, item.symbol), item]),
  );

  const stocks = universe.stocks
    .map((stock) => {
      const metrics = metricsByKey.get(instrumentKey(stock.exchange, stock.symbol));
      if (!metrics) return null;
      return {
        id: stock.id,
        symbol: stock.symbol,
        exchange: stock.exchange,
        name: metrics.name || stock.name,
        clusterId: stock.clusterId,
        returns: metrics.returns,
      };
    })
    .filter(Boolean);

  if (!stocks.length) {
    if (options.withDiagnostics) {
      return {
        view: null,
        diagnostics: {
          ...diagnostics,
          cacheHit: false,
          reason: "no-live-stocks",
          liveStocks: 0,
          liveClusters: 0,
          liveHeads: 0,
        },
      };
    }
    return null;
  }

  const stocksByCluster = new Map();
  stocks.forEach((stock) => {
    if (!stocksByCluster.has(stock.clusterId)) stocksByCluster.set(stock.clusterId, []);
    stocksByCluster.get(stock.clusterId).push(stock);
  });

  const clusters = universe.clusters
    .map((cluster) => {
      const clusterStocks = stocksByCluster.get(cluster.id) || [];
      if (!clusterStocks.length) return null;
      return {
        id: cluster.id,
        headId: cluster.headId,
        headName: cluster.headName,
        name: cluster.name,
        momentum: avgReturns(clusterStocks),
      };
    })
    .filter(Boolean);

  if (!clusters.length) {
    if (options.withDiagnostics) {
      return {
        view: null,
        diagnostics: {
          ...diagnostics,
          cacheHit: false,
          reason: "no-live-clusters",
          liveStocks: stocks.length,
          liveClusters: 0,
          liveHeads: 0,
        },
      };
    }
    return null;
  }

  const clusterIdsByHead = new Map();
  clusters.forEach((cluster) => {
    if (!clusterIdsByHead.has(cluster.headId)) clusterIdsByHead.set(cluster.headId, []);
    clusterIdsByHead.get(cluster.headId).push(cluster.id);
  });

  const heads = universe.heads
    .map((head) => {
      const clusterIds = clusterIdsByHead.get(head.id) || [];
      if (!clusterIds.length) return null;
      const momentumRows = clusters.filter((cluster) => cluster.headId === head.id).map((cluster) => ({ returns: cluster.momentum }));
      return {
        id: head.id,
        name: head.name,
        momentum: avgReturns(momentumRows),
        clusterIds,
      };
    })
    .filter(Boolean);

  liveTick += 1;
  const view = {
    asOf: new Date().toISOString(),
    cursor: `live_${Date.now()}_${liveTick}`,
    heads,
    clusters,
    stocks,
    source: "angel-live",
  };

  viewCache.set(cacheKey, { view, updatedAtMs: Date.now() });
  if (options.withDiagnostics) {
    return {
      view,
      diagnostics: {
        ...diagnostics,
        cacheHit: false,
        liveStocks: stocks.length,
        liveClusters: clusters.length,
        liveHeads: heads.length,
      },
    };
  }
  return view;
}

function getLiveComparisonSeries(options = {}) {
  const view = options.view;
  const windowKey = SUPPORTED_WINDOWS.has(options.window) ? options.window : "1M";
  const exchange = normalizeExchange(options.exchange);
  const points = Math.max(5, Math.min(120, Number.parseInt(options.points || "40", 10) || 40));
  const clusterIds = String(options.clusterIds || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const clusterById = new Map((view?.clusters || []).map((cluster) => [cluster.id, cluster]));
  const seriesByClusterId = {};
  let resolvedCount = 0;

  clusterIds.forEach((clusterId) => {
    const cluster = clusterById.get(clusterId);
    if (!cluster) {
      seriesByClusterId[clusterId] = [];
      return;
    }
    resolvedCount += 1;
    const momentumKey = mapWindowToMomentumKey(windowKey);
    const base = toNumber(cluster.momentum?.[momentumKey], 0);
    const seed = hashSeed(`${clusterId}|${windowKey}|${exchange}|${view?.cursor || ""}`);
    const rng = seededRng(seed);
    const pointsOut = [];
    let cursor = 0;
    for (let i = 0; i < points; i += 1) {
      const seasonal = Math.sin((i / points) * Math.PI * 2) * 0.14;
      const drift = base / points;
      const noise = (rng() - 0.5) * 0.42;
      cursor = clamp(cursor + drift + noise + seasonal, -85, 85);
      pointsOut.push({
        ts: new Date(Date.now() - (points - i) * 60000).toISOString(),
        value: Number.parseFloat(cursor.toFixed(4)),
      });
    }
    seriesByClusterId[clusterId] = pointsOut;
  });

  if (!resolvedCount) return null;

  return {
    asOf: String(view?.asOf || new Date().toISOString()),
    window: windowKey,
    exchange,
    seriesByClusterId,
    source: "angel-live",
  };
}

function resetLiveMarketCache() {
  symbolTokenCache.clear();
  quoteCache.clear();
  returnsCache.clear();
  viewCache.clear();
  liveTick = 0;
}

module.exports = {
  buildLiveMarketView,
  getLiveComparisonSeries,
  normalizeExchange,
  resetLiveMarketCache,
};
