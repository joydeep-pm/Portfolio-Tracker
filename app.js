const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];
const TARGET_STOCKS = 2486;
const TARGET_CLUSTERS = 175;
const MAX_COMPARE_SELECTION = 8;
const PORTFOLIO_ACTIONS = ["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"];

const CORE_HEADS = [
  "Banking & Financial Services",
  "IT Services & Digital Tech",
  "Automobiles & EV",
  "Capital Goods & Engineering",
  "Oil, Gas & Petrochemicals",
  "Power Utilities & Grid",
  "Renewable Energy",
  "Metals & Mining",
  "Cement & Building Materials",
  "Realty & Urban Infra",
  "Telecom & Digital Infra",
  "Consumer Staples",
  "Consumer Discretionary",
  "Healthcare Services",
  "Pharma & Biotech",
  "Chemicals & Specialty",
  "Agriculture & Rural Demand",
  "Logistics, Ports & Rail",
  "Aviation & Travel",
  "Defence & Aerospace India",
  "PSU & Disinvestment",
  "Fintech & Payments India",
  "Media, Gaming & Entertainment",
  "Textiles & Apparel",
  "Water & Waste Management",
  "Data Centers & Cloud India",
];

const INDIA_CLUSTER_PATTERNS = [
  "Leaders",
  "Midcaps",
  "PSU Chain",
  "Exports",
  "Domestic Demand",
  "Ancillaries",
  "Capex Cycle",
  "Import Substitution",
  "Policy Beneficiaries",
  "Distribution Network",
  "Turnaround Basket",
  "Premium Segment",
  "Next-Gen Stack",
];

const STOCK_SUFFIX_A = [
  "Industries",
  "Technologies",
  "Capital",
  "Logistics",
  "Power",
  "Mobility",
  "Labs",
  "Infratech",
];

const STOCK_SUFFIX_B = ["Limited", "India", "Holdings", "Solutions", "Enterprises", "Services"];

const SYMBOL_PREFIXES = [
  "RELI",
  "TATA",
  "ADAN",
  "HDFC",
  "ICIC",
  "SBIN",
  "INFY",
  "WIPR",
  "BHAR",
  "LTIM",
  "NTPC",
  "ONGC",
  "COAL",
  "SUNP",
  "DRRD",
  "ASIA",
  "MARU",
  "BAJA",
  "ULTR",
  "PIDI",
  "DIVI",
  "ZOMT",
  "PAYT",
  "IRCT",
];

const EXCHANGES = ["NSE", "BSE"];

const INDIA_THEME_BIASES = {
  "Banking & Financial Services": 1.8,
  "IT Services & Digital Tech": 1.3,
  "Automobiles & EV": 1.1,
  "Capital Goods & Engineering": 1.4,
  "Oil, Gas & Petrochemicals": 0.5,
  "Power Utilities & Grid": 1.2,
  "Renewable Energy": 1.6,
  "Metals & Mining": 0.2,
  "Cement & Building Materials": 0.8,
  "Realty & Urban Infra": 1.0,
  "Telecom & Digital Infra": 0.9,
  "Consumer Staples": 0.4,
  "Consumer Discretionary": 0.7,
  "Healthcare Services": 0.9,
  "Pharma & Biotech": 1.0,
  "Chemicals & Specialty": 0.8,
  "Agriculture & Rural Demand": 0.6,
  "Logistics, Ports & Rail": 1.1,
  "Aviation & Travel": 0.5,
  "Defence & Aerospace India": 1.7,
  "PSU & Disinvestment": 0.6,
  "Fintech & Payments India": 1.2,
  "Media, Gaming & Entertainment": 0.7,
  "Textiles & Apparel": 0.3,
  "Water & Waste Management": 0.6,
  "Data Centers & Cloud India": 1.5,
};

const COMPARE_WINDOWS = {
  "1D": { points: 28, noise: 0.52, driftScale: 0.85, label: "Intraday" },
  "5D": { points: 34, noise: 0.68, driftScale: 0.95, label: "5 Sessions" },
  "1M": { points: 40, noise: 0.8, driftScale: 1.03, label: "1 Month" },
  "6M": { points: 46, noise: 0.96, driftScale: 1.14, label: "6 Months" },
  YTD: { points: 52, noise: 1.1, driftScale: 1.21, label: "Year To Date" },
};

const COMPARE_COLOR_PALETTE = [
  "#db8040",
  "#6d4fd9",
  "#4382d8",
  "#cc5293",
  "#d0a735",
  "#47a9bd",
  "#4bb27a",
  "#9f7d4b",
];

const AdapterCore = window.PortfolioAdapterCore;
if (!AdapterCore) {
  throw new Error("PortfolioAdapterCore is required. Ensure adapterCore.js is loaded before app.js.");
}

let state = {
  heads: [],
  clusters: [],
  stocks: [],
  mode: "all",
  search: "",
  isLive: true,
  activeClusterId: null,
  liveTick: 0,
  activeView: "themes",
  cursor: "",
  asOf: "",
  uiVariant: "data-command",
};

let compareState = {
  selectedClusterIds: [],
  window: "1M",
  exchange: "all",
  search: "",
  seriesByCluster: new Map(),
  colorByCluster: new Map(),
  resizeRaf: null,
  seriesRequestId: 0,
};

let themesState = {
  compactDensity: true,
};

let portfolioState = {
  rows: [],
  summary: null,
  decisions: [],
  cursor: "",
  asOf: "",
  connected: false,
  provider: "",
  providerMode: "",
  user: { userId: null, userName: null },
  selectedKey: "",
  filters: {
    action: "all",
    exchange: "all",
    confidenceMin: 0,
    search: "",
  },
  scanSort: "action_then_confidence",
};

let runtimeState = {
  adapter: null,
  adapterMode: "synthetic",
  pollTimer: null,
  pollInFlight: false,
  consecutiveFailures: 0,
  backoffFailures: 0,
  lastSuccessAtMs: 0,
  lastAsOfLabel: "",
  health: "ok",
  healthMessage: "",
  persistentWarning: "",
  portfolioConsecutiveFailures: 0,
  portfolioBackoffFailures: 0,
  portfolioPollInFlight: false,
  portfolioLastSuccessAtMs: 0,
  enablePortfolioView: true,
  enableComparisonClassic: true,
};

const themesViewEl = document.getElementById("themesView");
const comparisonViewEl = document.getElementById("comparisonView");
const portfolioViewEl = document.getElementById("portfolioView");
const viewLinks = [...document.querySelectorAll("[data-app-view-target]")];

const matrixEl = document.getElementById("matrix");
const statsEl = document.getElementById("statsRow");
const searchInput = document.getElementById("searchInput");
const modeButtons = [...document.querySelectorAll(".mode-btn[data-mode]")];
const liveToggle = document.getElementById("liveToggle");

const compareChipRow = document.getElementById("compareChipRow");
const compareClusterInput = document.getElementById("compareClusterInput");
const compareSearchResults = document.getElementById("compareSearchResults");
const compareMeta = document.getElementById("compareMeta");
const scanMeta = document.getElementById("scanMeta");
const compareCanvas = document.getElementById("compareCanvas");
const momentumScanList = document.getElementById("momentumScanList");
const compareWindowButtons = [...document.querySelectorAll("[data-compare-window]")];
const compareExchangeButtons = [...document.querySelectorAll("[data-compare-exchange]")];

const portfolioSummaryRow = document.getElementById("portfolioSummaryRow");
const portfolioRowsEl = document.getElementById("portfolioRows");
const portfolioMeta = document.getElementById("portfolioMeta");
const portfolioDecisionMeta = document.getElementById("portfolioDecisionMeta");
const portfolioDecisionPanel = document.getElementById("portfolioDecisionPanel");
const portfolioSourceChip = document.getElementById("portfolioSourceChip");
const portfolioConnectionChip = document.getElementById("portfolioConnectionChip");
const portfolioSearchInput = document.getElementById("portfolioSearchInput");
const portfolioConfidenceInput = document.getElementById("portfolioConfidenceInput");
const portfolioActionButtons = [...document.querySelectorAll("[data-portfolio-action]")];
const portfolioExchangeButtons = [...document.querySelectorAll("[data-portfolio-exchange]")];

const modal = document.getElementById("clusterModal");
const modalHead = document.getElementById("modalHead");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalTableWrap = document.getElementById("modalTableWrap");
const closeModal = document.getElementById("closeModal");
const liveSourceText = document.getElementById("liveSourceText");
const freshnessStatus = document.getElementById("freshnessStatus");
const healthStatus = document.getElementById("healthStatus");

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(14031988);

