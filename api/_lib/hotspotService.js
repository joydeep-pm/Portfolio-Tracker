const { bootstrapPortfolio } = require("./portfolioService");
const { runPkScreenerScans, SUPPORTED_SCAN_TYPES } = require("./pkscreenerAdapter");

const IST_OFFSET_MINUTES = 330;

const runtime = {
  cache: null,
  cursor: "",
  tick: 0,
  lastRunAtMs: 0,
  lastSuccessAtMs: 0,
  consecutiveFailures: 0,
  lastError: "",
};

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeExchange(value) {
  const key = String(value || "all").toLowerCase();
  if (key === "nse" || key === "bse") return key;
  return "all";
}

function instrumentKey(exchange, symbol) {
  return `${String(exchange || "NSE").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function dateToIstParts(date) {
  const istMs = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const istDate = new Date(istMs);
  return {
    day: istDate.getUTCDay(),
    hour: istDate.getUTCHours(),
    minute: istDate.getUTCMinutes(),
  };
}

function isMarketHoursIST(date = new Date()) {
  const { day, hour, minute } = dateToIstParts(date);
  if (day === 0 || day === 6) return false;
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
}

function getScanCadenceMs(date = new Date()) {
  return isMarketHoursIST(date) ? 5 * 60 * 1000 : 30 * 60 * 1000;
}

function shouldRefreshCache(state, options = {}) {
  const force = Boolean(options.forceRefresh);
  if (force) return true;
  if (!state.cache) return true;
  if (state.cache.exchange !== options.exchange) return true;

  const nowMs = Number(options.nowMs || Date.now());
  const cadenceMs = Number(options.cadenceMs || getScanCadenceMs(new Date(nowMs)));
  return nowMs - Number(state.lastRunAtMs || 0) >= cadenceMs;
}

function scoreThemeState(themeState) {
  const totalConstituents = themeState.members.size;
  const flaggedConstituents = themeState.flaggedMembers.size;
  const breadthPct = totalConstituents > 0 ? Number.parseFloat(((flaggedConstituents / totalConstituents) * 100).toFixed(2)) : 0;

  const scanFlags = SUPPORTED_SCAN_TYPES.map((scanType) => {
    const current = themeState.flagsByType[scanType] || { count: 0, scoreSum: 0 };
    const avgScore = current.count > 0 ? current.scoreSum / current.count : 0;
    return {
      type: scanType,
      count: current.count,
      avgScore: Number.parseFloat(avgScore.toFixed(2)),
    };
  });

  const breakout = scanFlags.find((item) => item.type === "breakout")?.avgScore || 0;
  const consolidation = scanFlags.find((item) => item.type === "consolidation")?.avgScore || 0;
  const momentumAnomaly = scanFlags.find((item) => item.type === "momentum_anomaly")?.avgScore || 0;

  const momentumStrength = Number.parseFloat(((breakout * 0.45 + momentumAnomaly * 0.55) / 100).toFixed(4));
  const score = clamp(breakout * 0.32 + consolidation * 0.2 + momentumAnomaly * 0.28 + breadthPct * 0.2, 0, 100);
  const catalystFlags = [...scanFlags]
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.avgScore - a.avgScore;
    })
    .slice(0, 3)
    .map((item) => item.type);

  return {
    themeId: themeState.themeId,
    themeName: themeState.themeName,
    indexCategory: themeState.indexCategory,
    sectorTag: themeState.sectorTag,
    source: themeState.source,
    constituentCount: totalConstituents,
    flaggedConstituentCount: flaggedConstituents,
    breadthPct,
    momentumStrength,
    score: Number.parseFloat(score.toFixed(2)),
    scanFlags,
    catalystFlags,
  };
}

function buildHotspotScores(snapshot, scanResult) {
  const mappings = Array.isArray(snapshot?.thematicMappings) ? snapshot.thematicMappings : [];
  const scanRows = Array.isArray(scanResult?.rows) ? scanResult.rows : [];
  const scanByInstrument = new Map(scanRows.map((row) => [instrumentKey(row.exchange, row.symbol), row]));
  const themes = new Map();

  mappings.forEach((mapping) => {
    const symbol = String(mapping.symbol || "").toUpperCase();
    const exchange = String(mapping.exchange || "NSE").toUpperCase();
    const themeId = String(mapping.index_id || mapping.index_name || "unmapped").toLowerCase();
    const themeName = String(mapping.index_name || "UNMAPPED");
    const key = `${themeId}:${themeName}`;

    if (!themes.has(key)) {
      themes.set(key, {
        themeId,
        themeName,
        indexCategory: String(mapping.index_category || "unclassified"),
        sectorTag: String(mapping.sector_tag || "Unknown"),
        source: String(mapping.source || "unknown"),
        members: new Set(),
        flaggedMembers: new Set(),
        flagsByType: {},
      });
    }

    const themeState = themes.get(key);
    const rowKey = instrumentKey(exchange, symbol);
    themeState.members.add(rowKey);

    const scan = scanByInstrument.get(rowKey);
    if (!scan || !Array.isArray(scan.scanFlags) || scan.scanFlags.length === 0) return;
    themeState.flaggedMembers.add(rowKey);

    scan.scanFlags.forEach((flag) => {
      const type = String(flag.type || "").toLowerCase();
      if (!SUPPORTED_SCAN_TYPES.includes(type)) return;
      if (!themeState.flagsByType[type]) {
        themeState.flagsByType[type] = { count: 0, scoreSum: 0 };
      }
      themeState.flagsByType[type].count += 1;
      themeState.flagsByType[type].scoreSum += toNumber(flag.score, 0);
    });
  });

  const hotspots = [...themes.values()]
    .map(scoreThemeState)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.breadthPct - a.breadthPct;
    });

  return {
    hotspots,
    coverage: {
      totalThemes: hotspots.length,
      totalMappedHoldings: new Set(mappings.map((item) => instrumentKey(item.exchange, item.symbol))).size,
      totalScanSymbols: scanRows.length,
    },
  };
}

function schedulerState(now, options = {}) {
  const cadenceMs = getScanCadenceMs(now);
  const staleThresholdMs = cadenceMs * 2;
  const lastSuccessAtMs = Number(runtime.lastSuccessAtMs || 0);
  const nowMs = now.getTime();
  const staleByGap = lastSuccessAtMs > 0 ? nowMs - lastSuccessAtMs > staleThresholdMs : true;
  const staleByFailures = runtime.consecutiveFailures >= 2;
  const stale = staleByGap || staleByFailures;

  return {
    cadenceSec: Math.round(cadenceMs / 1000),
    marketHours: isMarketHoursIST(now),
    stale,
    consecutiveFailures: runtime.consecutiveFailures,
    lastSuccessAt: runtime.lastSuccessAtMs ? new Date(runtime.lastSuccessAtMs).toISOString() : null,
    lastRunAt: runtime.lastRunAtMs ? new Date(runtime.lastRunAtMs).toISOString() : null,
    nextRunInSec: Math.max(0, Math.round((runtime.lastRunAtMs + cadenceMs - nowMs) / 1000)),
    lastError: runtime.lastError || null,
    exchange: options.exchange || "all",
  };
}

async function refreshHotspots(options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const snapshot = await bootstrapPortfolio({
    exchange,
    forceRefresh: Boolean(options.forcePortfolioRefresh),
  });

  const instruments = snapshot.rows.map((row) => ({
    symbol: row.symbol,
    exchange: row.exchange,
  }));
  const scans = await runPkScreenerScans({
    instruments,
    asOf: snapshot.asOf,
  });

  const hotspot = buildHotspotScores(snapshot, scans);
  return {
    asOf: snapshot.asOf,
    exchange,
    source: scans.source,
    thematicCatalogSource: snapshot.thematicCatalogSource || null,
    hotspots: hotspot.hotspots,
    coverage: hotspot.coverage,
  };
}

async function getHotspotSnapshot(options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const now = options.now instanceof Date ? options.now : new Date();
  const cadenceMs = getScanCadenceMs(now);
  const refresh = shouldRefreshCache(runtime, {
    forceRefresh: Boolean(options.forceRefresh),
    exchange,
    nowMs: now.getTime(),
    cadenceMs,
  });

  if (!refresh && runtime.cache) {
    return {
      ...runtime.cache,
      cursor: runtime.cursor,
      scheduler: schedulerState(now, { exchange }),
    };
  }

  runtime.lastRunAtMs = now.getTime();
  try {
    const payload = await refreshHotspots({
      exchange,
      forcePortfolioRefresh: Boolean(options.forcePortfolioRefresh),
    });
    runtime.cache = payload;
    runtime.consecutiveFailures = 0;
    runtime.lastSuccessAtMs = Date.now();
    runtime.lastError = "";
    runtime.tick += 1;
    runtime.cursor = `hotspots_${Date.now()}_${runtime.tick}`;
  } catch (error) {
    runtime.consecutiveFailures += 1;
    runtime.lastError = error.message || String(error);
    if (!runtime.cache) throw error;
  }

  return {
    ...runtime.cache,
    cursor: runtime.cursor,
    scheduler: schedulerState(now, { exchange }),
  };
}

async function pollHotspots(options = {}) {
  const snapshot = await getHotspotSnapshot({
    exchange: options.exchange,
    forceRefresh: false,
    forcePortfolioRefresh: false,
  });

  const previousCursor = String(options.cursor || "");
  const changed = previousCursor !== snapshot.cursor;

  return {
    asOf: snapshot.asOf,
    cursor: snapshot.cursor,
    updates: {
      hotspots: changed ? snapshot.hotspots : [],
      coverage: changed ? snapshot.coverage : null,
    },
    scheduler: snapshot.scheduler,
    source: snapshot.source,
    thematicCatalogSource: snapshot.thematicCatalogSource || null,
  };
}

module.exports = {
  getHotspotSnapshot,
  pollHotspots,
  buildHotspotScores,
  shouldRefreshCache,
  getScanCadenceMs,
  isMarketHoursIST,
};