function randRange(min, max) {
  return min + rand() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function percent(v) {
  const rounded = Math.round(v * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function colorClass(value) {
  if (value <= -8) return "c-neg-strong";
  if (value <= -2) return "c-neg";
  if (value < 2) return "c-flat";
  if (value < 8) return "c-pos";
  return "c-pos-strong";
}

const PORTFOLIO_SCAN_ACTION_RANK = {
  BUY: 0,
  ACCUMULATE: 1,
  REDUCE: 2,
  SELL: 3,
  HOLD: 4,
};

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function symbolFromCluster(clusterName) {
  const code = clusterName
    .toUpperCase()
    .replace(/[^A-Z ]+/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.slice(0, 1))
    .join("")
    .slice(0, 4);
  return code.padEnd(4, "I");
}

function makeIndianSymbol(cluster, clusterIndex, stockIndexInCluster, globalStockIndex) {
  const prefixA = SYMBOL_PREFIXES[(clusterIndex + stockIndexInCluster) % SYMBOL_PREFIXES.length];
  const prefixB = symbolFromCluster(cluster.name);
  const prefix = `${prefixA}${prefixB}`.slice(0, 5);
  const suffix = String((globalStockIndex % 900) + 100);
  return `${prefix}${suffix}`;
}

function makeZeroReturns() {
  return WINDOWS.reduce((acc, w) => {
    acc[w] = 0;
    return acc;
  }, {});
}

function allocateClusterCounts() {
  const base = 6;
  const remainder = TARGET_CLUSTERS - CORE_HEADS.length * base;
  return CORE_HEADS.map((_, index) => base + (index < remainder ? 1 : 0));
}

function allocateStockCounts(clusterCount) {
  const min = 6;
  const counts = Array(clusterCount).fill(min);
  let remaining = TARGET_STOCKS - min * clusterCount;
  const weights = Array.from({ length: clusterCount }, () => randRange(0.4, 1.8));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < counts.length; i += 1) {
    const bonus = Math.floor((weights[i] / weightSum) * remaining);
    counts[i] += bonus;
    remaining -= bonus;
  }

  let cursor = 0;
  while (remaining > 0) {
    counts[cursor % counts.length] += 1;
    remaining -= 1;
    cursor += 1;
  }

  return counts;
}

function makeClusterName(headName, localIndex, globalIndex) {
  const base = headName
    .replace(/&/g, " ")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const pattern = INDIA_CLUSTER_PATTERNS[(localIndex + globalIndex * 2) % INDIA_CLUSTER_PATTERNS.length];
  return `${base} ${pattern}`;
}

function makeStockName(cluster, index) {
  const first = cluster.name.split(" ").slice(0, 2).join(" ");
  const a = STOCK_SUFFIX_A[index % STOCK_SUFFIX_A.length];
  const b = STOCK_SUFFIX_B[(index + 2) % STOCK_SUFFIX_B.length];
  return `${first} ${a} ${b}`;
}

function createStockReturns(bias) {
  return {
    "1D": clamp(randRange(-2.9, 2.9) + bias * 0.13, -14, 14),
    "1W": clamp(randRange(-5.4, 5.4) + bias * 0.28, -24, 24),
    "1M": clamp(randRange(-9.8, 9.8) + bias * 0.52, -38, 38),
    "6M": clamp(randRange(-20, 20) + bias * 1.06, -65, 65),
    YTD: clamp(randRange(-25, 25) + bias * 1.2, -80, 80),
  };
}

function averageReturns(returnMaps) {
  const out = makeZeroReturns();
  if (returnMaps.length === 0) return out;

  WINDOWS.forEach((window) => {
    let sum = 0;
    returnMaps.forEach((m) => {
      sum += m[window];
    });
    out[window] = sum / returnMaps.length;
  });

  return out;
}

function recalcAllMomentum(heads, clusters) {
  clusters.forEach((cluster) => {
    cluster.momentum = averageReturns(cluster.stocks.map((s) => s.returns));
  });

  heads.forEach((head) => {
    head.momentum = averageReturns(head.clusters.map((c) => c.momentum));
  });
}

function buildUniverse() {
  const headClusterCounts = allocateClusterCounts();
  const allClusters = [];
  const heads = [];
  let clusterGlobalIndex = 0;

  for (let headIndex = 0; headIndex < CORE_HEADS.length; headIndex += 1) {
    const headName = CORE_HEADS[headIndex];
    const count = headClusterCounts[headIndex];
    const head = {
      id: `head-${headIndex + 1}`,
      name: headName,
      clusters: [],
      momentum: makeZeroReturns(),
    };

    for (let clusterIndex = 0; clusterIndex < count; clusterIndex += 1) {
      const id = `cluster-${clusterGlobalIndex + 1}`;
      const clusterName = makeClusterName(headName, clusterIndex, clusterGlobalIndex);
      const cluster = {
        id,
        headId: head.id,
        headName,
        name: clusterName,
        stocks: [],
        momentum: makeZeroReturns(),
        trendBias: randRange(-5.2, 5.2) + (INDIA_THEME_BIASES[headName] || 0),
      };

      head.clusters.push(cluster);
      allClusters.push(cluster);
      clusterGlobalIndex += 1;
    }

    heads.push(head);
  }

  const stockCounts = allocateStockCounts(allClusters.length);
  const stocks = [];
  let stockIndex = 0;

  allClusters.forEach((cluster, clusterIndex) => {
    const count = stockCounts[clusterIndex];
    for (let i = 0; i < count; i += 1) {
      const stock = {
        id: `stock-${stockIndex + 1}`,
        symbol: makeIndianSymbol(cluster, clusterIndex, i, stockIndex),
        exchange: EXCHANGES[rand() > 0.28 ? 0 : 1],
        name: makeStockName(cluster, i),
        clusterId: cluster.id,
        returns: createStockReturns(cluster.trendBias),
      };
      cluster.stocks.push(stock);
      stocks.push(stock);
      stockIndex += 1;
    }
  });

  recalcAllMomentum(heads, allClusters);
  return { heads, clusters: allClusters, stocks };
}

function readRuntimeConfig() {
  const defaultMode = window.location && window.location.hostname.includes("vercel.app") ? "backend" : "synthetic";
  const defaultConfig = {
    dataMode: defaultMode,
    apiBaseUrl: "/api/v1",
    authToken: "public-client-token",
    enablePortfolioView: true,
    uiVariant: "data-command",
    enableComparisonClassic: true,
  };

  const incoming = window.PORTFOLIO_TRACKER_CONFIG || {};
  const dataMode = typeof incoming.dataMode === "string" ? incoming.dataMode.toLowerCase() : defaultConfig.dataMode;
  const uiVariant =
    typeof incoming.uiVariant === "string" && incoming.uiVariant.toLowerCase() === "classic"
      ? "classic"
      : defaultConfig.uiVariant;

  return {
    dataMode: dataMode === "backend" ? "backend" : "synthetic",
    apiBaseUrl: typeof incoming.apiBaseUrl === "string" && incoming.apiBaseUrl.trim() ? incoming.apiBaseUrl : defaultConfig.apiBaseUrl,
    authToken: typeof incoming.authToken === "string" ? incoming.authToken : defaultConfig.authToken,
    enablePortfolioView:
      typeof incoming.enablePortfolioView === "boolean" ? incoming.enablePortfolioView : defaultConfig.enablePortfolioView,
    uiVariant,
    enableComparisonClassic:
      typeof incoming.enableComparisonClassic === "boolean"
        ? incoming.enableComparisonClassic
        : defaultConfig.enableComparisonClassic,
  };
}

function applyUiVariantConfig(config) {
  state.uiVariant = config.uiVariant || "data-command";
  runtimeState.enableComparisonClassic = config.enableComparisonClassic !== false;
  document.body.dataset.uiVariant = state.uiVariant;
  document.body.dataset.comparisonStyle = runtimeState.enableComparisonClassic ? "classic" : "data-command";
}

function cloneReturns(returns) {
  return WINDOWS.reduce((acc, key) => {
    acc[key] = returns[key];
    return acc;
  }, {});
}

function normalizeUniverseForState(payload) {
  const stocks = payload.stocks.map((stock) => ({
    id: stock.id,
    symbol: stock.symbol,
    exchange: stock.exchange,
    name: stock.name,
    clusterId: stock.clusterId,
    returns: cloneReturns(stock.returns),
  }));

  const stocksByCluster = new Map();
  stocks.forEach((stock) => {
    if (!stocksByCluster.has(stock.clusterId)) stocksByCluster.set(stock.clusterId, []);
    stocksByCluster.get(stock.clusterId).push(stock);
  });

  const clustersById = new Map();
  const clusters = payload.clusters.map((cluster) => {
    const mapped = {
      id: cluster.id,
      headId: cluster.headId,
      headName: cluster.headName,
      name: cluster.name,
      stocks: stocksByCluster.get(cluster.id) || [],
      momentum: cloneReturns(cluster.momentum),
      trendBias: 0,
    };
    clustersById.set(mapped.id, mapped);
    return mapped;
  });

  const heads = payload.heads.map((head) => ({
    id: head.id,
    name: head.name,
    clusters: head.clusterIds.map((clusterId) => clustersById.get(clusterId)).filter(Boolean),
    momentum: cloneReturns(head.momentum),
  }));

  return { heads, clusters, stocks };
}

function currentStateAsAdapterDTO() {
  return {
    heads: state.heads.map((head) => ({
      id: head.id,
      name: head.name,
      momentum: cloneReturns(head.momentum),
      clusterIds: head.clusters.map((cluster) => cluster.id),
    })),
    clusters: state.clusters.map((cluster) => ({
      id: cluster.id,
      headId: cluster.headId,
      headName: cluster.headName,
      name: cluster.name,
      momentum: cloneReturns(cluster.momentum),
    })),
    stocks: state.stocks.map((stock) => ({
      id: stock.id,
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      clusterId: stock.clusterId,
      returns: cloneReturns(stock.returns),
    })),
  };
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function syntheticPortfolioBootstrapPayload() {
  const topRows = [...state.stocks]
    .sort((a, b) => b.returns["1M"] - a.returns["1M"])
    .slice(0, 18)
    .map((stock, index) => {
      const qty = 4 + (index % 6);
      const avg = 120 + index * 37;
      const last = avg * (1 + stock.returns["1D"] / 100);
      const invested = qty * avg;
      const current = qty * last;
      const pnl = current - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      const weightBase = index + 1;

      let action = "HOLD";
      if (stock.returns["6M"] > 15 && stock.returns["1M"] > 3) action = "BUY";
      else if (stock.returns["1M"] > 1) action = "ACCUMULATE";
      else if (stock.returns["6M"] < -8) action = "SELL";
      else if (stock.returns["1M"] < -4) action = "REDUCE";

      return {
        key: `${stock.exchange}:${stock.symbol}`,
        symbol: stock.symbol,
        exchange: stock.exchange,
        quantity: qty,
        averagePrice: Number.parseFloat(avg.toFixed(2)),
        lastPrice: Number.parseFloat(last.toFixed(2)),
        investedValue: Number.parseFloat(invested.toFixed(2)),
        currentValue: Number.parseFloat(current.toFixed(2)),
        unrealizedPnl: Number.parseFloat(pnl.toFixed(2)),
        unrealizedPnlPct: Number.parseFloat(pnlPct.toFixed(2)),
        weightPct: weightBase,
        returns: cloneReturns(stock.returns),
        product: "CNC",
        sourceTypes: ["synthetic"],
        decision: {
          symbol: stock.symbol,
          exchange: stock.exchange,
          action,
          confidence: Number.parseFloat(clamp(Math.abs(stock.returns["6M"]) * 3 + 42, 36, 95).toFixed(1)),
          score: Number.parseFloat(clamp(stock.returns["6M"] * 2 + stock.returns["1M"] * 3, -100, 100).toFixed(2)),
          reasons: [
            `6M trend ${percent(stock.returns["6M"])}`,
            `1M momentum ${percent(stock.returns["1M"])}`,
            `YTD context ${percent(stock.returns.YTD)}`,
          ],
          riskFlags: stock.returns["1D"] < -3 ? ["Short-term downside momentum"] : [],
          asOf: new Date().toISOString(),
        },
      };
    });

  const totalCurrent = topRows.reduce((acc, row) => acc + row.currentValue, 0);
  topRows.forEach((row) => {
    row.weightPct = totalCurrent > 0 ? Number.parseFloat(((row.currentValue / totalCurrent) * 100).toFixed(2)) : 0;
  });

  const totalInvested = topRows.reduce((acc, row) => acc + row.investedValue, 0);
  const totalPnl = totalCurrent - totalInvested;
  const asOf = new Date().toISOString();
  const decisions = topRows.map((row) => row.decision);

  return AdapterCore.normalizePortfolioBootstrapPayload({
    asOf,
    cursor: `synthetic_pf_${Date.now()}`,
    rows: topRows,
    summary: {
      totalSymbols: topRows.length,
      totalInvested: Number.parseFloat(totalInvested.toFixed(2)),
      totalCurrent: Number.parseFloat(totalCurrent.toFixed(2)),
      totalPnl: Number.parseFloat(totalPnl.toFixed(2)),
      totalPnlPct: totalInvested > 0 ? Number.parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
      gainers: topRows.filter((row) => row.unrealizedPnl > 0).length,
      losers: topRows.filter((row) => row.unrealizedPnl < 0).length,
      cashAvailable: 250000,
    },
    decisions,
    connected: false,
    provider: "synthetic",
    providerMode: "demo",
    user: { userId: null, userName: "Demo User" },
  });
}

function currentPortfolioStateAsAdapterDTO() {
  return {
    asOf: portfolioState.asOf,
    cursor: portfolioState.cursor,
    rows: portfolioState.rows,
    summary: portfolioState.summary || {
      totalSymbols: 0,
      totalInvested: 0,
      totalCurrent: 0,
      totalPnl: 0,
      totalPnlPct: 0,
      gainers: 0,
      losers: 0,
      cashAvailable: 0,
    },
    decisions: portfolioState.decisions || [],
    connected: portfolioState.connected,
    provider: portfolioState.provider || "synthetic",
    providerMode: portfolioState.providerMode || "demo",
    user: portfolioState.user || { userId: null, userName: null },
  };
}

function applyPortfolioBootstrap(payload) {
  portfolioState.rows = payload.rows.map((row) => ({
    ...row,
    returns: cloneReturns(row.returns),
    decision: {
      ...row.decision,
      reasons: [...row.decision.reasons],
      riskFlags: [...row.decision.riskFlags],
    },
  }));
  portfolioState.summary = { ...payload.summary };
  portfolioState.decisions = payload.decisions.map((decision) => ({
    ...decision,
    reasons: [...decision.reasons],
    riskFlags: [...decision.riskFlags],
  }));
  portfolioState.cursor = payload.cursor;
  portfolioState.asOf = payload.asOf;
  portfolioState.connected = payload.connected;
  portfolioState.provider = payload.provider;
  portfolioState.providerMode = payload.providerMode;
  portfolioState.user = payload.user || { userId: null, userName: null };
}

function syntheticBootstrapPayload(universe) {
  return AdapterCore.normalizeBootstrapPayload({
    asOf: new Date().toISOString(),
    cursor: `synthetic_${Date.now()}`,
    heads: universe.heads.map((head) => ({
      id: head.id,
      name: head.name,
      momentum: cloneReturns(head.momentum),
      clusterIds: head.clusters.map((cluster) => cluster.id),
    })),
    clusters: universe.clusters.map((cluster) => ({
      id: cluster.id,
      headId: cluster.headId,
      headName: cluster.headName,
      name: cluster.name,
      momentum: cloneReturns(cluster.momentum),
    })),
    stocks: universe.stocks.map((stock) => ({
      id: stock.id,
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      clusterId: stock.clusterId,
      returns: cloneReturns(stock.returns),
    })),
  });
}

function synthesizeStockUpdates() {
  return state.stocks.map((stock) => {
    const updated = {
      ...stock,
      returns: {
        ...stock.returns,
      },
    };

    updated.returns["1D"] = clamp(updated.returns["1D"] + (Math.random() - 0.5) * 0.72, -15, 15);
    updated.returns["1W"] = clamp(updated.returns["1W"] + updated.returns["1D"] * 0.018 + (Math.random() - 0.5) * 0.16, -30, 30);
    updated.returns["1M"] = clamp(updated.returns["1M"] + updated.returns["1D"] * 0.009 + (Math.random() - 0.5) * 0.08, -45, 45);
    updated.returns["6M"] = clamp(updated.returns["6M"] + updated.returns["1D"] * 0.006 + (Math.random() - 0.5) * 0.05, -70, 70);
    updated.returns.YTD = clamp(updated.returns.YTD + updated.returns["1D"] * 0.005 + (Math.random() - 0.5) * 0.04, -90, 90);

    return {
      id: updated.id,
      symbol: updated.symbol,
      exchange: updated.exchange,
      name: updated.name,
      clusterId: updated.clusterId,
      returns: cloneReturns(updated.returns),
    };
  });
}

/**
 * @typedef {Object} MarketDataAdapter
 * @property {(params?: {exchange?: string, window?: string}) => Promise<any>} bootstrap
 * @property {(params?: {cursor?: string, exchange?: string}) => Promise<any>} poll
 * @property {(params?: {clusterIds?: string[], window?: string, exchange?: string, points?: number}) => Promise<any>} fetchComparisonSeries
 */

/**
 * Synthetic fallback implementation of MarketDataAdapter.
 * Used when backend mode is disabled or backend config/auth is unavailable.
 * @returns {MarketDataAdapter}
 */
function createSyntheticAdapter() {
  const syntheticOrders = new Map();

  function syntheticPortfolioPollPayload() {
    const rows = portfolioState.rows.map((row) => {
      const nextLast = clamp(row.lastPrice * (1 + (Math.random() - 0.5) * 0.018), row.lastPrice * 0.92, row.lastPrice * 1.08);
      const nextReturns = {
        ...row.returns,
      };
      nextReturns["1D"] = clamp(nextReturns["1D"] + (Math.random() - 0.5) * 0.7, -18, 18);
      nextReturns["1W"] = clamp(nextReturns["1W"] + nextReturns["1D"] * 0.04 + (Math.random() - 0.5) * 0.22, -35, 35);
      nextReturns["1M"] = clamp(nextReturns["1M"] + nextReturns["1D"] * 0.025 + (Math.random() - 0.5) * 0.1, -55, 55);
      nextReturns["6M"] = clamp(nextReturns["6M"] + nextReturns["1M"] * 0.01 + (Math.random() - 0.5) * 0.07, -85, 85);
      nextReturns.YTD = clamp(nextReturns.YTD + nextReturns["1M"] * 0.008 + (Math.random() - 0.5) * 0.05, -95, 110);

      const investedValue = row.averagePrice * row.quantity;
      const currentValue = nextLast * row.quantity;
      const unrealizedPnl = currentValue - investedValue;
      const unrealizedPnlPct = investedValue > 0 ? (unrealizedPnl / investedValue) * 100 : 0;
      const score = clamp(nextReturns["6M"] * 1.9 + nextReturns["1M"] * 2.5 + nextReturns["1D"] * 0.8, -100, 100);
      let action = "HOLD";
      if (score >= 30) action = "BUY";
      else if (score >= 10) action = "ACCUMULATE";
      else if (score <= -38) action = "SELL";
      else if (score <= -14) action = "REDUCE";

      return {
        ...row,
        lastPrice: Number.parseFloat(nextLast.toFixed(4)),
        investedValue: Number.parseFloat(investedValue.toFixed(2)),
        currentValue: Number.parseFloat(currentValue.toFixed(2)),
        unrealizedPnl: Number.parseFloat(unrealizedPnl.toFixed(2)),
        unrealizedPnlPct: Number.parseFloat(unrealizedPnlPct.toFixed(2)),
        returns: nextReturns,
        decision: {
          ...row.decision,
          action,
          score: Number.parseFloat(score.toFixed(2)),
          confidence: Number.parseFloat(clamp(Math.abs(score) * 0.75 + 35, 36, 97).toFixed(1)),
          reasons: [`6M trend ${percent(nextReturns["6M"])}`, `1M momentum ${percent(nextReturns["1M"])}`],
          riskFlags: nextReturns["1D"] < -3 ? ["Short-term downside momentum"] : [],
          asOf: new Date().toISOString(),
        },
      };
    });

    const totalCurrent = rows.reduce((acc, row) => acc + row.currentValue, 0);
    const totalInvested = rows.reduce((acc, row) => acc + row.investedValue, 0);
    const totalPnl = totalCurrent - totalInvested;
    rows.forEach((row) => {
      row.weightPct = totalCurrent > 0 ? Number.parseFloat(((row.currentValue / totalCurrent) * 100).toFixed(2)) : 0;
    });

    return AdapterCore.normalizePortfolioPollPayload({
      asOf: new Date().toISOString(),
      cursor: `synthetic_pf_${Date.now()}`,
      updates: {
        rows,
        decisions: rows.map((row) => row.decision),
        summary: {
          totalSymbols: rows.length,
          totalInvested: Number.parseFloat(totalInvested.toFixed(2)),
          totalCurrent: Number.parseFloat(totalCurrent.toFixed(2)),
          totalPnl: Number.parseFloat(totalPnl.toFixed(2)),
          totalPnlPct: totalInvested > 0 ? Number.parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
          gainers: rows.filter((row) => row.unrealizedPnl > 0).length,
          losers: rows.filter((row) => row.unrealizedPnl < 0).length,
          cashAvailable: portfolioState.summary?.cashAvailable || 250000,
        },
      },
      connected: false,
      provider: "synthetic",
      providerMode: "demo",
    });
  }

  return {
    mode: "synthetic",
    async bootstrap() {
      return syntheticBootstrapPayload(buildUniverse());
    },
    async poll() {
      return AdapterCore.normalizePollPayload({
        asOf: new Date().toISOString(),
        cursor: `synthetic_${Date.now()}`,
        updates: {
          stocks: synthesizeStockUpdates(),
          clusters: [],
          heads: [],
        },
      });
    },
    async fetchComparisonSeries(params) {
      const seriesByClusterId = {};
      const selectedIds = params?.clusterIds || [];
      const points = Number.isFinite(params?.points) ? params.points : 40;
      selectedIds.forEach((clusterId) => {
        const pointsForCluster = compareSeriesForCluster(clusterId, params?.window || compareState.window, params?.exchange || compareState.exchange);
        seriesByClusterId[clusterId] = pointsForCluster.slice(-points).map((point, index) => ({
          ts: new Date(Date.now() - (points - index) * 60000).toISOString(),
          value: point.y,
        }));
      });

      return AdapterCore.normalizeComparisonPayload({
        asOf: new Date().toISOString(),
        window: params?.window || compareState.window,
        exchange: params?.exchange || compareState.exchange || "all",
        seriesByClusterId,
      });
    },
    async fetchPortfolioBootstrap() {
      return syntheticPortfolioBootstrapPayload();
    },
    async pollPortfolio() {
      return syntheticPortfolioPollPayload();
    },
    async fetchPortfolioDecisions() {
      return {
        asOf: portfolioState.asOf || new Date().toISOString(),
        decisions: portfolioState.rows.map((row) => row.decision),
      };
    },
    async createPortfolioEodSnapshot() {
      return {
        stored: true,
        mode: "memory",
        snapshotDate: new Date().toISOString().slice(0, 10),
      };
    },
    async previewOrder(payload) {
      const quantity = Math.max(0, Math.floor(Number(payload?.quantity || 0)));
      const row = portfolioState.rows.find(
        (item) => item.symbol === String(payload?.symbol || "").toUpperCase() && item.exchange === String(payload?.exchange || "NSE").toUpperCase(),
      );
      const price = Number(payload?.price || row?.lastPrice || 0);
      if (!quantity || !price) {
        return { ok: false, error: "symbol/quantity/price required" };
      }
      return {
        ok: true,
        dryRun: true,
        previewId: `synthetic_preview_${Date.now()}`,
        symbol: String(payload?.symbol || "").toUpperCase(),
        exchange: String(payload?.exchange || "NSE").toUpperCase(),
        side: String(payload?.side || "BUY").toUpperCase(),
        quantity,
        price,
        notionalValue: Number.parseFloat((quantity * price).toFixed(2)),
        charges: { total: Number.parseFloat((quantity * price * 0.001).toFixed(2)) },
        estimatedTotal: Number.parseFloat((quantity * price * 1.001).toFixed(2)),
        guardrails: { maxOrderValue: 200000, exceedsLimit: quantity * price > 200000 },
      };
    },
    async submitOrder(payload) {
      const preview = await this.previewOrder(payload);
      if (!preview.ok) return preview;
      const id = `synthetic_ord_${Date.now()}`;
      syntheticOrders.set(id, { ...preview, id, status: "DRY_RUN", createdAt: new Date().toISOString() });
      return { submitted: false, dryRun: true, order: syntheticOrders.get(id) };
    },
    async fetchOrderStatus(params) {
      const order = syntheticOrders.get(String(params?.id || ""));
      if (!order) {
        throw new Error("order-not-found");
      }
      return {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        symbol: order.symbol,
        exchange: order.exchange,
        side: order.side,
        quantity: order.quantity,
        notionalValue: order.notionalValue,
        dryRun: true,
        note: "Synthetic mode order",
      };
    },
  };
}

function resolveAdapter() {
  const config = readRuntimeConfig();
  if (config.dataMode === "backend") {
    try {
      const adapter = AdapterCore.createBackendAdapter({
        apiBaseUrl: config.apiBaseUrl,
        authToken: config.authToken,
      });

      return {
        adapter,
        mode: "backend",
        warning: "",
        config,
      };
    } catch (error) {
      return {
        adapter: createSyntheticAdapter(),
        mode: "synthetic",
        warning: error.message || "Backend adapter unavailable. Using synthetic mode.",
        config,
      };
    }
  }

  return {
    adapter: createSyntheticAdapter(),
    mode: "synthetic",
    warning: "",
    config,
  };
}

function matchesSearch(cluster, query) {
  if (!query) return true;
  const lower = query.toLowerCase();

  if (cluster.name.toLowerCase().includes(lower)) return true;
  if (cluster.headName.toLowerCase().includes(lower)) return true;

  return cluster.stocks.some(
    (stock) =>
      stock.symbol.toLowerCase().includes(lower) ||
      stock.name.toLowerCase().includes(lower) ||
      stock.exchange.toLowerCase().includes(lower),
  );
}

function modePasses(cluster, mode) {
  if (mode === "movers") return cluster.momentum["1D"] >= 0;
  if (mode === "laggards") return cluster.momentum["1D"] < 0;
  return true;
}

function getVisibleClustersByHead() {
  const grouped = new Map();
  state.heads.forEach((head) => grouped.set(head.id, []));

  state.clusters.forEach((cluster) => {
    if (!matchesSearch(cluster, state.search)) return;
    if (!modePasses(cluster, state.mode)) return;
    grouped.get(cluster.headId).push(cluster);
  });

  return grouped;
}

function renderStats(visibleClustersByHead) {
  const visibleClusters = [];
  visibleClustersByHead.forEach((clusters) => visibleClusters.push(...clusters));
  const stockCount = visibleClusters.reduce((acc, cluster) => acc + cluster.stocks.length, 0);
  const nseCount = state.stocks.filter((stock) => stock.exchange === "NSE").length;
  const bseCount = state.stocks.length - nseCount;

  const flatMomentum = visibleClusters.length
    ? averageReturns(visibleClusters.map((cluster) => cluster.momentum))
    : makeZeroReturns();

  const cards = [
    { label: "Universe", value: `${state.stocks.length.toLocaleString()} Stocks` },
    { label: "Core Heads", value: `${state.heads.length}` },
    { label: "Micro-Clusters", value: `${state.clusters.length}` },
    { label: "Visible Stocks", value: `${stockCount.toLocaleString()}` },
    { label: "Exchange Mix", value: `NSE ${nseCount.toLocaleString()} | BSE ${bseCount.toLocaleString()}` },
    { label: "Market Breadth (1D)", value: percent(flatMomentum["1D"]) },
    { label: "Pulse Tick", value: `#${state.liveTick}` },
  ];

  statsEl.innerHTML = cards
    .map((card) => `<article class="stat-card"><p>${card.label}</p><h3>${card.value}</h3></article>`)
    .join("");
}

function clusterRowHtml(cluster) {
  const cells = WINDOWS.map((w) => `<span class="cell ${colorClass(cluster.momentum[w])}">${percent(cluster.momentum[w])}</span>`).join("");
  return `
    <button class="cluster-row" data-cluster-id="${cluster.id}" aria-label="Open ${cluster.name}">
      <span class="cluster-name">${cluster.name}</span>
      <span class="cluster-count">(${cluster.stocks.length})</span>
      ${cells}
    </button>
  `;
}

function renderMatrix() {
  const grouped = getVisibleClustersByHead();
  renderStats(grouped);
  matrixEl.classList.toggle("matrix-compact", themesState.compactDensity);

  const headHtml = state.heads
    .map((head) => {
      const clusters = grouped.get(head.id) || [];
      if (!clusters.length) return "";

      const rows = clusters
        .sort((a, b) => b.momentum["1D"] - a.momentum["1D"])
        .map((cluster) => clusterRowHtml(cluster))
        .join("");

      return `
        <article class="head-card">
          <h3 class="head-title">${head.name}</h3>
          <div class="table-head">
            <span>Cluster</span><span></span>${WINDOWS.map((w) => `<span>${w}</span>`).join("")}
          </div>
          ${rows}
        </article>
      `;
    })
    .join("");

  matrixEl.innerHTML = headHtml || `<div class="empty">No matching clusters. Try a different search.</div>`;

  matrixEl.querySelectorAll(".cluster-row").forEach((row) => {
    row.addEventListener("click", () => {
      const cluster = state.clusters.find((c) => c.id === row.dataset.clusterId);
      if (cluster) openClusterModal(cluster);
    });
  });
}

function openClusterModal(cluster) {
  state.activeClusterId = cluster.id;
  renderClusterModal(cluster);
  if (!modal.open) modal.showModal();
}

function renderClusterModal(cluster) {
  modalHead.textContent = cluster.headName;
  modalTitle.textContent = cluster.name;
  const nseCount = cluster.stocks.filter((stock) => stock.exchange === "NSE").length;
  const bseCount = cluster.stocks.length - nseCount;
  modalMeta.textContent = `${cluster.stocks.length} stocks | NSE ${nseCount} | BSE ${bseCount}`;

  const stocks = [...cluster.stocks].sort((a, b) => b.returns["1D"] - a.returns["1D"]);
  modalTableWrap.innerHTML = stocks
    .map((stock) => {
      const cells = WINDOWS.map(
        (w) => `<span class="cell ${colorClass(stock.returns[w])}">${percent(stock.returns[w])}</span>`,
      ).join("");

      return `
        <div class="stock-row">
          <div class="stock-name">${stock.name}<span class="stock-symbol">${stock.exchange}:${stock.symbol}</span></div>
          ${cells}
        </div>
      `;
    })
    .join("");
}

function closeClusterModal() {
  modal.close();
  state.activeClusterId = null;
}

function compareWindowToMomentumKey(window) {
  if (window === "5D") return "1W";
  return window;
}

function clusterStocksByExchange(cluster, exchange) {
  if (exchange === "all") return cluster.stocks;
  return cluster.stocks.filter((stock) => stock.exchange.toLowerCase() === exchange);
}

function selectCompareColor(clusterId) {
  if (compareState.colorByCluster.has(clusterId)) return compareState.colorByCluster.get(clusterId);
  const color = COMPARE_COLOR_PALETTE[compareState.colorByCluster.size % COMPARE_COLOR_PALETTE.length];
  compareState.colorByCluster.set(clusterId, color);
  return color;
}

function compareSeriesForCluster(clusterId, windowKey = compareState.window, exchangeKey = compareState.exchange) {
  const cluster = state.clusters.find((item) => item.id === clusterId);
  if (!cluster) return [];

  const config = COMPARE_WINDOWS[windowKey];
  const momentumKey = compareWindowToMomentumKey(windowKey);
  const filteredStocks = clusterStocksByExchange(cluster, exchangeKey);
  const sourceStocks = filteredStocks.length ? filteredStocks : cluster.stocks;

  const base = averageReturns(sourceStocks.map((stock) => stock.returns))[momentumKey];
  const seed = hashString(`${cluster.id}|${windowKey}|${exchangeKey}`);
  const seededRandom = mulberry32(seed || 1);

  const output = [];
  let cursor = 0;
  for (let i = 0; i < config.points; i += 1) {
    const seasonal = Math.sin((i / config.points) * Math.PI * 2) * 0.14;
    const drift = (base / config.points) * config.driftScale;
    const noise = (seededRandom() - 0.5) * config.noise;
    cursor = clamp(cursor + drift + noise + seasonal, -85, 85);
    output.push({ x: i, y: cursor });
  }

  return output;
}

function rebuildComparisonSeries() {
  compareState.seriesByCluster.clear();
  compareState.selectedClusterIds.forEach((clusterId) => {
    compareState.seriesByCluster.set(clusterId, compareSeriesForCluster(clusterId));
    selectCompareColor(clusterId);
  });
}

function addCompareCluster(clusterId) {
  if (compareState.selectedClusterIds.includes(clusterId)) return;
  if (compareState.selectedClusterIds.length >= MAX_COMPARE_SELECTION) return;

  compareState.selectedClusterIds.push(clusterId);
  selectCompareColor(clusterId);
  refreshComparisonSeries().catch((error) => {
    console.error("Unable to refresh comparison series after add", error);
    setRuntimeHealth("stale", "Comparison data delayed");
  });
}

function removeCompareCluster(clusterId) {
  compareState.selectedClusterIds = compareState.selectedClusterIds.filter((id) => id !== clusterId);
  compareState.seriesByCluster.delete(clusterId);
  refreshComparisonSeries().catch((error) => {
    console.error("Unable to refresh comparison series after remove", error);
    setRuntimeHealth("stale", "Comparison data delayed");
  });
}

function searchCompareClusters(query) {
  const text = query.trim().toLowerCase();
  if (!text) return [];

  return state.clusters
    .filter((cluster) => !compareState.selectedClusterIds.includes(cluster.id))
    .filter(
      (cluster) =>
        cluster.name.toLowerCase().includes(text) ||
        cluster.headName.toLowerCase().includes(text) ||
        cluster.id.toLowerCase().includes(text),
    )
    .slice(0, 9);
}

function renderCompareSearchResults() {
  const matches = searchCompareClusters(compareState.search);
  if (!matches.length) {
    compareSearchResults.innerHTML = "";
    return;
  }

  compareSearchResults.innerHTML = matches
    .map(
      (cluster) => `
      <button class="compare-search-item" data-compare-cluster-id="${cluster.id}">
        <strong>${cluster.name}</strong>
        <span>${cluster.headName} • ${cluster.stocks.length} stocks</span>
      </button>
    `,
    )
    .join("");

  compareSearchResults.querySelectorAll(".compare-search-item").forEach((item) => {
    item.addEventListener("click", () => {
      addCompareCluster(item.dataset.compareClusterId);
      compareState.search = "";
      compareClusterInput.value = "";
      compareSearchResults.innerHTML = "";
    });
  });
}

function renderCompareChips() {
  if (!compareState.selectedClusterIds.length) {
    compareChipRow.innerHTML = `<div class="scan-empty">No clusters selected. Search and add micro-clusters for comparison.</div>`;
    return;
  }

  compareChipRow.innerHTML = compareState.selectedClusterIds
    .map((clusterId) => {
      const cluster = state.clusters.find((item) => item.id === clusterId);
      if (!cluster) return "";
      const color = selectCompareColor(clusterId);
      return `
        <div class="compare-chip">
          <span class="chip-dot" style="background:${color}"></span>
          <span>${cluster.name}</span>
          <button class="chip-remove" data-remove-cluster-id="${cluster.id}" aria-label="Remove ${cluster.name}">×</button>
        </div>
      `;
    })
    .join("");

  compareChipRow.querySelectorAll("[data-remove-cluster-id]").forEach((button) => {
    button.addEventListener("click", () => {
      removeCompareCluster(button.dataset.removeClusterId);
    });
  });
}

function resizeCompareCanvas() {
  if (!compareCanvas) return;
  const ctx = compareCanvas.getContext("2d");
  const parentWidth = compareCanvas.parentElement.clientWidth;
  const cssWidth = Math.max(300, Math.floor(parentWidth - 2));
  const cssHeight = Math.max(260, Math.floor(cssWidth * 0.44));
  const dpr = window.devicePixelRatio || 1;

  compareCanvas.width = Math.floor(cssWidth * dpr);
  compareCanvas.height = Math.floor(cssHeight * dpr);
  compareCanvas.style.width = `${cssWidth}px`;
  compareCanvas.style.height = `${cssHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawCompareChart() {
  const ctx = compareCanvas.getContext("2d");
  const width = compareCanvas.clientWidth;
  const height = compareCanvas.clientHeight;
  const styles = getComputedStyle(document.body);
  const mutedColor = styles.getPropertyValue("--muted").trim() || "#9bb0c9";
  const lineColor = styles.getPropertyValue("--line").trim() || "#26364c";
  const textColor = styles.getPropertyValue("--text").trim() || "#e6eef8";

  ctx.clearRect(0, 0, width, height);

  const left = 52;
  const right = 18;
  const top = 20;
  const bottom = 30;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const selectedSeries = compareState.selectedClusterIds
    .map((clusterId) => ({ clusterId, points: compareState.seriesByCluster.get(clusterId) || [] }))
    .filter((item) => item.points.length);

  if (!selectedSeries.length) {
    ctx.fillStyle = mutedColor;
    ctx.font = "600 13px Satoshi, sans-serif";
    ctx.fillText("Select clusters to start comparison", left, top + 24);
    return;
  }

  const allValues = selectedSeries.flatMap((item) => item.points.map((point) => point.y));
  let yMin = Math.min(...allValues, 0);
  let yMax = Math.max(...allValues, 0);
  const span = Math.max(10, yMax - yMin);
  yMin -= span * 0.14;
  yMax += span * 0.14;

  const mapY = (value) => top + ((yMax - value) / (yMax - yMin)) * chartHeight;
  const pointsCount = selectedSeries[0].points.length;
  const mapX = (index) => left + (index / Math.max(pointsCount - 1, 1)) * chartWidth;

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const yValue = yMax - ((yMax - yMin) * i) / 4;
    const y = mapY(yValue);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + chartWidth, y);
    ctx.stroke();

    ctx.fillStyle = mutedColor;
    ctx.font = "600 10px Satoshi, sans-serif";
    ctx.fillText(percent(yValue), 6, y + 3);
  }

  const zeroY = mapY(0);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = lineColor;
  ctx.beginPath();
  ctx.moveTo(left, zeroY);
  ctx.lineTo(left + chartWidth, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  selectedSeries.forEach(({ clusterId, points }) => {
    const color = selectCompareColor(clusterId);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = mapX(index);
      const y = mapY(point.y);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const last = points[points.length - 1];
    const lastX = mapX(points.length - 1);
    const lastY = mapY(last.y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4.2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = textColor;
  ctx.font = "600 10px Satoshi, sans-serif";
  ctx.fillText("Start", left, height - 10);
  ctx.fillText("Mid", left + chartWidth / 2 - 9, height - 10);
  ctx.fillText("Live", left + chartWidth - 20, height - 10);
}

function renderMomentumScan() {
  if (!compareState.selectedClusterIds.length) {
    momentumScanList.innerHTML = `<div class="scan-empty">Relative strength list appears after selecting clusters.</div>`;
    scanMeta.textContent = "No active selection";
    return;
  }

  const rows = compareState.selectedClusterIds
    .map((clusterId) => {
      const cluster = state.clusters.find((item) => item.id === clusterId);
      const points = compareState.seriesByCluster.get(clusterId) || [];
      if (!cluster || points.length < 2) return null;

      const latest = points[points.length - 1].y;
      const previous = points[points.length - 2].y;
      const acceleration = latest - previous;
      const filteredStocks = clusterStocksByExchange(cluster, compareState.exchange);
      const sourceStocks = filteredStocks.length ? filteredStocks : cluster.stocks;
      const key = compareWindowToMomentumKey(compareState.window);
      const ranked = [...sourceStocks].sort((a, b) => b.returns[key] - a.returns[key]);
      const leader = ranked[0];
      const laggard = ranked[ranked.length - 1];

      return {
        clusterId,
        name: cluster.name,
        latest,
        acceleration,
        leader: leader ? `${leader.exchange}:${leader.symbol}` : "-",
        laggard: laggard ? `${laggard.exchange}:${laggard.symbol}` : "-",
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.latest - a.latest);

  scanMeta.textContent = `${rows.length}/${state.clusters.length} clusters • tick #${state.liveTick}`;

  momentumScanList.innerHTML = rows
    .map((row) => {
      const color = selectCompareColor(row.clusterId);
      const accel = `${row.acceleration >= 0 ? "+" : ""}${row.acceleration.toFixed(2)}%`;
      return `
      <div class="scan-item">
        <div class="scan-name">
          <span class="chip-dot" style="background:${color}"></span>
          <div>
            <div class="scan-label">${row.name}</div>
            <span class="scan-sub">Leader ${row.leader} • Laggard ${row.laggard}</span>
          </div>
        </div>
        <div class="scan-value ${row.latest >= 0 ? "pos" : "neg"}">
          ${percent(row.latest)}
          <span class="scan-sub">Δ ${accel}</span>
        </div>
      </div>
    `;
    })
    .join("");
}

function renderComparisonMeta() {
  const exchangeLabel = compareState.exchange === "all" ? "NSE + BSE" : compareState.exchange.toUpperCase();
  const clusterCount = compareState.selectedClusterIds.length;
  compareMeta.textContent = `${clusterCount}/${state.clusters.length} clusters • ${COMPARE_WINDOWS[compareState.window].label} • ${exchangeLabel}`;
}

function renderComparison() {
  renderCompareChips();
  renderComparisonMeta();
  drawCompareChart();
  renderMomentumScan();
}

function decisionClass(action) {
  const key = String(action || "hold").toLowerCase();
  return `decision-chip decision-${key}`;
}

function applyPortfolioButtonStates() {
  portfolioActionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.portfolioAction === portfolioState.filters.action);
  });
  portfolioExchangeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.portfolioExchange === portfolioState.filters.exchange);
  });
}

function portfolioRowPasses(row) {
  const actionFilter = portfolioState.filters.action;
  const exchangeFilter = portfolioState.filters.exchange;
  const confidenceMin = Number(portfolioState.filters.confidenceMin || 0);
  const search = String(portfolioState.filters.search || "").toLowerCase();

  if (actionFilter !== "all" && row.decision.action.toLowerCase() !== actionFilter) return false;
  if (exchangeFilter !== "all" && row.exchange.toLowerCase() !== exchangeFilter) return false;
  if ((row.decision.confidence || 0) < confidenceMin) return false;
  if (search && !`${row.symbol} ${row.exchange}`.toLowerCase().includes(search)) return false;
  return true;
}

function sortPortfolioRows(rows) {
  if (portfolioState.scanSort !== "action_then_confidence") return rows;
  return rows.sort((a, b) => {
    const actionRankA = PORTFOLIO_SCAN_ACTION_RANK[a.decision.action] ?? 99;
    const actionRankB = PORTFOLIO_SCAN_ACTION_RANK[b.decision.action] ?? 99;
    if (actionRankA !== actionRankB) return actionRankA - actionRankB;

    const confidenceA = Number(a.decision.confidence || 0);
    const confidenceB = Number(b.decision.confidence || 0);
    if (confidenceA !== confidenceB) return confidenceB - confidenceA;

    const scoreA = Math.abs(Number(a.decision.score || 0));
    const scoreB = Math.abs(Number(b.decision.score || 0));
    if (scoreA !== scoreB) return scoreB - scoreA;

    return `${a.exchange}:${a.symbol}`.localeCompare(`${b.exchange}:${b.symbol}`);
  });
}

function filteredPortfolioRows() {
  const rows = portfolioState.rows.filter((row) => portfolioRowPasses(row));
  return sortPortfolioRows(rows);
}

function renderPortfolioStatusChips() {
  if (!portfolioSourceChip || !portfolioConnectionChip) return;
  const providerLabel = portfolioState.provider || runtimeState.adapterMode || "synthetic";
  const modeLabel = portfolioState.providerMode || (portfolioState.connected ? "live" : "demo");
  portfolioSourceChip.textContent = `Source: ${providerLabel} (${modeLabel})`;
  portfolioSourceChip.classList.remove("status-pill-alert", "status-pill-warn", "status-pill-ok", "status-pill-muted");
  portfolioSourceChip.classList.add("status-pill-muted");

  if (portfolioState.connected) {
    portfolioConnectionChip.textContent = "Connected";
    portfolioConnectionChip.classList.remove("status-pill-alert", "status-pill-warn", "status-pill-muted");
    portfolioConnectionChip.classList.add("status-pill-ok");
  } else {
    portfolioConnectionChip.textContent = "Read-only / Demo";
    portfolioConnectionChip.classList.remove("status-pill-ok", "status-pill-warn", "status-pill-alert");
    portfolioConnectionChip.classList.add("status-pill-muted");
  }
}

function renderPortfolioSummary() {
  const summary = portfolioState.summary;
  if (!summary) {
    portfolioSummaryRow.innerHTML = `<article class="stat-card"><p>Portfolio</p><h3>Not connected</h3></article>`;
    return;
  }

  const cards = [
    { label: "Portfolio Value", value: money(summary.totalCurrent) },
    { label: "Invested", value: money(summary.totalInvested) },
    { label: "Unrealized P&L", value: `${money(summary.totalPnl)} (${percent(summary.totalPnlPct)})` },
    { label: "Cash Available", value: money(summary.cashAvailable) },
    { label: "Gainers / Losers", value: `${summary.gainers} / ${summary.losers}` },
    { label: "Symbols", value: `${summary.totalSymbols}` },
  ];

  portfolioSummaryRow.innerHTML = cards
    .map((card) => `<article class="stat-card"><p>${card.label}</p><h3>${card.value}</h3></article>`)
    .join("");
}

function renderPortfolioDecisionPanel() {
  const row =
    portfolioState.rows.find((item) => item.key === portfolioState.selectedKey) ||
    filteredPortfolioRows()[0] ||
    null;

  if (!row) {
    portfolioDecisionMeta.textContent = "No selection";
    portfolioDecisionPanel.innerHTML = `<div class="scan-empty">No portfolio rows match current filters.</div>`;
    return;
  }

  portfolioState.selectedKey = row.key;
  const decision = row.decision;
  portfolioDecisionMeta.textContent = `${row.exchange}:${row.symbol} • ${decision.action}`;
  portfolioDecisionPanel.innerHTML = `
    <article class="decision-card">
      <h4>${row.exchange}:${row.symbol}</h4>
      <p>Action: <strong>${decision.action}</strong> • Confidence ${decision.confidence.toFixed(1)}% • Score ${decision.score.toFixed(1)}</p>
      <ul class="decision-list">
        ${decision.reasons.map((reason) => `<li>${reason}</li>`).join("")}
      </ul>
    </article>
    <article class="decision-card">
      <h4>Risk Flags</h4>
      ${
        decision.riskFlags.length
          ? `<ul class="decision-list">${decision.riskFlags.map((flag) => `<li>${flag}</li>`).join("")}</ul>`
          : `<p>No active risk flags for this symbol.</p>`
      }
    </article>
  `;
}

async function handlePrepareOrder(rowKey) {
  const row = portfolioState.rows.find((item) => item.key === rowKey);
  if (!row) return;

  try {
    const preview = await runtimeState.adapter.previewOrder({
      symbol: row.symbol,
      exchange: row.exchange,
      side: row.decision.action === "SELL" || row.decision.action === "REDUCE" ? "SELL" : "BUY",
      quantity: Math.max(1, Math.round(row.quantity * 0.2)),
      price: row.lastPrice,
    });

    if (!preview.ok) {
      setRuntimeHealth("error", preview.error || "Order preview failed");
      return;
    }

    const proceed = window.confirm(
      `Order preview\\n${preview.exchange}:${preview.symbol} ${preview.side} x${preview.quantity}\\nNotional: ${money(preview.notionalValue)}\\nEstimated total: ${money(preview.estimatedTotal)}\\n\\nSubmit dry-run order?`,
    );

    if (!proceed) return;
    const submitted = await runtimeState.adapter.submitOrder({
      symbol: preview.symbol,
      exchange: preview.exchange,
      side: preview.side,
      quantity: preview.quantity,
      price: preview.price,
      confirmationText: "CONFIRM",
    });

    if (submitted?.order?.id) {
      setRuntimeHealth("ok", `Order ${submitted.order.id} prepared (${submitted.dryRun ? "dry-run" : "live"})`);
      renderDataStatus();
    }
  } catch (error) {
    console.error("Prepare order failed", error);
    setRuntimeHealth("error", "Order preview failed");
  }
}

function renderPortfolioRows() {
  const rows = filteredPortfolioRows();
  const asOfLabel = portfolioState.asOf ? new Date(portfolioState.asOf).toLocaleTimeString("en-IN") : "--";
  portfolioMeta.textContent = `${rows.length}/${portfolioState.rows.length} symbols • ${portfolioState.connected ? "Connected" : "Demo"} • as of ${asOfLabel}`;

  if (!rows.length) {
    portfolioRowsEl.innerHTML = `<div class="scan-empty">No holdings match the current filters.</div>`;
    return;
  }

  portfolioRowsEl.innerHTML = rows
    .map((row) => {
      const cells = WINDOWS.map((windowKey) => `<span class="cell ${colorClass(row.returns[windowKey])}">${percent(row.returns[windowKey])}</span>`).join("");
      const selectedClass = row.key === portfolioState.selectedKey ? " portfolio-row-selected" : "";

      return `
        <div class="portfolio-row${selectedClass}" data-portfolio-key="${row.key}">
          <div class="portfolio-symbol">${row.symbol}<span class="portfolio-exchange">${row.exchange}</span></div>
          <span class="portfolio-mini">${row.quantity}</span>
          <span class="portfolio-mini">${money(row.currentValue)}</span>
          ${cells}
          <span class="${decisionClass(row.decision.action)}">${row.decision.action}</span>
          <button class="portfolio-inline-btn" data-prepare-order="${row.key}">Prepare</button>
        </div>
      `;
    })
    .join("");

  portfolioRowsEl.querySelectorAll("[data-portfolio-key]").forEach((element) => {
    element.addEventListener("click", () => {
      portfolioState.selectedKey = element.dataset.portfolioKey;
      renderPortfolioDecisionPanel();
      renderPortfolioRows();
    });
  });

  portfolioRowsEl.querySelectorAll("[data-prepare-order]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handlePrepareOrder(button.dataset.prepareOrder);
    });
  });
}

function renderPortfolio() {
  applyPortfolioButtonStates();
  renderPortfolioStatusChips();
  renderPortfolioSummary();
  renderPortfolioRows();
  renderPortfolioDecisionPanel();
}

function freshnessLabel(nowMs) {
  if (!runtimeState.lastSuccessAtMs) return "No successful sync yet";
  const deltaSec = Math.max(0, Math.floor((nowMs - runtimeState.lastSuccessAtMs) / 1000));
  const asOfLabel = runtimeState.lastAsOfLabel ? ` • as of ${new Date(runtimeState.lastAsOfLabel).toLocaleTimeString("en-IN")}` : "";
  if (deltaSec < 2) return `Updated just now${asOfLabel}`;
  if (deltaSec < 60) return `Updated ${deltaSec}s ago${asOfLabel}`;
  const min = Math.floor(deltaSec / 60);
  return `Updated ${min}m ago${asOfLabel}`;
}

function renderDataStatus() {
  const sourceLabel = runtimeState.adapterMode === "backend" ? "LIVE DATA (BACKEND)" : "LIVE DATA (SYNTHETIC)";
  liveSourceText.textContent = sourceLabel;

  const nowMs = Date.now();
  freshnessStatus.textContent = freshnessLabel(nowMs);
  freshnessStatus.classList.toggle("status-pill-ok", runtimeState.health === "ok");
  freshnessStatus.classList.toggle("status-pill-muted", runtimeState.health !== "ok");

  if (!runtimeState.healthMessage) {
    healthStatus.classList.add("hidden");
    healthStatus.textContent = "";
    healthStatus.classList.remove("status-pill-alert", "status-pill-warn", "status-pill-ok", "status-pill-muted");
  } else {
    healthStatus.classList.remove("hidden");
    healthStatus.textContent = runtimeState.healthMessage;
    healthStatus.classList.remove("status-pill-alert", "status-pill-warn", "status-pill-ok", "status-pill-muted");
    if (runtimeState.health === "stale") {
      healthStatus.classList.add("status-pill-warn");
    } else if (runtimeState.health === "ok") {
      healthStatus.classList.add("status-pill-ok");
    } else {
      healthStatus.classList.add("status-pill-alert");
    }
  }
}

function setRuntimeHealth(health, message) {
  runtimeState.health = health;
  runtimeState.healthMessage = message || "";
  renderDataStatus();
}

async function refreshComparisonSeries() {
  const requestId = compareState.seriesRequestId + 1;
  compareState.seriesRequestId = requestId;

  if (!compareState.selectedClusterIds.length) {
    compareState.seriesByCluster.clear();
    renderComparison();
    return;
  }

  const adapterPayload = await runtimeState.adapter.fetchComparisonSeries({
    clusterIds: [...compareState.selectedClusterIds],
    window: compareState.window,
    exchange: compareState.exchange,
    points: COMPARE_WINDOWS[compareState.window].points,
  });

  if (requestId !== compareState.seriesRequestId) return;
  compareState.seriesByCluster = AdapterCore.mapComparisonSeries(adapterPayload);
  renderComparison();
}

async function refreshPortfolioBootstrap(options = {}) {
  if (!runtimeState.adapter?.fetchPortfolioBootstrap) return;
  const payload = await runtimeState.adapter.fetchPortfolioBootstrap({
    exchange: portfolioState.filters.exchange,
    refresh: Boolean(options.forceRefresh),
  });
  applyPortfolioBootstrap(payload);
  runtimeState.portfolioLastSuccessAtMs = Date.now();
  runtimeState.portfolioConsecutiveFailures = 0;
  runtimeState.portfolioBackoffFailures = 0;
  if (!portfolioState.selectedKey && payload.rows.length) {
    portfolioState.selectedKey = payload.rows[0].key;
  }
  renderPortfolio();
}

async function pollPortfolioAndApplyUpdates() {
  if (!runtimeState.adapter?.pollPortfolio || runtimeState.portfolioPollInFlight) return;
  runtimeState.portfolioPollInFlight = true;

  try {
    const payload = await runtimeState.adapter.pollPortfolio({
      cursor: portfolioState.cursor,
      exchange: portfolioState.filters.exchange,
    });
    const merged = AdapterCore.mergePortfolioState(currentPortfolioStateAsAdapterDTO(), payload);
    applyPortfolioBootstrap(AdapterCore.normalizePortfolioBootstrapPayload(merged));
    runtimeState.portfolioLastSuccessAtMs = Date.now();
    runtimeState.portfolioConsecutiveFailures = 0;
    runtimeState.portfolioBackoffFailures = 0;
    if (state.activeView === "portfolio") {
      renderPortfolio();
    }
  } catch (error) {
    runtimeState.portfolioConsecutiveFailures += 1;
    runtimeState.portfolioBackoffFailures += 1;
    if (
      AdapterCore.shouldMarkStale({
        consecutiveFailures: runtimeState.portfolioConsecutiveFailures,
        lastSuccessAtMs: runtimeState.portfolioLastSuccessAtMs,
        nowMs: Date.now(),
        marketHours: AdapterCore.isMarketHoursIst(new Date()),
      })
    ) {
      setRuntimeHealth("stale", "Portfolio data delayed • retrying");
    }
    console.error("Portfolio poll failed", error);
  } finally {
    runtimeState.portfolioPollInFlight = false;
  }
}

function applyCompareButtonStates() {
  compareWindowButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.compareWindow === compareState.window);
  });
  compareExchangeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.compareExchange === compareState.exchange);
  });
}

function setActiveView(target) {
  if (target === "portfolio" && !runtimeState.enablePortfolioView) {
    target = "themes";
  }
  state.activeView = target;
  themesViewEl.classList.toggle("active-view", target === "themes");
  comparisonViewEl.classList.toggle("active-view", target === "comparison");
  portfolioViewEl.classList.toggle("active-view", target === "portfolio");

  viewLinks.forEach((link) => {
    const active = link.dataset.appViewTarget === target;
    link.classList.toggle("active", active);
    link.classList.toggle("muted", !active);
  });

  if (target === "comparison") {
    if (modal.open) closeClusterModal();
    requestAnimationFrame(() => {
      resizeCompareCanvas();
      refreshComparisonSeries().catch((error) => {
        console.error("Failed to refresh comparison on view switch", error);
        renderComparison();
      });
    });
  } else if (target === "portfolio") {
    refreshPortfolioBootstrap({ forceRefresh: false }).catch((error) => {
      console.error("Failed to refresh portfolio on view switch", error);
      renderPortfolio();
    });
  }
}

async function initializeComparisonState() {
  const defaultSelection = [...state.clusters]
    .sort((a, b) => b.momentum["1M"] - a.momentum["1M"])
    .slice(0, 4)
    .map((cluster) => cluster.id);

  compareState.selectedClusterIds = defaultSelection;
  applyCompareButtonStates();
  resizeCompareCanvas();
  try {
    await refreshComparisonSeries();
  } catch (error) {
    console.error("Comparison series bootstrap failed", error);
    renderComparison();
  }
}

function attachHandlers() {
  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderMatrix();
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
      renderMatrix();
    });
  });

  liveToggle.addEventListener("click", () => {
    state.isLive = !state.isLive;
    liveToggle.textContent = state.isLive ? "Pause Live" : "Resume Live";
    if (state.isLive) {
      if (runtimeState.persistentWarning) {
        setRuntimeHealth("error", runtimeState.persistentWarning);
      } else if (runtimeState.health === "stale" || runtimeState.health === "error") {
        setRuntimeHealth(runtimeState.health, runtimeState.healthMessage);
      } else {
        setRuntimeHealth("ok", "");
      }
      scheduleNextPoll(0);
    } else {
      if (runtimeState.persistentWarning) {
        setRuntimeHealth("error", `${runtimeState.persistentWarning} • paused`);
      } else {
        setRuntimeHealth(runtimeState.health, "Live updates paused");
      }
      renderDataStatus();
    }
  });

  viewLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = link.dataset.appViewTarget;
      if (!target) return;
      setActiveView(target);
    });
  });

  compareClusterInput.addEventListener("input", (event) => {
    compareState.search = event.target.value;
    renderCompareSearchResults();
  });

  compareClusterInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = searchCompareClusters(compareState.search)[0];
    if (!first) return;
    addCompareCluster(first.id);
    compareState.search = "";
    compareClusterInput.value = "";
    compareSearchResults.innerHTML = "";
  });

  document.addEventListener("click", (event) => {
    if (!compareSearchResults.contains(event.target) && event.target !== compareClusterInput) {
      compareSearchResults.innerHTML = "";
    }
  });

  compareWindowButtons.forEach((button) => {
    button.addEventListener("click", () => {
      compareState.window = button.dataset.compareWindow;
      applyCompareButtonStates();
      refreshComparisonSeries().catch((error) => {
        console.error("Window switch series refresh failed", error);
        setRuntimeHealth("stale", "Comparison data delayed");
      });
    });
  });

  compareExchangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      compareState.exchange = button.dataset.compareExchange;
      applyCompareButtonStates();
      refreshComparisonSeries().catch((error) => {
        console.error("Exchange switch series refresh failed", error);
        setRuntimeHealth("stale", "Comparison data delayed");
      });
    });
  });

  portfolioSearchInput.addEventListener("input", (event) => {
    portfolioState.filters.search = event.target.value.trim();
    renderPortfolio();
  });

  portfolioConfidenceInput.addEventListener("input", (event) => {
    portfolioState.filters.confidenceMin = clamp(Number(event.target.value || 0), 0, 100);
    renderPortfolio();
  });

  portfolioActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      portfolioState.filters.action = button.dataset.portfolioAction;
      renderPortfolio();
    });
  });

  portfolioExchangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      portfolioState.filters.exchange = button.dataset.portfolioExchange;
      refreshPortfolioBootstrap({ forceRefresh: true }).catch((error) => {
        console.error("Portfolio exchange refresh failed", error);
        setRuntimeHealth("stale", "Portfolio data delayed");
      });
    });
  });

  closeModal.addEventListener("click", closeClusterModal);
  modal.addEventListener("click", (event) => {
    const rect = modal.getBoundingClientRect();
    const inDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!inDialog) closeClusterModal();
  });

  window.addEventListener("resize", () => {
    if (compareState.resizeRaf) cancelAnimationFrame(compareState.resizeRaf);
    compareState.resizeRaf = requestAnimationFrame(() => {
      resizeCompareCanvas();
      if (state.activeView === "comparison") drawCompareChart();
    });
  });
}

function applyNormalizedUniverse(payload, options = {}) {
  const universe = normalizeUniverseForState(payload);
  state.heads = universe.heads;
  state.clusters = universe.clusters;
  state.stocks = universe.stocks;
  state.cursor = payload.cursor || state.cursor;
  state.asOf = payload.asOf || state.asOf;

  if (!options.skipRecalc) {
    recalcAllMomentum(state.heads, state.clusters);
  }
}

function scheduleNextPoll(delayMs) {
  if (runtimeState.pollTimer) {
    clearTimeout(runtimeState.pollTimer);
  }
  runtimeState.pollTimer = window.setTimeout(pollAndApplyUpdates, Math.max(0, delayMs));
}

function baseIntervalMs() {
  if (runtimeState.adapterMode !== "backend") return 2100;
  return AdapterCore.getAdaptivePollIntervalMs({
    date: new Date(),
    hidden: document.hidden,
  });
}

function onPollSuccess(payload) {
  runtimeState.pollInFlight = false;
  runtimeState.consecutiveFailures = 0;
  runtimeState.backoffFailures = 0;
  runtimeState.lastSuccessAtMs = Date.now();
  runtimeState.lastAsOfLabel = payload.asOf;

  if (runtimeState.persistentWarning) {
    setRuntimeHealth("error", runtimeState.persistentWarning);
  } else {
    setRuntimeHealth("ok", "");
  }

  renderDataStatus();
  scheduleNextPoll(baseIntervalMs());
}

function onPollFailure(error) {
  runtimeState.pollInFlight = false;
  runtimeState.consecutiveFailures += 1;
  runtimeState.backoffFailures += 1;

  const marketHours = AdapterCore.isMarketHoursIst(new Date());
  const stale = AdapterCore.shouldMarkStale({
    consecutiveFailures: runtimeState.consecutiveFailures,
    lastSuccessAtMs: runtimeState.lastSuccessAtMs,
    nowMs: Date.now(),
    marketHours,
  });

  if (stale) {
    setRuntimeHealth("stale", "Data delayed • retrying");
  } else {
    setRuntimeHealth("error", "Temporary sync issue");
  }

  console.error("Live poll failed", error);
  scheduleNextPoll(
    runtimeState.adapterMode === "backend"
      ? AdapterCore.nextBackoffMs(runtimeState.backoffFailures)
      : Math.min(8000, 1500 + runtimeState.backoffFailures * 1200),
  );
}

async function pollAndApplyUpdates() {
  if (!runtimeState.adapter || runtimeState.pollInFlight) return;

  if (!state.isLive) {
    if (runtimeState.persistentWarning) {
      setRuntimeHealth("error", `${runtimeState.persistentWarning} • paused`);
    } else {
      setRuntimeHealth(runtimeState.health, "Live updates paused");
    }
    scheduleNextPoll(1000);
    return;
  }

  runtimeState.pollInFlight = true;

  try {
    const payload = await runtimeState.adapter.poll({
      cursor: state.cursor,
      exchange: "all",
    });

    const merged = AdapterCore.mergeMarketState(currentStateAsAdapterDTO(), payload);
    const hasBackendAggregates = payload.updates.clusters.length > 0 || payload.updates.heads.length > 0;
    applyNormalizedUniverse(merged, {
      skipRecalc: hasBackendAggregates,
    });
    state.liveTick += 1;

    if (state.activeView === "themes") {
      renderMatrix();
    }

    if (state.activeClusterId && modal.open) {
      const activeCluster = state.clusters.find((cluster) => cluster.id === state.activeClusterId);
      if (activeCluster) renderClusterModal(activeCluster);
    }

    if (compareState.selectedClusterIds.length) {
      refreshComparisonSeries().catch((error) => {
        console.error("Comparison refresh during poll failed", error);
      });
    }

    if (runtimeState.enablePortfolioView) {
      pollPortfolioAndApplyUpdates().catch((error) => {
        console.error("Portfolio refresh during poll failed", error);
      });
    }

    onPollSuccess(payload);
  } catch (error) {
    onPollFailure(error);
  }
}

async function init() {
  const resolved = resolveAdapter();
  applyUiVariantConfig(resolved.config || {});
  runtimeState.adapter = resolved.adapter;
  runtimeState.adapterMode = resolved.mode;
  runtimeState.persistentWarning = resolved.warning || "";
  runtimeState.enablePortfolioView = resolved.config?.enablePortfolioView !== false;

  if (!runtimeState.enablePortfolioView) {
    portfolioViewEl.classList.remove("active-view");
    portfolioViewEl.classList.add("hidden");
    const portfolioNav = viewLinks.find((link) => link.dataset.appViewTarget === "portfolio");
    if (portfolioNav) portfolioNav.classList.add("hidden");
  }

  if (resolved.warning) {
    setRuntimeHealth("error", resolved.warning);
  }

  const bootstrap = await runtimeState.adapter.bootstrap({
    exchange: "all",
    window: compareState.window,
  });

  applyNormalizedUniverse(bootstrap, {
    skipRecalc: runtimeState.adapterMode === "backend",
  });
  state.liveTick = 1;
  runtimeState.lastSuccessAtMs = Date.now();
  runtimeState.lastAsOfLabel = bootstrap.asOf;

  attachHandlers();
  renderMatrix();
  if (runtimeState.enablePortfolioView) {
    renderPortfolio();
  }
  await initializeComparisonState();
  setActiveView("themes");
  renderDataStatus();
  scheduleNextPoll(baseIntervalMs());
  window.setInterval(renderDataStatus, 1000);

  if (runtimeState.enablePortfolioView) {
    refreshPortfolioBootstrap({ forceRefresh: true }).catch((error) => {
      console.error("Portfolio bootstrap failed", error);
      if (runtimeState.adapterMode === "backend") {
        setRuntimeHealth("stale", "Portfolio data unavailable");
      }
    });
  }
}

init().catch((error) => {
  console.error("Application bootstrap failed", error);
  setRuntimeHealth("error", "Unable to initialize data adapter");
});
