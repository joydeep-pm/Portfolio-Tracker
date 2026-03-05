const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];
const TARGET_STOCKS = 2486;
const TARGET_CLUSTERS = 175;
const MAX_COMPARE_SELECTION = 8;
const PORTFOLIO_ACTIONS = ["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"];
const NETWORK_REFRESH_INTERVAL_MS = 30000;
const NETWORK_ENDPOINTS = [
  {
    id: "zerodha-session",
    label: "Zerodha Session Status",
    method: "GET",
    url: "/api/zerodha/session/status",
  },
  {
    id: "zerodha-auth",
    label: "Zerodha Auth URL",
    method: "GET",
    url: "/api/zerodha/auth/url",
  },
  {
    id: "angel-health",
    label: "Angel Health",
    method: "GET",
    url: "/api/angel/health",
  },
  {
    id: "angel-session",
    label: "Angel Session Status",
    method: "GET",
    url: "/api/angel/session/status",
  },
  {
    id: "market-bootstrap",
    label: "Themes Market Bootstrap",
    method: "GET",
    url: "/api/v1/market/bootstrap?exchange=all&debug=1",
  },
  {
    id: "portfolio-bootstrap",
    label: "Portfolio Bootstrap",
    method: "GET",
    url: "/api/v1/portfolio/bootstrap?exchange=all",
  },
  {
    id: "macro-context",
    label: "Macro Context Snapshot",
    method: "GET",
    url: "/api/v1/macro/context?exchange=all&limit=16&includeProcessed=1",
  },
];

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

// Keep this feed updated whenever new user-facing capabilities ship.
const WHATS_NEW_FEED = [
  {
    date: "2026-03-04",
    title: "Network Connectivity Dashboard",
    detail:
      "A dedicated Network tab now shows real-time provider sessions, active source routing per data flow, and endpoint-level API diagnostics with fallback signals.",
    targetView: "network",
  },
  {
    date: "2026-03-04",
    title: "Angel Token Seed For Themes Live Mode",
    detail:
      "Themes live mode now uses a pre-seeded Angel symbol-token map to avoid serverless `searchScrip` throttling and keep market payloads live-backed.",
    targetView: "themes",
  },
  {
    date: "2026-03-04",
    title: "Themes Switched To Angel Live Mode",
    detail:
      "Themes and Comparison endpoints now use Angel-backed live quotes and historical returns when an Angel session is connected, with automatic fallback only if live fetch fails.",
    targetView: "themes",
  },
  {
    date: "2026-03-04",
    title: "Angel Historical Returns Live Path",
    detail:
      "Portfolio period returns (`1W/1M/6M/YTD`) now use Angel candle history when an Angel session is active, reducing synthetic fallback usage for market context windows.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Angel Session Handshake Hardening",
    detail:
      "Warm-session reuse now re-issues Angel auth cookies, so the hybrid feed reliably shows Zerodha holdings with Angel market-data overlay across refreshes.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Zerodha + Angel Hybrid Feed",
    detail:
      "Portfolio ownership remains on Zerodha while market quote enrichment (LTP/close) can be overlaid from live Angel SmartAPI sessions.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Angel One Live Session Routes Added",
    detail:
      "Backend now supports Angel SmartAPI session lifecycle (`/api/angel/session`, `/api/angel/session/status`, `/api/angel/logout`) with server-side TOTP generation.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Per-Symbol Macro Context Fix",
    detail:
      "Macro context now keeps processed events in read flow, auto-harvests when context is empty in production, and derives theme hints per selected symbol to avoid identical outputs.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Macro Context Backend Reliability Fix",
    detail:
      "Macro & Regulatory Context now fails open with neutral output when storage is unavailable; production route was consolidated and redeployed to eliminate 500 errors.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Macro & Regulatory Context Tab",
    detail:
      "Signal Rationale now includes a dedicated macro/regulatory view powered by RBI/SEBI news ingestion with sentiment, catalyst, and impacted micro-cluster mapping.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Theme Grid Width Fix",
    detail: "Theme heatmap cards now use wider minimum widths so 6M/YTD columns stay fully visible; layout switches to two cards per row on laptop screens.",
    targetView: "themes",
  },
  {
    date: "2026-03-04",
    title: "Plan Traceability Matrix Added",
    detail: "What’s New now maps each referenced GitHub source to active modules, APIs, and UI surfaces in this project.",
    targetView: "whatsnew",
  },
  {
    date: "2026-03-04",
    title: "Dedicated What's New Page",
    detail: "Release updates now live on a separate top-nav page so roadmap changes are easier to scan.",
    targetView: "whatsnew",
  },
  {
    date: "2026-03-04",
    title: "Heatmap Columns Realigned",
    detail: "Theme cards now start from the same left anchor and metric chips align directly under 1D/1W/1M/6M/YTD headers.",
    targetView: "themes",
  },
  {
    date: "2026-03-04",
    title: "Production Readiness Complete",
    detail: "All release gates passed with production smoke checks and live validation.",
    targetView: "themes",
  },
  {
    date: "2026-03-04",
    title: "Live Portfolio Integration",
    detail: "Zerodha-backed portfolio signals and rationale workflows are active.",
    targetView: "portfolio",
  },
  {
    date: "2026-03-04",
    title: "Hotspot + Agent Engine",
    detail: "Hotspot ranking and multi-agent recommendations are available via APIs and UI flows.",
    targetView: "comparison",
  },
];

const PLAN_TRACE_ITEMS = [
  {
    wave: "Wave 3",
    source: "mohdasif2294/portfolio-copilot",
    integrated: "LangGraph-style orchestrator + portfolio workflow",
    modules: ["api/_lib/multiAgentEngine.js", "api/v1/agents/analyze"],
    uiSurface: "Portfolio Signals",
    targetView: "portfolio",
  },
  {
    wave: "Wave 3",
    source: "rooneyrulz/agentic-stock-research-system",
    integrated: "Market/news/recommendation consensus + weighted risk scoring",
    modules: ["api/_lib/newsRagStore.js", "api/_lib/multiAgentEngine.js"],
    uiSurface: "Portfolio Signals",
    targetView: "portfolio",
  },
  {
    wave: "Wave 3",
    source: "mayankthole/Dhan-MCP-Trades",
    integrated: "Natural language intent routing adapted to Zerodha MCP flows",
    modules: ["api/_lib/agentRouter.js", "api/v1/agents/intent"],
    uiSurface: "What's New + API Router",
    targetView: "whatsnew",
  },
  {
    wave: "Wave 2",
    source: "pkjmesra/PKScreener",
    integrated: "Technical scan adapter for breakout/consolidation/momentum flags",
    modules: ["api/_lib/pkscreenerAdapter.js", "api/v1/hotspots/snapshot"],
    uiSurface: "Comparison",
    targetView: "comparison",
  },
  {
    wave: "Wave 1",
    source: "debpal/BharatFinTrack",
    integrated: "NSE thematic/index categorization and holdings-to-theme mapping",
    modules: ["scripts/ingest-bharatfintrack.js", "api/_lib/thematicMapping.js"],
    uiSurface: "Portfolio Signals",
    targetView: "portfolio",
  },
  {
    wave: "Wave 4",
    source: "sandeepkumar0801/Ai-portfolio-analyzer-and-trading",
    integrated: "Streamlit dashboard baseline with portfolio/hotspot/recommendation panels",
    modules: ["streamlit_app.py", "scripts/run-streamlit-dashboard.sh"],
    uiSurface: "Streamlit Dashboard",
    targetView: "whatsnew",
  },
  {
    wave: "Wave 1",
    source: "sd416/zerodha-portfolio",
    integrated: "Headless CLI snapshot and cron-safe EOD runner",
    modules: ["scripts/portfolio-snapshot.js", "scripts/run-eod-snapshot.js"],
    uiSurface: "CLI + Artifacts",
    targetView: "whatsnew",
  },
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
  seriesRequestId: 0,
  markerRequestId: 0,
  markerByCluster: new Map(),
  markerSymbolByCluster: new Map(),
  peerAnchor: null,
  peerPayload: null,
  peerRequestId: 0,
  peerSeriesBySymbol: new Map(),
  peerSearch: "",
  backtestLoading: false,
  backtestResult: null,
  backtestError: "",
  backtestClusterId: "",
};

let compareChartState = {
  chart: null,
  seriesByCluster: new Map(),
  markerHashByCluster: new Map(),
  markerPrimitiveByCluster: new Map(),
  resizeObserver: null,
};

let peerChartState = {
  chart: null,
  seriesBySymbol: new Map(),
  resizeObserver: null,
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
  marketDataProvider: "",
  angelOverlayActive: false,
  user: { userId: null, userName: null },
  selectedKey: "",
  rationaleTab: "decision",
  macroContextByKey: new Map(),
  macroContextRequestId: 0,
  filters: {
    action: "all",
    exchange: "all",
    confidenceMin: 0,
    search: "",
  },
  scanSort: "action_then_confidence",
  allocationLoading: false,
  allocationResult: null,
  allocationError: "",
  allocationTickers: [],
  copilotByKey: new Map(),
  copilotLoading: false,
};

let commandPaletteState = {
  isOpen: false,
  loading: false,
};

let networkState = {
  requestId: 0,
  loading: false,
  lastCheckedAt: "",
  summary: {
    overallStatus: "unknown",
    upCount: 0,
    degradedCount: 0,
    downCount: 0,
    endpointCount: 0,
    avgLatencyMs: 0,
  },
  providers: [],
  flows: [],
  endpoints: [],
  refreshTimer: null,
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
const whatsNewViewEl = document.getElementById("whatsNewView");
const comparisonViewEl = document.getElementById("comparisonView");
const portfolioViewEl = document.getElementById("portfolioView");
const networkViewEl = document.getElementById("networkView");
const viewLinks = [...document.querySelectorAll("[data-app-view-target]")];
const whatsNewLogEl = document.getElementById("whatsNewLog");
const planTraceGridEl = document.getElementById("planTraceGrid");

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
const compareChart = document.getElementById("compareChart");
const compareLegend = document.getElementById("compareLegend");
const momentumScanList = document.getElementById("momentumScanList");
const runBacktestBtn = document.getElementById("runBacktestBtn");
const backtestSummaryBox = document.getElementById("backtestSummaryBox");
const peerStockInput = document.getElementById("peerStockInput");
const peerSearchResults = document.getElementById("peerSearchResults");
const peerMeta = document.getElementById("peerMeta");
const peerList = document.getElementById("peerList");
const peerChart = document.getElementById("peerChart");
const compareWindowButtons = [...document.querySelectorAll("[data-compare-window]")];
const compareExchangeButtons = [...document.querySelectorAll("[data-compare-exchange]")];

const portfolioSummaryRow = document.getElementById("portfolioSummaryRow");
const portfolioRowsEl = document.getElementById("portfolioRows");
const portfolioMeta = document.getElementById("portfolioMeta");
const portfolioDecisionMeta = document.getElementById("portfolioDecisionMeta");
const portfolioDecisionPanel = document.getElementById("portfolioDecisionPanel");
const portfolioMacroPanel = document.getElementById("portfolioMacroPanel");
const portfolioRationaleTabs = [...document.querySelectorAll("[data-rationale-tab]")];
const portfolioSourceChip = document.getElementById("portfolioSourceChip");
const portfolioConnectionChip = document.getElementById("portfolioConnectionChip");
const portfolioSearchInput = document.getElementById("portfolioSearchInput");
const portfolioConfidenceInput = document.getElementById("portfolioConfidenceInput");
const calculateSizingBtn = document.getElementById("calculateSizingBtn");
const allocationSummaryCard = document.getElementById("allocationSummaryCard");
const allocationMeta = document.getElementById("allocationMeta");
const allocationTableWrap = document.getElementById("allocationTableWrap");
const portfolioActionButtons = [...document.querySelectorAll("[data-portfolio-action]")];
const portfolioExchangeButtons = [...document.querySelectorAll("[data-portfolio-exchange]")];
const copilotChatMeta = document.getElementById("copilotChatMeta");
const copilotChatLog = document.getElementById("copilotChatLog");
const copilotChatInput = document.getElementById("copilotChatInput");
const copilotChatSend = document.getElementById("copilotChatSend");
const networkRefreshBtn = document.getElementById("networkRefreshBtn");
const networkLastChecked = document.getElementById("networkLastChecked");
const networkSummaryRow = document.getElementById("networkSummaryRow");
const networkProvidersMeta = document.getElementById("networkProvidersMeta");
const networkProviderCards = document.getElementById("networkProviderCards");
const networkFlowsMeta = document.getElementById("networkFlowsMeta");
const networkFlowCards = document.getElementById("networkFlowCards");
const networkEndpointsMeta = document.getElementById("networkEndpointsMeta");
const networkEndpointsTable = document.getElementById("networkEndpointsTable");

const modal = document.getElementById("clusterModal");
const modalHead = document.getElementById("modalHead");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalTableWrap = document.getElementById("modalTableWrap");
const closeModal = document.getElementById("closeModal");
const liveSourceText = document.getElementById("liveSourceText");
const freshnessStatus = document.getElementById("freshnessStatus");
const healthStatus = document.getElementById("healthStatus");
const commandPaletteOverlay = document.getElementById("commandPaletteOverlay");
const commandInput = document.getElementById("commandInput");
const commandResults = document.getElementById("commandResults");

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return "{}";
  }
}

function selectedPortfolioRow() {
  return (
    portfolioState.rows.find((item) => item.key === portfolioState.selectedKey) ||
    filteredPortfolioRows()[0] ||
    null
  );
}

function getCopilotMessages(rowKey) {
  if (!rowKey) return [];
  return portfolioState.copilotByKey.get(rowKey) || [];
}

function setCopilotMessages(rowKey, messages) {
  if (!rowKey) return;
  portfolioState.copilotByKey.set(rowKey, messages);
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

function toQuantTicker(symbol, exchange) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const normalizedExchange = String(exchange || "NSE").trim().toUpperCase();
  if (!normalizedSymbol) return "";
  if (normalizedExchange === "BSE") return `${normalizedSymbol}.BO`;
  return `${normalizedSymbol}.NS`;
}

function toDisplayPercent(value, options = {}) {
  const digits = Number.isFinite(options.digits) ? options.digits : 2;
  const asPercent = Boolean(options.asPercent);
  const numeric = Number(value || 0);
  const normalized = asPercent ? numeric : Math.abs(numeric) <= 1.5 ? numeric * 100 : numeric;
  const prefix = normalized > 0 ? "+" : "";
  return `${prefix}${normalized.toFixed(digits)}%`;
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
    marketDataProvider: "synthetic",
    angelOverlayActive: false,
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
    marketDataProvider: portfolioState.marketDataProvider || portfolioState.provider || "synthetic",
    angelOverlayActive: Boolean(portfolioState.angelOverlayActive),
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
  portfolioState.marketDataProvider = payload.marketDataProvider || payload.provider;
  portfolioState.angelOverlayActive = Boolean(payload.angelOverlayActive);
  portfolioState.user = payload.user || { userId: null, userName: null };

  const validKeys = new Set(portfolioState.rows.map((row) => row.key));
  [...portfolioState.macroContextByKey.keys()].forEach((key) => {
    if (!validKeys.has(key)) {
      portfolioState.macroContextByKey.delete(key);
    }
  });
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

  function syntheticMarkerStyle(action) {
    const key = String(action || "").toUpperCase();
    if (key === "BUY") return { position: "belowBar", shape: "arrowUp", color: "#1aa56f" };
    if (key === "ACCUMULATE") return { position: "belowBar", shape: "circle", color: "#2da8a6" };
    if (key === "REDUCE") return { position: "aboveBar", shape: "circle", color: "#d9a14a" };
    if (key === "SELL") return { position: "aboveBar", shape: "arrowDown", color: "#cb4b63" };
    return null;
  }

  function syntheticPeerSeriesFromBase(base, stock, cluster, windowKey) {
    const momentumKey = compareWindowToMomentumKey(windowKey);
    const clusterMomentum = Number(cluster?.momentum?.[momentumKey] || 0);
    const stockMomentum = Number(stock?.returns?.[momentumKey] || 0);
    const relativeBias = stockMomentum - clusterMomentum;
    const seeded = mulberry32(hashString(`${stock.symbol}|${windowKey}|${cluster.id}`) || 1);
    const phase = ((hashString(`${cluster.id}|${stock.symbol}`) % 628) / 100) * Math.PI;
    return base.map((point, index) => {
      const wave = Math.sin((index / Math.max(base.length - 1, 1)) * Math.PI * 2 + phase) * 0.35;
      const noise = (seeded() - 0.5) * 0.3;
      return {
        ts: point.ts,
        value: Number.parseFloat(clamp(point.value + relativeBias * 0.8 + wave + noise, -95, 95).toFixed(4)),
      };
    });
  }

  function syntheticPriceForTicker(ticker) {
    const symbol = String(ticker || "").toUpperCase().replace(/\.NS$|\.BO$/g, "");
    const fromPortfolio = portfolioState.rows.find((row) => row.symbol === symbol)?.lastPrice;
    if (Number.isFinite(fromPortfolio) && fromPortfolio > 0) return Number(fromPortfolio);
    const seeded = mulberry32(hashString(symbol) || 1);
    return Number.parseFloat((80 + seeded() * 1320).toFixed(2));
  }

  function syntheticBacktestCurve(initialCapital, steps = 260) {
    const seeded = mulberry32(hashString(`synthetic-backtest-${Date.now()}`) || 1);
    const points = [];
    let cursor = Number(initialCapital || 100000);
    for (let i = 0; i < steps; i += 1) {
      const drift = 0.0009;
      const shock = (seeded() - 0.5) * 0.03;
      cursor = Math.max(cursor * (1 + drift + shock), initialCapital * 0.4);
      points.push({
        timestamp: new Date(Date.now() - (steps - i) * 24 * 60 * 60 * 1000).toISOString(),
        value: Number.parseFloat(cursor.toFixed(2)),
      });
    }
    const step = Math.max(1, Math.ceil(points.length / 300));
    return points.filter((_, index) => index % step === 0 || index === points.length - 1);
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
    async fetchChartNormalizedReturns(params) {
      const payload = await this.fetchComparisonSeries(params);
      return AdapterCore.normalizeChartReturnsPayload({
        ...payload,
        source: "synthetic",
      });
    },
    async fetchDecisionMarkers(params) {
      const clusterId = String(params?.clusterId || "");
      const windowKey = String(params?.window || compareState.window || "1M");
      const cluster = state.clusters.find((item) => item.id === clusterId);
      const pointsForCluster = compareSeriesForCluster(
        clusterId,
        windowKey,
        String(params?.exchange || compareState.exchange || "all"),
      )
        .slice(-(Number(params?.points || COMPARE_WINDOWS[windowKey]?.points || 40)))
        .map((point, index, all) => ({
          ts: new Date(Date.now() - (all.length - index) * 60000).toISOString(),
          value: point.y,
        }));

      const actionKey = (() => {
        const symbol = String(params?.symbol || "").toUpperCase();
        const exchange = String(params?.symbolExchange || "NSE").toUpperCase();
        const row = portfolioState.rows.find((item) => item.symbol === symbol && item.exchange === exchange);
        return row?.decision?.action || "HOLD";
      })();
      const style = syntheticMarkerStyle(actionKey);
      const latestTime = toChartTime(pointsForCluster[pointsForCluster.length - 1]?.ts);
      const markers = style && Number.isFinite(latestTime)
        ? [
            {
              time: latestTime,
              action: actionKey,
              confidence: 67.5,
              text: `${actionKey} 67.5%`,
              color: style.color,
              shape: style.shape,
              position: style.position,
              source: "latest-decision",
            },
          ]
        : [];

      return AdapterCore.normalizeDecisionMarkersPayload({
        asOf: new Date().toISOString(),
        symbol: String(params?.symbol || "").toUpperCase() || null,
        exchange: String(params?.symbolExchange || "NSE").toUpperCase(),
        clusterId,
        window: windowKey,
        source: "synthetic",
        fallbackUsed: true,
        markers,
      });
    },
    async fetchPeerRelativeStrength(params) {
      const symbol = String(params?.symbol || "").toUpperCase();
      const exchange = String(params?.exchange || "all").toLowerCase();
      const windowKey = String(params?.window || compareState.window || "1M");
      const points = Number(params?.points || COMPARE_WINDOWS[windowKey]?.points || 40);
      const anchor = state.stocks.find((item) => {
        if (item.symbol !== symbol) return false;
        if (exchange === "all") return true;
        return item.exchange.toLowerCase() === exchange;
      });
      if (!anchor) {
        throw new Error("anchor-not-found");
      }
      const cluster = state.clusters.find((item) => item.id === anchor.clusterId);
      if (!cluster) {
        throw new Error("cluster-not-found");
      }
      const candidates = clusterStocksByExchange(cluster, exchange);
      const sourceStocks = candidates.length ? candidates : cluster.stocks;
      const momentumKey = compareWindowToMomentumKey(windowKey);
      const peers = sourceStocks
        .filter((item) => item.symbol !== symbol)
        .map((item) => ({
          stock: item,
          score:
            Math.abs(Number(item?.returns?.["1M"] || 0) - Number(anchor?.returns?.["1M"] || 0)) +
            0.6 * Math.abs(Number(item?.returns?.YTD || 0) - Number(anchor?.returns?.YTD || 0)),
        }))
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score;
          return Number(right.stock?.returns?.[momentumKey] || 0) - Number(left.stock?.returns?.[momentumKey] || 0);
        })
        .slice(0, 3);

      const base = compareSeriesForCluster(cluster.id, windowKey, exchange)
        .slice(-points)
        .map((point, index, all) => ({
          ts: new Date(Date.now() - (all.length - index) * 60000).toISOString(),
          value: Number(point.y || 0),
        }));
      const seriesBySymbol = {};
      seriesBySymbol[symbol] = syntheticPeerSeriesFromBase(base, anchor, cluster, windowKey);
      peers.forEach((entry) => {
        seriesBySymbol[entry.stock.symbol] = syntheticPeerSeriesFromBase(base, entry.stock, cluster, windowKey);
      });

      return AdapterCore.normalizePeerRelativeStrengthPayload({
        asOf: new Date().toISOString(),
        exchange,
        window: windowKey,
        source: "synthetic",
        cluster: {
          id: cluster.id,
          name: cluster.name,
          headId: cluster.headId,
          headName: cluster.headName,
        },
        anchor: {
          symbol: anchor.symbol,
          exchange: anchor.exchange,
          name: anchor.name,
          returns: cloneReturns(anchor.returns),
        },
        peers: peers.map((entry) => ({
          symbol: entry.stock.symbol,
          exchange: entry.stock.exchange,
          name: entry.stock.name,
          competitorScore: Number.parseFloat(entry.score.toFixed(2)),
          returns: cloneReturns(entry.stock.returns),
        })),
        seriesBySymbol,
      });
    },
    async fetchOptimalAllocation(tickersOrParams, capitalArg) {
      const params =
        tickersOrParams && typeof tickersOrParams === "object" && !Array.isArray(tickersOrParams)
          ? tickersOrParams
          : { tickers: tickersOrParams, capital: capitalArg };
      const tickers = (params?.tickers || []).map((ticker) => String(ticker || "").toUpperCase()).filter(Boolean);
      const capital = Number(params?.capital || 100000);
      if (!tickers.length) throw new Error("no-tickers");
      const seeded = mulberry32(hashString(`alloc-${tickers.join("|")}`) || 1);
      const rawScores = tickers.map((ticker) => ({ ticker, score: 0.4 + seeded() }));
      const totalScore = rawScores.reduce((sum, item) => sum + item.score, 0);
      const weights = {};
      rawScores.forEach((item) => {
        weights[item.ticker] = Number.parseFloat((item.score / totalScore).toFixed(6));
      });

      const discrete_shares = {};
      let used = 0;
      rawScores.forEach((item) => {
        const px = syntheticPriceForTicker(item.ticker);
        const allocation = weights[item.ticker] * capital;
        const qty = Math.max(0, Math.floor(allocation / Math.max(px, 1)));
        discrete_shares[item.ticker] = qty;
        used += qty * px;
      });

      return AdapterCore.normalizeOptimalAllocationPayload({
        weights,
        discrete_shares,
        remaining_cash: Number.parseFloat(Math.max(capital - used, 0).toFixed(2)),
        portfolio_performance: {
          expected_annual_return: 0.168,
          annual_volatility: 0.224,
          sharpe_ratio: 0.75,
        },
      });
    },
    async fetchStrategyBacktest(tickersOrParams, optionsArg) {
      const params =
        tickersOrParams && typeof tickersOrParams === "object" && !Array.isArray(tickersOrParams)
          ? tickersOrParams
          : { tickers: tickersOrParams, ...(optionsArg && typeof optionsArg === "object" ? optionsArg : {}) };
      const tickers = (params?.tickers || []).map((ticker) => String(ticker || "").toUpperCase()).filter(Boolean);
      const lookbackYears = Number(params?.lookbackYears || 5);
      const initialCapital = Number(params?.initialCapital || 100000);
      if (!tickers.length) throw new Error("no-tickers");
      const curve = syntheticBacktestCurve(initialCapital);
      return AdapterCore.normalizeStrategyBacktestPayload({
        tickers,
        lookback_years: Math.max(1, Math.floor(lookbackYears)),
        initial_capital: initialCapital,
        metrics: {
          win_rate: 0.57,
          max_drawdown: -0.192,
          cagr: 0.134,
          sharpe_ratio: 1.02,
        },
        equity_curve: curve,
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
    async fetchMacroContext(params) {
      const symbol = String(params?.symbol || "").toUpperCase();
      const exchange = String(params?.exchange || "all").toUpperCase();
      const row = portfolioState.rows.find(
        (item) => item.symbol === symbol && (exchange === "ALL" || item.exchange === exchange),
      );
      return syntheticMacroContextForRow(
        row || {
          symbol,
          exchange,
          returns: { "1D": 0, "1W": 0, "1M": 0, "6M": 0, YTD: 0 },
        },
      );
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

function displayClusterLabel(cluster) {
  const full = String(cluster?.name || "").trim();
  const head = String(cluster?.headName || "").trim();
  if (!full || !head) return full;
  const fullLower = full.toLowerCase();
  const headLower = head.toLowerCase();
  if (!fullLower.startsWith(headLower)) return full;
  const trimmed = full.slice(head.length).replace(/^[\s\-:&|]+/, "").trim();
  return trimmed || full;
}

function clusterRowHtml(cluster) {
  const cells = WINDOWS.map((w) => `<span class="cell ${colorClass(cluster.momentum[w])}">${percent(cluster.momentum[w])}</span>`).join("");
  const displayName = displayClusterLabel(cluster);
  return `
    <button class="cluster-row" data-cluster-id="${cluster.id}" aria-label="Open ${cluster.name}">
      <span class="cluster-name" title="${cluster.name}">${displayName}</span>
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
            <span>Cluster</span><span>#</span>${WINDOWS.map((w) => `<span>${w}</span>`).join("")}
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
  compareState.markerByCluster.delete(clusterId);
  compareState.markerSymbolByCluster.delete(clusterId);

  if (compareState.peerPayload?.cluster?.id === clusterId) {
    compareState.peerAnchor = null;
    compareState.peerPayload = null;
  }
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

function getLightweightChartsApi() {
  const api = window.LightweightCharts || null;
  if (!api || typeof api.createChart !== "function") return null;
  return api;
}

function addLineSeriesCompat(chart, options = {}) {
  const LightweightCharts = getLightweightChartsApi();
  if (!chart) {
    throw new Error("chart-instance-unavailable");
  }

  if (typeof chart.addLineSeries === "function") {
    return chart.addLineSeries(options);
  }

  if (typeof chart.addSeries === "function") {
    const lineType = LightweightCharts?.LineSeries || LightweightCharts?.LineSeriesType || "Line";
    try {
      return chart.addSeries(lineType, options);
    } catch (_error) {
      return chart.addSeries("Line", options);
    }
  }

  throw new Error("lightweight-line-series-api-unavailable");
}

function clearMarkerPrimitive(clusterId) {
  const primitive = compareChartState.markerPrimitiveByCluster.get(clusterId);
  if (primitive && typeof primitive.detach === "function") primitive.detach();
  if (primitive && typeof primitive.remove === "function") primitive.remove();
  compareChartState.markerPrimitiveByCluster.delete(clusterId);
}

function setSeriesMarkersCompat(clusterId, series, markers = []) {
  if (!series) return;
  const mappedMarkers = (Array.isArray(markers) ? markers : []).map((item) => ({
    time: item.time,
    position: item.position,
    color: item.color,
    shape: item.shape,
    text: item.text,
  }));

  if (typeof series.setMarkers === "function") {
    series.setMarkers(mappedMarkers);
    return;
  }

  const LightweightCharts = getLightweightChartsApi();
  if (!LightweightCharts || typeof LightweightCharts.createSeriesMarkers !== "function") {
    return;
  }

  const existing = compareChartState.markerPrimitiveByCluster.get(clusterId);
  if (existing && typeof existing.setMarkers === "function") {
    existing.setMarkers(mappedMarkers);
    return;
  }

  clearMarkerPrimitive(clusterId);
  const primitive = LightweightCharts.createSeriesMarkers(series, mappedMarkers);
  if (primitive) {
    compareChartState.markerPrimitiveByCluster.set(clusterId, primitive);
  }
}

function toChartTime(ts) {
  const ms = new Date(String(ts || "")).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function windowLabelToMarkerWindow() {
  return compareState.window;
}

function markerHash(markers = []) {
  return markers
    .map((item) => `${item.time}:${item.action}:${item.confidence}:${item.text}`)
    .join("|");
}

function markerClassForAction(action) {
  const key = String(action || "").toLowerCase();
  if (key === "buy") return "marker-pill-buy";
  if (key === "sell") return "marker-pill-sell";
  if (key === "accumulate") return "marker-pill-accumulate";
  if (key === "reduce") return "marker-pill-reduce";
  return "";
}

function disposeCompareChart() {
  if (compareChartState.resizeObserver) {
    compareChartState.resizeObserver.disconnect();
    compareChartState.resizeObserver = null;
  }
  if (compareChartState.chart) {
    compareChartState.chart.remove();
    compareChartState.chart = null;
  }
  compareChartState.seriesByCluster.clear();
  compareChartState.markerHashByCluster.clear();
  compareChartState.markerPrimitiveByCluster.forEach((_value, clusterId) => {
    clearMarkerPrimitive(clusterId);
  });
  compareChartState.markerPrimitiveByCluster.clear();
}

function initCompareChart() {
  const LightweightCharts = getLightweightChartsApi();
  if (!compareChart || !LightweightCharts) return;
  if (compareChartState.chart) return;

  const styles = getComputedStyle(document.body);
  compareChartState.chart = LightweightCharts.createChart(compareChart, {
    width: Math.max(280, compareChart.clientWidth || compareChart.parentElement?.clientWidth || 560),
    height: Math.max(260, compareChart.clientHeight || 360),
    layout: {
      background: { color: "transparent" },
      textColor: styles.getPropertyValue("--muted").trim() || "#9bb0c9",
      fontFamily: "Satoshi, sans-serif",
    },
    grid: {
      vertLines: { color: "rgba(90, 115, 145, 0.2)" },
      horzLines: { color: "rgba(90, 115, 145, 0.2)" },
    },
    rightPriceScale: {
      borderColor: "rgba(90, 115, 145, 0.35)",
    },
    timeScale: {
      borderColor: "rgba(90, 115, 145, 0.35)",
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode?.Normal || 0,
    },
    localization: {
      priceFormatter: (price) => `${price >= 0 ? "+" : ""}${Number(price).toFixed(2)}%`,
    },
  });

  compareChartState.resizeObserver = new ResizeObserver(() => {
    if (!compareChartState.chart) return;
    compareChartState.chart.applyOptions({
      width: Math.max(280, compareChart.clientWidth || 560),
      height: Math.max(260, compareChart.clientHeight || 360),
    });
  });
  compareChartState.resizeObserver.observe(compareChart);
}

function applyMarkersToClusterSeries(clusterId, markers) {
  const series = compareChartState.seriesByCluster.get(clusterId);
  if (!series) return;
  const hash = markerHash(markers);
  if (compareChartState.markerHashByCluster.get(clusterId) === hash) return;
  setSeriesMarkersCompat(clusterId, series, markers);
  compareChartState.markerHashByCluster.set(clusterId, hash);
}

function renderCompareLegend() {
  if (!compareLegend) return;
  if (!compareState.selectedClusterIds.length) {
    compareLegend.innerHTML = `<div class="scan-empty">Marker overlay appears after selecting clusters.</div>`;
    return;
  }

  compareLegend.innerHTML = compareState.selectedClusterIds
    .map((clusterId) => {
      const cluster = state.clusters.find((item) => item.id === clusterId);
      if (!cluster) return "";
      const color = selectCompareColor(clusterId);
      const markerSummary = (compareState.markerByCluster.get(clusterId) || [])
        .map((item) => `<span class="marker-pill ${markerClassForAction(item.action)}">${item.action}</span>`)
        .slice(-4)
        .join("");
      return `
        <div class="compare-legend-item">
          <span class="chip-dot" style="background:${color}"></span>
          <span>${cluster.name}</span>
          ${markerSummary ? `<span class="marker-pills">${markerSummary}</span>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderCompareSeriesToChart() {
  initCompareChart();
  if (!compareChartState.chart) return;

  const LightweightCharts = getLightweightChartsApi();
  const activeIds = new Set(compareState.selectedClusterIds);
  [...compareChartState.seriesByCluster.keys()].forEach((clusterId) => {
    if (activeIds.has(clusterId)) return;
    const series = compareChartState.seriesByCluster.get(clusterId);
    if (series) compareChartState.chart.removeSeries(series);
    compareChartState.seriesByCluster.delete(clusterId);
    compareChartState.markerHashByCluster.delete(clusterId);
    clearMarkerPrimitive(clusterId);
  });

  compareState.selectedClusterIds.forEach((clusterId) => {
    const points = compareState.seriesByCluster.get(clusterId) || [];
    let line = compareChartState.seriesByCluster.get(clusterId);
    if (!line) {
      line = addLineSeriesCompat(compareChartState.chart, {
        color: selectCompareColor(clusterId),
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      compareChartState.seriesByCluster.set(clusterId, line);
    } else {
      line.applyOptions({ color: selectCompareColor(clusterId) });
    }
    const data = points
      .map((point) => {
        const seconds = Number.isFinite(point.time) ? point.time : toChartTime(point.ts || point.time);
        if (!Number.isFinite(seconds)) return null;
        return {
          time: seconds,
          value: Number(point.y ?? point.value ?? 0),
        };
      })
      .filter(Boolean);
    line.setData(data);

    const markers = compareState.markerByCluster.get(clusterId) || [];
    applyMarkersToClusterSeries(clusterId, markers);
  });

  const hasSeries = compareState.selectedClusterIds.some((clusterId) => {
    const points = compareState.seriesByCluster.get(clusterId) || [];
    return points.length > 0;
  });
  if (hasSeries) {
    compareChartState.chart.timeScale().fitContent();
  } else if (LightweightCharts) {
    compareLegend.innerHTML = `<div class="scan-empty">Select clusters to start comparison.</div>`;
  }
}

function resolveClusterLeaderSymbol(clusterId, exchangeKey = compareState.exchange, windowKey = compareState.window) {
  const cluster = state.clusters.find((item) => item.id === clusterId);
  if (!cluster) return null;
  const momentumKey = compareWindowToMomentumKey(windowKey);
  const filteredStocks = clusterStocksByExchange(cluster, exchangeKey);
  const sourceStocks = filteredStocks.length ? filteredStocks : cluster.stocks;
  if (!sourceStocks.length) return null;
  const leader = [...sourceStocks].sort((a, b) => {
    const left = Number(a?.returns?.[momentumKey] || 0);
    const right = Number(b?.returns?.[momentumKey] || 0);
    if (right !== left) return right - left;
    return `${a.exchange}:${a.symbol}`.localeCompare(`${b.exchange}:${b.symbol}`);
  })[0];

  if (!leader) return null;
  return {
    symbol: leader.symbol,
    exchange: leader.exchange,
  };
}

async function fetchDecisionMarkersForCluster(clusterId) {
  if (!clusterId) return;
  const markerWindow = windowLabelToMarkerWindow();
  const leader = resolveClusterLeaderSymbol(clusterId, compareState.exchange, markerWindow);
  if (!leader || !leader.symbol) {
    compareState.markerByCluster.set(clusterId, []);
    compareState.markerSymbolByCluster.delete(clusterId);
    return;
  }
  compareState.markerSymbolByCluster.set(clusterId, `${leader.exchange}:${leader.symbol}`);

  let payload;
  if (runtimeState.adapter?.fetchDecisionMarkers) {
    payload = await runtimeState.adapter.fetchDecisionMarkers({
      symbol: leader.symbol,
      symbolExchange: leader.exchange,
      clusterId,
      exchange: compareState.exchange,
      window: markerWindow,
      points: COMPARE_WINDOWS[compareState.window].points,
      limit: 60,
    });
  } else {
    const response = await fetch(
      `/api/v1/charts/decision-markers?symbol=${encodeURIComponent(leader.symbol)}&symbolExchange=${encodeURIComponent(
        leader.exchange,
      )}&clusterId=${encodeURIComponent(clusterId)}&exchange=${encodeURIComponent(compareState.exchange)}&window=${encodeURIComponent(
        markerWindow,
      )}&points=${COMPARE_WINDOWS[compareState.window].points}&limit=60`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) {
      throw new Error(`marker-fetch-${response.status}`);
    }
    const raw = await response.json();
    payload = AdapterCore.normalizeDecisionMarkersPayload(raw);
  }

  compareState.markerByCluster.set(clusterId, payload.markers || []);
}

async function refreshDecisionMarkers() {
  const requestId = compareState.markerRequestId + 1;
  compareState.markerRequestId = requestId;
  const clusters = [...compareState.selectedClusterIds];
  if (!clusters.length) {
    compareState.markerByCluster.clear();
    renderCompareLegend();
    return;
  }

  await Promise.all(
    clusters.map((clusterId) =>
      fetchDecisionMarkersForCluster(clusterId).catch((error) => {
        console.error("Marker fetch failed", clusterId, error);
        compareState.markerByCluster.set(clusterId, []);
      }),
    ),
  );

  if (requestId !== compareState.markerRequestId) return;
  renderCompareSeriesToChart();
  renderCompareLegend();
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

function selectedClusterForBacktest() {
  if (!compareState.selectedClusterIds.length) return null;
  const ranked = compareState.selectedClusterIds
    .map((clusterId) => state.clusters.find((cluster) => cluster.id === clusterId))
    .filter(Boolean)
    .sort((a, b) => Number(b?.momentum?.["1M"] || 0) - Number(a?.momentum?.["1M"] || 0));
  return ranked[0] || null;
}

function clusterTickersForBacktest(cluster) {
  if (!cluster) return [];
  const scoped = clusterStocksByExchange(cluster, compareState.exchange);
  const source = scoped.length ? scoped : cluster.stocks;
  return source
    .slice(0, 20)
    .map((stock) => toQuantTicker(stock.symbol, stock.exchange))
    .filter(Boolean);
}

function renderBacktestSummary() {
  if (!runBacktestBtn || !backtestSummaryBox) return;
  const cluster = selectedClusterForBacktest();
  runBacktestBtn.disabled = compareState.backtestLoading || !cluster;

  if (compareState.backtestLoading) {
    backtestSummaryBox.innerHTML = `<div class="scan-empty">Running vectorbt 5-year backtest...</div>`;
    return;
  }

  if (compareState.backtestError) {
    backtestSummaryBox.innerHTML = `<div class="scan-empty">${escapeHtml(compareState.backtestError)}</div>`;
    return;
  }

  if (!compareState.backtestResult) {
    backtestSummaryBox.innerHTML = `<div class="scan-empty">Run backtest to view Win Rate, Max Drawdown, and CAGR.</div>`;
    return;
  }

  const metrics = compareState.backtestResult.metrics || {};
  backtestSummaryBox.innerHTML = `
    <div class="quant-metric-grid">
      <article class="quant-metric-item">
        <p>Win Rate</p>
        <h4>${toDisplayPercent(metrics.win_rate, { asPercent: false })}</h4>
      </article>
      <article class="quant-metric-item">
        <p>Max Drawdown</p>
        <h4>${toDisplayPercent(metrics.max_drawdown, { asPercent: false })}</h4>
      </article>
      <article class="quant-metric-item">
        <p>CAGR</p>
        <h4>${toDisplayPercent(metrics.cagr, { asPercent: false })}</h4>
      </article>
    </div>
    <div class="quant-result-meta">
      Cluster ${escapeHtml(compareState.backtestClusterId || "--")} • ${
        Array.isArray(compareState.backtestResult.tickers) ? compareState.backtestResult.tickers.length : 0
      } tickers • ${Array.isArray(compareState.backtestResult.equity_curve) ? compareState.backtestResult.equity_curve.length : 0} curve points
    </div>
  `;
}

async function runClusterBacktest() {
  const cluster = selectedClusterForBacktest();
  if (!cluster) {
    compareState.backtestError = "Select at least one cluster to run backtest.";
    compareState.backtestResult = null;
    renderBacktestSummary();
    return;
  }

  const tickers = clusterTickersForBacktest(cluster);
  if (!tickers.length) {
    compareState.backtestError = "No tradable tickers found for selected cluster.";
    compareState.backtestResult = null;
    renderBacktestSummary();
    return;
  }

  compareState.backtestLoading = true;
  compareState.backtestError = "";
  compareState.backtestClusterId = cluster.id;
  renderBacktestSummary();

  try {
    const payload = runtimeState.adapter?.fetchStrategyBacktest
      ? await runtimeState.adapter.fetchStrategyBacktest({
          tickers,
          lookbackYears: 5,
          initialCapital: 100000,
        })
      : null;
    if (!payload) throw new Error("Backtest adapter unavailable");
    compareState.backtestResult = payload;
    compareState.backtestError = "";
  } catch (error) {
    compareState.backtestResult = null;
    compareState.backtestError = error.message || "Backtest request failed";
  } finally {
    compareState.backtestLoading = false;
    renderBacktestSummary();
  }
}

function renderComparisonMeta() {
  const exchangeLabel = compareState.exchange === "all" ? "NSE + BSE" : compareState.exchange.toUpperCase();
  const clusterCount = compareState.selectedClusterIds.length;
  compareMeta.textContent = `${clusterCount}/${state.clusters.length} clusters • ${COMPARE_WINDOWS[compareState.window].label} • ${exchangeLabel}`;
}

function searchPeerStocks(query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return [];
  const selected = new Set(compareState.selectedClusterIds);
  return state.stocks
    .filter((stock) => (selected.size ? selected.has(stock.clusterId) : true))
    .filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(text) ||
        stock.name.toLowerCase().includes(text) ||
        `${stock.exchange}:${stock.symbol}`.toLowerCase().includes(text),
    )
    .slice(0, 10);
}

function renderPeerSearchResults() {
  if (!peerSearchResults) return;
  const matches = searchPeerStocks(compareState.peerSearch);
  if (!matches.length) {
    peerSearchResults.innerHTML = "";
    return;
  }

  peerSearchResults.innerHTML = matches
    .map(
      (stock) => `
      <button class="compare-search-item" data-peer-symbol="${stock.symbol}" data-peer-exchange="${stock.exchange}">
        <strong>${stock.exchange}:${stock.symbol}</strong>
        <span>${stock.name}</span>
      </button>
    `,
    )
    .join("");

  peerSearchResults.querySelectorAll("[data-peer-symbol]").forEach((item) => {
    item.addEventListener("click", () => {
      setPeerAnchorStock(item.dataset.peerSymbol, item.dataset.peerExchange);
      compareState.peerSearch = "";
      if (peerStockInput) peerStockInput.value = "";
      peerSearchResults.innerHTML = "";
    });
  });
}

function pickDefaultPeerAnchor() {
  const ranked = compareState.selectedClusterIds
    .map((clusterId) => {
      const cluster = state.clusters.find((item) => item.id === clusterId);
      if (!cluster) return null;
      const leader = resolveClusterLeaderSymbol(clusterId, compareState.exchange, compareState.window);
      if (!leader) return null;
      return {
        clusterId,
        leader,
        score: Number(cluster?.momentum?.[compareWindowToMomentumKey(compareState.window)] || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.leader || null;
}

function disposePeerChart() {
  if (peerChartState.resizeObserver) {
    peerChartState.resizeObserver.disconnect();
    peerChartState.resizeObserver = null;
  }
  if (peerChartState.chart) {
    peerChartState.chart.remove();
    peerChartState.chart = null;
  }
  peerChartState.seriesBySymbol.clear();
}

function initPeerChart() {
  const LightweightCharts = getLightweightChartsApi();
  if (!peerChart || !LightweightCharts) return;
  if (peerChartState.chart) return;
  const styles = getComputedStyle(document.body);
  peerChartState.chart = LightweightCharts.createChart(peerChart, {
    width: Math.max(280, peerChart.clientWidth || 540),
    height: Math.max(240, peerChart.clientHeight || 320),
    layout: {
      background: { color: "transparent" },
      textColor: styles.getPropertyValue("--muted").trim() || "#9bb0c9",
      fontFamily: "Satoshi, sans-serif",
    },
    grid: {
      vertLines: { color: "rgba(90, 115, 145, 0.2)" },
      horzLines: { color: "rgba(90, 115, 145, 0.2)" },
    },
    rightPriceScale: {
      borderColor: "rgba(90, 115, 145, 0.35)",
    },
    timeScale: {
      borderColor: "rgba(90, 115, 145, 0.35)",
      timeVisible: true,
      secondsVisible: false,
    },
    localization: {
      priceFormatter: (price) => `${price >= 0 ? "+" : ""}${Number(price).toFixed(2)}%`,
    },
  });

  peerChartState.resizeObserver = new ResizeObserver(() => {
    if (!peerChartState.chart) return;
    peerChartState.chart.applyOptions({
      width: Math.max(280, peerChart.clientWidth || 540),
      height: Math.max(240, peerChart.clientHeight || 320),
    });
  });
  peerChartState.resizeObserver.observe(peerChart);
}

function renderPeerChart() {
  initPeerChart();
  if (!peerChartState.chart) return;
  const payload = compareState.peerPayload;
  if (!payload || !payload.anchor) {
    [...peerChartState.seriesBySymbol.keys()].forEach((symbol) => {
      const series = peerChartState.seriesBySymbol.get(symbol);
      if (series) peerChartState.chart.removeSeries(series);
      peerChartState.seriesBySymbol.delete(symbol);
    });
    return;
  }

  const activeSymbols = new Set([payload.anchor.symbol, ...(payload.peers || []).map((item) => item.symbol)]);
  [...peerChartState.seriesBySymbol.keys()].forEach((symbol) => {
    if (activeSymbols.has(symbol)) return;
    const series = peerChartState.seriesBySymbol.get(symbol);
    if (series) peerChartState.chart.removeSeries(series);
    peerChartState.seriesBySymbol.delete(symbol);
  });

  [payload.anchor, ...(payload.peers || [])].forEach((stock, index) => {
    const symbol = stock.symbol;
    let series = peerChartState.seriesBySymbol.get(symbol);
    const color = index === 0 ? "#4bb27a" : COMPARE_COLOR_PALETTE[index % COMPARE_COLOR_PALETTE.length];
    if (!series) {
      series = addLineSeriesCompat(peerChartState.chart, {
        color,
        lineWidth: index === 0 ? 3 : 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      peerChartState.seriesBySymbol.set(symbol, series);
    } else {
      series.applyOptions({ color, lineWidth: index === 0 ? 3 : 2 });
    }
    const points = (payload.seriesBySymbol?.[symbol] || [])
      .map((point) => {
        const time = toChartTime(point.ts);
        if (!Number.isFinite(time)) return null;
        return {
          time,
          value: Number(point.value || 0),
        };
      })
      .filter(Boolean);
    series.setData(points);
  });

  peerChartState.chart.timeScale().fitContent();
}

function renderPeerPanel() {
  if (!peerMeta || !peerList) return;
  const payload = compareState.peerPayload;
  if (!payload || !payload.anchor) {
    peerMeta.textContent = "Pick a stock to compare peers";
    peerList.innerHTML = `<div class="scan-empty">Peer list appears after selecting an anchor stock.</div>`;
    renderPeerChart();
    return;
  }

  peerMeta.textContent = `${payload.cluster.name} • ${payload.window} • ${payload.exchange === "all" ? "NSE + BSE" : payload.exchange.toUpperCase()} • ${payload.source}`;
  const anchorLine = `
    <div class="peer-item">
      <div class="peer-item-left">
        <span class="chip-dot" style="background:#4bb27a"></span>
        <div>
          <div class="peer-item-name">Anchor ${payload.anchor.exchange}:${payload.anchor.symbol}</div>
          <span class="peer-item-meta">${payload.anchor.name}</span>
        </div>
      </div>
      <div class="peer-item-score">${percent(payload.anchor.returns?.[compareWindowToMomentumKey(compareState.window)] || 0)}</div>
    </div>
  `;
  const peers = (payload.peers || [])
    .map((peer, index) => {
      const color = COMPARE_COLOR_PALETTE[(index + 1) % COMPARE_COLOR_PALETTE.length];
      return `
      <div class="peer-item">
        <div class="peer-item-left">
          <span class="chip-dot" style="background:${color}"></span>
          <div>
            <div class="peer-item-name">${peer.exchange}:${peer.symbol}</div>
            <span class="peer-item-meta">Score ${Number(peer.competitorScore || 0).toFixed(2)}</span>
          </div>
        </div>
        <div class="peer-item-score">${percent(peer.returns?.[compareWindowToMomentumKey(compareState.window)] || 0)}</div>
      </div>
    `;
    })
    .join("");
  peerList.innerHTML = `${anchorLine}${peers || '<div class="scan-empty">No peers available for selected anchor.</div>'}`;
  renderPeerChart();
}

async function fetchPeerRelativeStrength() {
  const requestId = compareState.peerRequestId + 1;
  compareState.peerRequestId = requestId;
  const anchor = compareState.peerAnchor || pickDefaultPeerAnchor();
  if (!anchor || !anchor.symbol) {
    compareState.peerPayload = null;
    renderPeerPanel();
    return;
  }
  compareState.peerAnchor = anchor;

  let payload;
  if (runtimeState.adapter?.fetchPeerRelativeStrength) {
    payload = await runtimeState.adapter.fetchPeerRelativeStrength({
      symbol: anchor.symbol,
      exchange: compareState.exchange,
      window: compareState.window,
      points: COMPARE_WINDOWS[compareState.window].points,
    });
  } else {
    const response = await fetch(
      `/api/v1/peers/relative-strength?symbol=${encodeURIComponent(anchor.symbol)}&exchange=${encodeURIComponent(
        compareState.exchange,
      )}&window=${encodeURIComponent(compareState.window)}&points=${COMPARE_WINDOWS[compareState.window].points}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) {
      throw new Error(`peer-fetch-${response.status}`);
    }
    const raw = await response.json();
    payload = AdapterCore.normalizePeerRelativeStrengthPayload(raw);
  }

  if (requestId !== compareState.peerRequestId) return;
  compareState.peerPayload = payload;
  renderPeerPanel();
}

function setPeerAnchorStock(symbol, exchange) {
  if (!symbol) return;
  compareState.peerAnchor = {
    symbol: String(symbol).toUpperCase(),
    exchange: String(exchange || "NSE").toUpperCase(),
  };
  if (peerStockInput) {
    peerStockInput.value = `${compareState.peerAnchor.exchange}:${compareState.peerAnchor.symbol}`;
  }
  fetchPeerRelativeStrength().catch((error) => {
    console.error("Peer RS refresh failed", error);
    compareState.peerPayload = null;
    renderPeerPanel();
  });
}

function renderComparison() {
  renderCompareChips();
  renderComparisonMeta();
  renderCompareSeriesToChart();
  renderCompareLegend();
  renderMomentumScan();
  renderBacktestSummary();
  renderPeerPanel();
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
  const marketDataLabel = portfolioState.marketDataProvider || providerLabel;
  const suffix = marketDataLabel && marketDataLabel !== providerLabel ? ` • Feed: ${marketDataLabel}` : "";
  portfolioSourceChip.textContent = `Source: ${providerLabel} (${modeLabel})${suffix}`;
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

function setRationaleTab(nextTab) {
  const tab = nextTab === "macro" ? "macro" : "decision";
  portfolioState.rationaleTab = tab;

  portfolioRationaleTabs.forEach((button) => {
    const active = button.dataset.rationaleTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  if (portfolioDecisionPanel) {
    portfolioDecisionPanel.classList.toggle("hidden", tab !== "decision");
  }
  if (portfolioMacroPanel) {
    portfolioMacroPanel.classList.toggle("hidden", tab !== "macro");
  }
}

function macroScoreClass(score) {
  if (score >= 0.2) return "pos";
  if (score <= -0.2) return "neg";
  return "neu";
}

function syntheticMacroContextForRow(row) {
  const oneDay = Number(row?.returns?.["1D"] || 0);
  const oneMonth = Number(row?.returns?.["1M"] || 0);
  const score = clamp((oneDay * 0.1 + oneMonth * 0.03) / 1.5, -1, 1);
  const catalyst =
    score >= 0.2
      ? "Policy and liquidity commentary remains constructive for current trend."
      : score <= -0.2
        ? "Recent policy headlines indicate tighter risk control for leveraged pockets."
        : "Regulatory and macro signals remain balanced without a single dominant catalyst.";

  return AdapterCore.normalizeMacroContextPayload({
    asOf: new Date().toISOString(),
    exchange: String(row?.exchange || "all").toLowerCase(),
    symbol: row?.symbol || null,
    theme_hint: null,
    sentiment_score: Number.parseFloat(score.toFixed(4)),
    key_catalyst: catalyst,
    impacted_clusters: [
      {
        cluster_id: "synthetic-cluster-1",
        cluster_name: "Fintech & Payments India Policy Beneficiaries",
        head_name: "Fintech & Payments India",
        impact_score: Number.parseFloat(clamp(Math.abs(score) + 0.25, 0.2, 0.95).toFixed(4)),
      },
      {
        cluster_id: "synthetic-cluster-2",
        cluster_name: "Banking & Financial Services PSU Chain",
        head_name: "Banking & Financial Services",
        impact_score: Number.parseFloat(clamp(Math.abs(score) + 0.15, 0.18, 0.9).toFixed(4)),
      },
    ],
    rationale_summary:
      "Synthetic mode is active, so macro context is inferred from portfolio momentum instead of live regulatory feed polling. Switch to backend mode to use SQLite-harvested RBI/SEBI context.",
    considered_events: 0,
    processed_count: 0,
    sources: ["SYNTHETIC"],
    source_events: [],
    model: "synthetic",
    reason: "synthetic",
  });
}

function shouldUseSyntheticMacroFallback(payload) {
  if (!payload || typeof payload !== "object") return true;
  const reason = String(payload.reason || "").toLowerCase();
  if (reason === "storage-unavailable" || reason === "db-unavailable") return true;

  const considered = Number(payload.considered_events || 0);
  const sentiment = Number(payload.sentiment_score || 0);
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  if (considered <= 0 && Math.abs(sentiment) < 0.001 && sources.length === 0) return true;
  return false;
}

function buildMacroFallbackMessage(reason) {
  const key = String(reason || "").toLowerCase();
  if (!key) return "";
  if (key.includes("storage-unavailable") || key.includes("db-unavailable")) {
    return "Live macro storage is unavailable, so this sentiment is currently inferred from symbol momentum.";
  }
  if (key.includes("synthetic-fallback")) {
    return "Macro context is sparse for this symbol right now, so a momentum-derived fallback is shown.";
  }
  if (key.includes("synthetic")) {
    return "Synthetic macro mode is active for this symbol.";
  }
  return "";
}

function withSyntheticMacroFallback(basePayload, row, reasonTag) {
  const synthetic = syntheticMacroContextForRow(row);
  const base = basePayload && typeof basePayload === "object" ? basePayload : {};
  const sourceSet = new Set([...(Array.isArray(base.sources) ? base.sources : []), ...(synthetic.sources || []), "FALLBACK"]);
  return {
    ...synthetic,
    asOf: base.asOf || synthetic.asOf,
    exchange: base.exchange || synthetic.exchange,
    symbol: base.symbol || synthetic.symbol,
    considered_events: Number(base.considered_events || 0),
    processed_count: Number(base.processed_count || 0),
    source_events: Array.isArray(base.source_events) ? base.source_events : [],
    sources: [...sourceSet],
    model: `${base.model || "heuristic-v1"}+synthetic`,
    reason: `${reasonTag || base.reason || "empty-context"}|synthetic-fallback`,
  };
}

function renderMacroContextPanel(row) {
  if (!portfolioMacroPanel) return;
  if (!row) {
    portfolioMacroPanel.innerHTML = `<div class="scan-empty">Select a portfolio row to load macro context.</div>`;
    return;
  }

  const entry = portfolioState.macroContextByKey.get(row.key);
  if (!entry || entry.status === "loading") {
    portfolioMacroPanel.innerHTML = `<div class="scan-empty">Loading macro/regulatory context for ${row.exchange}:${row.symbol}...</div>`;
    return;
  }

  if (entry.status === "error") {
    portfolioMacroPanel.innerHTML = `<div class="scan-empty">${entry.error || "Macro context unavailable right now."}</div>`;
    return;
  }

  const payload = entry.data;
  if (!payload) {
    portfolioMacroPanel.innerHTML = `<div class="scan-empty">No macro context payload found.</div>`;
    return;
  }

  const scoreClass = macroScoreClass(payload.sentiment_score || 0);
  const sentimentLabel =
    scoreClass === "pos" ? "Constructive" : scoreClass === "neg" ? "Defensive" : "Balanced";
  const sourceLine = (payload.sources || []).length ? payload.sources.join(", ") : "--";
  const asOfLabel = payload.asOf ? new Date(payload.asOf).toLocaleTimeString("en-IN") : "--";
  const fallbackMessage = buildMacroFallbackMessage(payload.reason);

  portfolioMacroPanel.innerHTML = `
    ${
      fallbackMessage
        ? `<article class="decision-card"><h4>Context Note</h4><p>${escapeHtml(fallbackMessage)}</p></article>`
        : ""
    }
    <article class="decision-card">
      <h4>Macro Sentiment</h4>
      <p>
        <span class="macro-score-chip ${scoreClass}">${sentimentLabel} ${(payload.sentiment_score || 0).toFixed(2)}</span>
        • Sources ${sourceLine} • as of ${asOfLabel}
      </p>
    </article>
    <article class="decision-card">
      <h4>Key Catalyst</h4>
      <p>${payload.key_catalyst || "No catalyst detected."}</p>
    </article>
    <article class="decision-card">
      <h4>Impacted Micro-Clusters</h4>
      ${
        Array.isArray(payload.impacted_clusters) && payload.impacted_clusters.length
          ? `<div class="macro-cluster-list">
              ${payload.impacted_clusters
                .slice(0, 8)
                .map(
                  (cluster) => `
                    <div class="macro-cluster-item">
                      <span class="macro-cluster-name">${cluster.cluster_name}</span>
                      <span class="macro-cluster-meta">${cluster.head_name} • Impact ${(cluster.impact_score || 0).toFixed(2)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>`
          : `<p>No impacted micro-clusters detected for current context window.</p>`
      }
    </article>
    <article class="decision-card">
      <h4>Rationale Summary</h4>
      <p>${payload.rationale_summary || "No rationale summary available."}</p>
    </article>
  `;
}

async function requestMacroContextForRow(row, options = {}) {
  if (!row) return;
  const key = row.key;
  const cached = portfolioState.macroContextByKey.get(key);
  const ttlMs = 3 * 60 * 1000;
  if (!options.force && cached && cached.status === "ready" && Date.now() - cached.fetchedAtMs <= ttlMs) {
    return;
  }
  if (cached && cached.status === "loading") return;

  portfolioState.macroContextByKey.set(key, {
    status: "loading",
    fetchedAtMs: Date.now(),
    data: null,
    error: "",
  });
  renderMacroContextPanel(row);

  const requestId = portfolioState.macroContextRequestId + 1;
  portfolioState.macroContextRequestId = requestId;

  try {
    const hasMacroAdapter = Boolean(runtimeState.adapter?.fetchMacroContext);
    const backendPayload = hasMacroAdapter
      ? await runtimeState.adapter.fetchMacroContext({
          symbol: row.symbol,
          exchange: String(row.exchange || "all").toLowerCase(),
          limit: 30,
          includeProcessed: true,
        })
      : null;
    const payload = hasMacroAdapter
      ? shouldUseSyntheticMacroFallback(backendPayload)
        ? withSyntheticMacroFallback(backendPayload, row, backendPayload?.reason || "empty-context")
        : backendPayload
      : withSyntheticMacroFallback(null, row, "adapter-unavailable");

    if (requestId !== portfolioState.macroContextRequestId) {
      return;
    }

    portfolioState.macroContextByKey.set(key, {
      status: "ready",
      fetchedAtMs: Date.now(),
      data: payload,
      error: "",
    });
    if (portfolioState.selectedKey === key) renderMacroContextPanel(row);
  } catch (error) {
    portfolioState.macroContextByKey.set(key, {
      status: "error",
      fetchedAtMs: Date.now(),
      data: null,
      error: error.message || "Macro context request failed",
    });
    if (portfolioState.selectedKey === key) renderMacroContextPanel(row);
  }
}

function renderPortfolioDecisionPanel() {
  const row =
    portfolioState.rows.find((item) => item.key === portfolioState.selectedKey) ||
    filteredPortfolioRows()[0] ||
    null;

  if (!row) {
    portfolioDecisionMeta.textContent = "No selection";
    portfolioDecisionPanel.innerHTML = `<div class="scan-empty">No portfolio rows match current filters.</div>`;
    renderMacroContextPanel(null);
    renderCopilotChat();
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

  renderMacroContextPanel(row);
  renderCopilotChat();
  requestMacroContextForRow(row).catch((error) => {
    console.error("Macro context fetch failed", error);
  });
}

function buyRowsForOptimalSizing() {
  return filteredPortfolioRows().filter((row) => String(row?.decision?.action || "").toUpperCase() === "BUY");
}

function renderOptimalSizingPanel() {
  if (!calculateSizingBtn || !allocationSummaryCard || !allocationTableWrap || !allocationMeta) return;
  const buyRows = buyRowsForOptimalSizing();
  calculateSizingBtn.disabled = portfolioState.allocationLoading || buyRows.length < 2;
  allocationSummaryCard.classList.toggle("hidden", false);

  if (portfolioState.allocationLoading) {
    allocationMeta.textContent = `Running optimization for ${portfolioState.allocationTickers.length} tickers`;
    allocationTableWrap.innerHTML = `<div class="scan-empty">Computing max-Sharpe allocation...</div>`;
    return;
  }

  if (portfolioState.allocationError) {
    allocationMeta.textContent = "Sizing unavailable";
    allocationTableWrap.innerHTML = `<div class="scan-empty">${escapeHtml(portfolioState.allocationError)}</div>`;
    return;
  }

  const payload = portfolioState.allocationResult;
  if (!payload) {
    allocationMeta.textContent = buyRows.length >= 2 ? `${buyRows.length} BUY signals available` : "Need at least 2 BUY signals";
    allocationTableWrap.innerHTML = `<div class="scan-empty">Click “Calculate Optimal Sizing” to generate weights and share counts.</div>`;
    return;
  }

  const rows = Object.keys(payload.weights || {})
    .map((ticker) => ({
      ticker,
      weight: Number(payload.weights[ticker] || 0),
      shares: Number(payload.discrete_shares?.[ticker] || 0),
    }))
    .sort((a, b) => b.weight - a.weight);

  allocationMeta.textContent = `${rows.length} allocations • Remaining Cash ${money(payload.remaining_cash || 0)}`;
  allocationTableWrap.innerHTML = `
    <table class="quant-allocation-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Weight</th>
          <th>Shares</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.ticker)}</td>
                <td>${toDisplayPercent(row.weight, { asPercent: false })}</td>
                <td>${Math.max(0, Math.floor(row.shares))}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
    <div class="quant-table-footnote">
      Expected Return ${toDisplayPercent(payload?.portfolio_performance?.expected_annual_return || 0, { asPercent: false })}
      • Volatility ${toDisplayPercent(payload?.portfolio_performance?.annual_volatility || 0, { asPercent: false })}
      • Sharpe ${(payload?.portfolio_performance?.sharpe_ratio || 0).toFixed(2)}
    </div>
  `;
}

async function handleCalculateOptimalSizing() {
  const buyRows = buyRowsForOptimalSizing();
  if (buyRows.length < 2) {
    portfolioState.allocationResult = null;
    portfolioState.allocationError = "Need at least 2 BUY signals to optimize allocation.";
    renderOptimalSizingPanel();
    return;
  }

  const tickers = buyRows.slice(0, 20).map((row) => toQuantTicker(row.symbol, row.exchange));
  portfolioState.allocationTickers = tickers;
  portfolioState.allocationLoading = true;
  portfolioState.allocationError = "";
  renderOptimalSizingPanel();

  try {
    const payload = runtimeState.adapter?.fetchOptimalAllocation
      ? await runtimeState.adapter.fetchOptimalAllocation({
          tickers,
          capital: 100000,
        })
      : null;
    if (!payload) throw new Error("Allocation adapter unavailable");
    portfolioState.allocationResult = payload;
    portfolioState.allocationError = "";
  } catch (error) {
    portfolioState.allocationResult = null;
    portfolioState.allocationError = error.message || "Allocation request failed";
  } finally {
    portfolioState.allocationLoading = false;
    renderOptimalSizingPanel();
  }
}

function renderCommandPaletteIdle() {
  if (!commandResults) return;
  commandResults.innerHTML = `<div class="scan-empty">Enter a natural-language portfolio command and press Enter.</div>`;
}

function renderCommandPaletteLoading() {
  if (!commandResults) return;
  commandResults.innerHTML = `<div class="command-loader">Interpreting command...</div>`;
}

function renderCommandPaletteError(message) {
  if (!commandResults) return;
  commandResults.innerHTML = `<div class="scan-empty">${escapeHtml(message || "Command interpretation failed")}</div>`;
}

function renderCommandPaletteResult(payload) {
  if (!commandResults) return;
  commandResults.innerHTML = `
    <article class="command-result-block">
      <div class="command-result-meta">
        Intent <strong>${escapeHtml(String(payload.intent || "").toUpperCase())}</strong> •
        ${escapeHtml(payload.source_entity || "--")} -> ${escapeHtml(payload.target_entity || "--")} •
        ${Number(payload.capital_pct || 0).toFixed(2)}%
      </div>
      <pre class="command-result-json">${escapeHtml(prettyJson(payload.mock_basket || {}))}</pre>
    </article>
  `;
}

function setCommandPaletteOpen(isOpen) {
  commandPaletteState.isOpen = Boolean(isOpen);
  if (!commandPaletteOverlay) return;
  commandPaletteOverlay.classList.toggle("hidden", !commandPaletteState.isOpen);
  commandPaletteOverlay.setAttribute("aria-hidden", commandPaletteState.isOpen ? "false" : "true");

  if (commandPaletteState.isOpen) {
    if (commandInput) commandInput.focus();
  }
}

function toggleCommandPalette() {
  setCommandPaletteOpen(!commandPaletteState.isOpen);
  if (commandPaletteState.isOpen && commandInput) {
    commandInput.select();
  }
}

async function handleCommandPaletteSubmit() {
  if (!commandInput) return;
  if (commandPaletteState.loading) return;
  const text = commandInput.value.trim();
  if (!text) {
    renderCommandPaletteIdle();
    return;
  }

  commandPaletteState.loading = true;
  commandInput.disabled = true;
  renderCommandPaletteLoading();

  try {
    if (!runtimeState.adapter?.submitNlpCommand) {
      throw new Error("Command adapter unavailable");
    }
    const payload = await runtimeState.adapter.submitNlpCommand(text);
    renderCommandPaletteResult(payload);
  } catch (error) {
    renderCommandPaletteError(error.message || "Command interpretation failed");
  } finally {
    commandPaletteState.loading = false;
    commandInput.disabled = false;
  }
}

function renderCopilotChat() {
  if (!copilotChatLog || !copilotChatMeta || !copilotChatInput || !copilotChatSend) return;
  const row = selectedPortfolioRow();
  if (!row) {
    copilotChatMeta.textContent = "Ask about the selected symbol transcript";
    copilotChatSend.disabled = true;
    copilotChatLog.innerHTML = `<div class="scan-empty">Select a portfolio symbol, then ask a question.</div>`;
    return;
  }

  const symbolLabel = `${row.exchange}:${row.symbol}`;
  copilotChatMeta.textContent = `Transcript chat for ${symbolLabel}`;
  copilotChatSend.disabled = portfolioState.copilotLoading;

  const messages = getCopilotMessages(row.key);
  if (!messages.length && !portfolioState.copilotLoading) {
    copilotChatLog.innerHTML = `<div class="scan-empty">No chat history yet for ${escapeHtml(symbolLabel)}.</div>`;
    return;
  }

  const messageHtml = messages
    .map((message) => {
      const citations = Array.isArray(message.citations) ? message.citations : [];
      return `
        <article class="copilot-message ${message.role === "user" ? "user" : "assistant"}">
          <div class="copilot-message-role">${message.role === "user" ? "You" : "Copilot"}</div>
          <div class="copilot-message-text">${escapeHtml(message.text || "")}</div>
          ${
            citations.length
              ? `<ul class="copilot-citation-list">
                  ${citations
                    .map(
                      (citation) =>
                        `<li><strong>[C${citation.rank}]</strong> ${escapeHtml(String(citation.text || "").slice(0, 220))}${
                          String(citation.text || "").length > 220 ? "..." : ""
                        }</li>`,
                    )
                    .join("")}
                </ul>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  copilotChatLog.innerHTML = `
    ${messageHtml}
    ${portfolioState.copilotLoading ? '<div class="command-loader">Retrieving grounded answer...</div>' : ""}
  `;
  copilotChatLog.scrollTop = copilotChatLog.scrollHeight;
}

async function handleCopilotChatSubmit() {
  const row = selectedPortfolioRow();
  if (!row || !copilotChatInput) return;
  if (portfolioState.copilotLoading) return;
  const query = copilotChatInput.value.trim();
  if (!query) return;

  const history = getCopilotMessages(row.key);
  history.push({ role: "user", text: query, citations: [] });
  setCopilotMessages(row.key, history);
  copilotChatInput.value = "";
  portfolioState.copilotLoading = true;
  renderCopilotChat();

  try {
    if (!runtimeState.adapter?.sendEarningsQuery) {
      throw new Error("Research adapter unavailable");
    }
    const payload = await runtimeState.adapter.sendEarningsQuery(row.symbol, query);
    history.push({
      role: "assistant",
      text: payload.answer || "No answer returned.",
      citations: payload.citations || [],
    });
    setCopilotMessages(row.key, history);
  } catch (error) {
    history.push({
      role: "assistant",
      text: error.message || "Unable to fetch transcript answer right now.",
      citations: [],
    });
    setCopilotMessages(row.key, history);
  } finally {
    portfolioState.copilotLoading = false;
    renderCopilotChat();
  }
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
  renderOptimalSizingPanel();
  renderPortfolioRows();
  renderPortfolioDecisionPanel();
  setRationaleTab(portfolioState.rationaleTab);
}

function statusPillClass(status) {
  if (status === "up") return "status-pill-ok";
  if (status === "degraded") return "status-pill-warn";
  if (status === "down") return "status-pill-alert";
  return "status-pill-muted";
}

function statusLabel(status) {
  if (status === "up") return "UP";
  if (status === "degraded") return "DEGRADED";
  if (status === "down") return "DOWN";
  return "UNKNOWN";
}

function asOfClockLabel(iso) {
  if (!iso) return "--";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("en-IN", {
    hour12: true,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function probeNetworkEndpoint(definition) {
  const startedAt = Date.now();
  try {
    const response = await fetch(definition.url, {
      method: definition.method || "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
    });
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    let payload = null;
    let rawBody = "";

    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      rawBody = await response.text();
    }

    return {
      id: definition.id,
      label: definition.label,
      method: definition.method || "GET",
      url: definition.url,
      status: response.ok ? "up" : response.status >= 400 && response.status < 500 ? "degraded" : "down",
      ok: response.ok,
      httpStatus: response.status,
      latencyMs,
      payload,
      rawBody,
      checkedAt: new Date().toISOString(),
      error: "",
    };
  } catch (error) {
    return {
      id: definition.id,
      label: definition.label,
      method: definition.method || "GET",
      url: definition.url,
      status: "down",
      ok: false,
      httpStatus: 0,
      latencyMs: Math.max(0, Date.now() - startedAt),
      payload: null,
      rawBody: "",
      checkedAt: new Date().toISOString(),
      error: error.message || "request-failed",
    };
  }
}

function endpointSourceLabel(probe) {
  const payload = probe.payload || {};
  if (probe.id === "zerodha-session") return payload.provider || "kite-direct";
  if (probe.id === "zerodha-auth") return "kite-direct";
  if (probe.id === "angel-health" || probe.id === "angel-session") return "angel-one";
  if (probe.id === "market-bootstrap") return payload.source || "mock";
  if (probe.id === "portfolio-bootstrap") return payload.marketDataProvider || payload.provider || "unknown";
  if (probe.id === "macro-context") {
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    return sources.length ? sources.join(",") : payload.model || "macro-engine";
  }
  return "--";
}

function endpointNote(probe) {
  if (probe.error) return probe.error;
  const payload = probe.payload || {};

  if (probe.id === "zerodha-session") {
    if (payload.connected) {
      return `Connected${payload.user?.userId ? ` • ${payload.user.userId}` : ""}`;
    }
    const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter(Boolean).slice(0, 2) : [];
    return warnings.length ? warnings.join(" • ") : "Disconnected";
  }

  if (probe.id === "zerodha-auth") {
    if (payload.ready) return payload.connected ? "Ready • active session" : "Ready • awaiting login";
    return payload.message || "API key missing";
  }

  if (probe.id === "angel-health") {
    const checks = Array.isArray(payload.checks) ? payload.checks : [];
    const missingRequired = checks.filter((item) => item.required && !item.present).map((item) => item.key);
    if (payload.ready) return "Env ready";
    if (missingRequired.length) return `Missing ${missingRequired.slice(0, 2).join(", ")}`;
    return payload.message || "Health check unavailable";
  }

  if (probe.id === "angel-session") {
    if (payload.connected) return `Connected${payload.clientCode ? ` • ${payload.clientCode}` : ""}`;
    return "Disconnected";
  }

  if (probe.id === "market-bootstrap") {
    const debug = payload.debug || {};
    const fallback = debug.liveFallbackReason ? `fallback=${debug.liveFallbackReason}` : "";
    const stockCount = Array.isArray(payload.stocks) ? payload.stocks.length : 0;
    return `${payload.source || "unknown"} • stocks=${stockCount}${fallback ? ` • ${fallback}` : ""}`;
  }

  if (probe.id === "portfolio-bootstrap") {
    const rowCount = Array.isArray(payload.rows) ? payload.rows.length : 0;
    const connectionLabel = payload.connected ? "connected" : "read-only";
    return `${connectionLabel} • rows=${rowCount}`;
  }

  if (probe.id === "macro-context") {
    const sources = Array.isArray(payload.sources) ? payload.sources.length : 0;
    const events = Number(payload.considered_events || 0);
    return `sources=${sources} • events=${events}`;
  }

  return probe.ok ? "OK" : `HTTP ${probe.httpStatus}`;
}

function deriveNetworkModel(probes) {
  const upCount = probes.filter((probe) => probe.status === "up").length;
  const degradedCount = probes.filter((probe) => probe.status === "degraded").length;
  const downCount = probes.filter((probe) => probe.status === "down").length;
  const latencySet = probes.filter((probe) => Number.isFinite(probe.latencyMs) && probe.latencyMs > 0).map((probe) => probe.latencyMs);
  const avgLatencyMs = latencySet.length ? Math.round(latencySet.reduce((sum, value) => sum + value, 0) / latencySet.length) : 0;
  const overallStatus = downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : "up";
  const probeById = new Map(probes.map((probe) => [probe.id, probe]));

  const zerodhaSession = probeById.get("zerodha-session");
  const zerodhaAuth = probeById.get("zerodha-auth");
  const angelHealth = probeById.get("angel-health");
  const angelSession = probeById.get("angel-session");
  const marketBootstrap = probeById.get("market-bootstrap");
  const portfolioBootstrap = probeById.get("portfolio-bootstrap");
  const macroContext = probeById.get("macro-context");

  const zerodhaConnected = Boolean(zerodhaSession?.payload?.connected);
  const zerodhaReady = Boolean(zerodhaAuth?.payload?.ready);
  const angelConnected = Boolean(angelSession?.payload?.connected);
  const angelReady = Boolean(angelHealth?.payload?.ready);
  const marketSource = String(marketBootstrap?.payload?.source || "unknown");
  const marketLive = marketSource.includes("angel-live");
  const portfolioProvider = String(portfolioBootstrap?.payload?.provider || "unknown");
  const portfolioMarketProvider = String(portfolioBootstrap?.payload?.marketDataProvider || portfolioProvider || "unknown");
  const macroSources = Array.isArray(macroContext?.payload?.sources) ? macroContext.payload.sources : [];
  const macroEvents = Number(macroContext?.payload?.considered_events || 0);

  const providers = [
    {
      name: "Zerodha Broker Session",
      status: zerodhaConnected ? "up" : zerodhaReady ? "degraded" : "down",
      source: zerodhaSession?.payload?.provider || "kite-direct",
      detail: zerodhaConnected
        ? `Connected${zerodhaSession?.payload?.user?.userId ? ` as ${zerodhaSession.payload.user.userId}` : ""}`
        : zerodhaReady
          ? "Configured but disconnected"
          : "Credentials or auth-url configuration incomplete",
      apis: ["/api/zerodha/auth/url", "/api/zerodha/session/status"],
    },
    {
      name: "Angel Market Session",
      status: angelConnected ? "up" : angelReady ? "degraded" : "down",
      source: "angel-one",
      detail: angelConnected
        ? `Connected${angelSession?.payload?.clientCode ? ` as ${angelSession.payload.clientCode}` : ""}`
        : angelReady
          ? "Configured but disconnected"
          : "Missing required ANGEL_* credentials",
      apis: ["/api/angel/health", "/api/angel/session/status"],
    },
    {
      name: "Themes + Comparison Feed",
      status: marketBootstrap?.status === "down" ? "down" : marketLive ? "up" : "degraded",
      source: marketSource,
      detail:
        marketBootstrap?.status === "down"
          ? "Market bootstrap endpoint unavailable"
          : marketLive
            ? "Live Angel feed active"
            : `Fallback path active (${marketBootstrap?.payload?.debug?.liveFallbackReason || "mock"})`,
      apis: ["/api/v1/market/bootstrap", "/api/v1/market/poll"],
    },
    {
      name: "Portfolio Pipeline",
      status: portfolioBootstrap?.status === "down" ? "down" : portfolioBootstrap?.payload?.connected ? "up" : "degraded",
      source: `${portfolioProvider} • feed ${portfolioMarketProvider}`,
      detail:
        portfolioBootstrap?.status === "down"
          ? "Portfolio bootstrap endpoint unavailable"
          : portfolioBootstrap?.payload?.connected
            ? "Live holdings available"
            : "Read-only or demo bootstrap in use",
      apis: ["/api/v1/portfolio/bootstrap", "/api/v1/portfolio/poll"],
    },
    {
      name: "Macro & Regulatory Engine",
      status: macroContext?.status === "down" ? "down" : macroEvents > 0 ? "up" : "degraded",
      source: macroSources.length ? macroSources.join(", ") : "macro-engine",
      detail:
        macroContext?.status === "down"
          ? "Macro context endpoint unavailable"
          : macroEvents > 0
            ? `${macroEvents} relevant events in context window`
            : "No high-signal events in current context window",
      apis: ["/api/v1/macro/context", "/api/v1/macro/latest"],
    },
  ];

  const flows = [
    {
      name: "Holdings Data (Portfolio)",
      status: zerodhaConnected ? "up" : "degraded",
      source: zerodhaSession?.payload?.provider || "kite-direct",
      detail: zerodhaConnected ? "Live Zerodha session active" : "Zerodha not connected; portfolio may be stale/demo",
    },
    {
      name: "Market Quotes (Themes/Comparison)",
      status: marketBootstrap?.status === "down" ? "down" : marketLive ? "up" : "degraded",
      source: marketSource,
      detail: marketLive ? "Angel live quotes + returns" : "Fallback feed path in effect",
    },
    {
      name: "Portfolio Market Overlay",
      status: angelConnected ? "up" : "degraded",
      source: portfolioMarketProvider,
      detail: angelConnected ? "Angel overlay active for quote enrichment" : "Overlay disabled or disconnected",
    },
    {
      name: "Macro Context Feed",
      status: macroContext?.status === "down" ? "down" : macroEvents > 0 ? "up" : "degraded",
      source: macroSources.length ? macroSources.join(", ") : "macro-engine",
      detail: macroEvents > 0 ? "Regulatory/news events mapped to context" : "No events matched current selection window",
    },
  ];

  const endpoints = probes.map((probe) => ({
    ...probe,
    source: endpointSourceLabel(probe),
    note: endpointNote(probe),
  }));

  return {
    summary: {
      overallStatus,
      upCount,
      degradedCount,
      downCount,
      endpointCount: probes.length,
      avgLatencyMs,
    },
    providers,
    flows,
    endpoints,
  };
}

function clearNetworkRefreshTimer() {
  if (networkState.refreshTimer) {
    clearTimeout(networkState.refreshTimer);
    networkState.refreshTimer = null;
  }
}

function scheduleNetworkRefresh() {
  clearNetworkRefreshTimer();
  if (state.activeView !== "network") return;
  networkState.refreshTimer = window.setTimeout(() => {
    refreshNetworkDashboard({ silent: true }).catch((error) => {
      console.error("Network dashboard auto-refresh failed", error);
      scheduleNetworkRefresh();
    });
  }, NETWORK_REFRESH_INTERVAL_MS);
}

function renderNetworkDashboard() {
  if (!networkSummaryRow || !networkProviderCards || !networkFlowCards || !networkEndpointsTable) return;

  const summary = networkState.summary;
  const overallClass = statusPillClass(summary.overallStatus);

  if (networkRefreshBtn) {
    networkRefreshBtn.disabled = networkState.loading;
    networkRefreshBtn.textContent = networkState.loading ? "Refreshing..." : "Refresh Status";
  }

  if (networkLastChecked) {
    const checkedLabel = networkState.lastCheckedAt ? asOfClockLabel(networkState.lastCheckedAt) : "--";
    networkLastChecked.textContent = networkState.loading ? "Checking connectivity..." : `Last checked ${checkedLabel}`;
  }

  networkSummaryRow.innerHTML = `
    <article class="stat-card">
      <p>Overall Health</p>
      <h3><span class="status-pill ${overallClass}">${statusLabel(summary.overallStatus)}</span></h3>
    </article>
    <article class="stat-card"><p>Endpoints Up</p><h3>${summary.upCount}</h3></article>
    <article class="stat-card"><p>Degraded</p><h3>${summary.degradedCount}</h3></article>
    <article class="stat-card"><p>Down</p><h3>${summary.downCount}</h3></article>
    <article class="stat-card"><p>Avg Latency</p><h3>${summary.avgLatencyMs || 0}ms</h3></article>
    <article class="stat-card"><p>Total Checks</p><h3>${summary.endpointCount}</h3></article>
  `;

  if (!networkState.providers.length) {
    networkProviderCards.innerHTML = `<div class="scan-empty">No provider diagnostics available yet.</div>`;
    networkFlowCards.innerHTML = `<div class="scan-empty">No flow diagnostics available yet.</div>`;
    networkEndpointsTable.innerHTML = `<div class="scan-empty">No endpoint diagnostics available yet.</div>`;
    if (networkProvidersMeta) networkProvidersMeta.textContent = "--";
    if (networkFlowsMeta) networkFlowsMeta.textContent = "--";
    if (networkEndpointsMeta) networkEndpointsMeta.textContent = "--";
    return;
  }

  networkProviderCards.innerHTML = networkState.providers
    .map(
      (provider) => `
        <article class="network-card">
          <header>
            <h4>${escapeHtml(provider.name)}</h4>
            <span class="status-pill ${statusPillClass(provider.status)}">${statusLabel(provider.status)}</span>
          </header>
          <p class="network-card-source">${escapeHtml(provider.source || "--")}</p>
          <p class="network-card-detail">${escapeHtml(provider.detail || "--")}</p>
          <p class="network-card-apis">${provider.apis.map((apiPath) => `<code>${escapeHtml(apiPath)}</code>`).join("")}</p>
        </article>
      `,
    )
    .join("");

  networkFlowCards.innerHTML = networkState.flows
    .map(
      (flow) => `
        <article class="network-card">
          <header>
            <h4>${escapeHtml(flow.name)}</h4>
            <span class="status-pill ${statusPillClass(flow.status)}">${statusLabel(flow.status)}</span>
          </header>
          <p class="network-card-source">${escapeHtml(flow.source || "--")}</p>
          <p class="network-card-detail">${escapeHtml(flow.detail || "--")}</p>
        </article>
      `,
    )
    .join("");

  const endpointRows = networkState.endpoints
    .map(
      (endpoint) => `
        <tr>
          <td><span class="network-method">${escapeHtml(endpoint.method)}</span></td>
          <td>${escapeHtml(endpoint.label)}</td>
          <td><code>${escapeHtml(endpoint.url)}</code></td>
          <td><span class="status-pill ${statusPillClass(endpoint.status)}">${statusLabel(endpoint.status)}</span></td>
          <td>${endpoint.httpStatus || "--"}</td>
          <td>${Number.isFinite(endpoint.latencyMs) ? `${endpoint.latencyMs}ms` : "--"}</td>
          <td>${escapeHtml(endpoint.source || "--")}</td>
          <td>${escapeHtml(endpoint.note || "--")}</td>
        </tr>
      `,
    )
    .join("");

  networkEndpointsTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Endpoint</th>
          <th>Path</th>
          <th>Status</th>
          <th>HTTP</th>
          <th>Latency</th>
          <th>Source</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${endpointRows}</tbody>
    </table>
  `;

  if (networkProvidersMeta) {
    networkProvidersMeta.textContent = `${networkState.providers.length} providers`;
  }
  if (networkFlowsMeta) {
    networkFlowsMeta.textContent = `${networkState.flows.length} flows`;
  }
  if (networkEndpointsMeta) {
    networkEndpointsMeta.textContent = `${networkState.summary.endpointCount} probes`;
  }
}

async function refreshNetworkDashboard(options = {}) {
  if (!networkSummaryRow) return;
  const requestId = networkState.requestId + 1;
  networkState.requestId = requestId;
  networkState.loading = true;
  if (!options.silent) renderNetworkDashboard();

  try {
    const probes = await Promise.all(NETWORK_ENDPOINTS.map((definition) => probeNetworkEndpoint(definition)));
    if (requestId !== networkState.requestId) return;

    const derived = deriveNetworkModel(probes);
    networkState.summary = derived.summary;
    networkState.providers = derived.providers;
    networkState.flows = derived.flows;
    networkState.endpoints = derived.endpoints;
    networkState.lastCheckedAt = new Date().toISOString();
    networkState.loading = false;
    renderNetworkDashboard();
  } catch (error) {
    if (requestId !== networkState.requestId) return;
    networkState.loading = false;
    networkState.lastCheckedAt = new Date().toISOString();
    networkState.summary = {
      overallStatus: "down",
      upCount: 0,
      degradedCount: 0,
      downCount: NETWORK_ENDPOINTS.length,
      endpointCount: NETWORK_ENDPOINTS.length,
      avgLatencyMs: 0,
    };
    networkState.providers = [];
    networkState.flows = [];
    networkState.endpoints = [];
    renderNetworkDashboard();
    setRuntimeHealth("stale", "Network diagnostics refresh failed");
  } finally {
    scheduleNetworkRefresh();
  }
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
    compareState.markerByCluster.clear();
    compareState.peerPayload = null;
    renderComparison();
    return;
  }

  let adapterPayload;
  if (runtimeState.adapter?.fetchChartNormalizedReturns) {
    adapterPayload = await runtimeState.adapter.fetchChartNormalizedReturns({
      clusterIds: [...compareState.selectedClusterIds],
      window: compareState.window,
      exchange: compareState.exchange,
      points: COMPARE_WINDOWS[compareState.window].points,
    });
  } else {
    adapterPayload = await runtimeState.adapter.fetchComparisonSeries({
      clusterIds: [...compareState.selectedClusterIds],
      window: compareState.window,
      exchange: compareState.exchange,
      points: COMPARE_WINDOWS[compareState.window].points,
    });
  }

  if (requestId !== compareState.seriesRequestId) return;
  compareState.seriesByCluster = AdapterCore.mapComparisonSeries(adapterPayload);
  renderComparison();
  await Promise.all([
    refreshDecisionMarkers(),
    fetchPeerRelativeStrength().catch((error) => {
      console.error("Peer RS refresh failed", error);
      compareState.peerPayload = null;
      renderPeerPanel();
    }),
  ]);
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

function renderWhatsNewLog() {
  if (!whatsNewLogEl) return;

  whatsNewLogEl.innerHTML = WHATS_NEW_FEED.map((item) => {
    const target = String(item.targetView || "themes");
    const targetLabel = target === "whatsnew" ? "What's New" : target;
    return `
      <article class="whats-new-log-item">
        <p class="whats-new-date">${item.date}</p>
        <h4>${item.title}</h4>
        <p>${item.detail}</p>
        <button class="whats-new-log-action" data-quick-view-target="${target}">Open ${targetLabel}</button>
      </article>
    `;
  }).join("");
}

function renderPlanTraceGrid() {
  if (!planTraceGridEl) return;

  planTraceGridEl.innerHTML = PLAN_TRACE_ITEMS.map((item) => {
    const target = String(item.targetView || "whatsnew");
    const targetLabel = target === "whatsnew" ? "What's New" : target;
    const moduleList = item.modules.map((modulePath) => `<code>${modulePath}</code>`).join("");
    return `
      <article class="plan-trace-card">
        <p class="plan-trace-wave">${item.wave}</p>
        <h4>${item.source}</h4>
        <p>${item.integrated}</p>
        <p class="plan-trace-surface">Surface: ${item.uiSurface}</p>
        <div class="plan-trace-modules">${moduleList}</div>
        <button class="whats-new-log-action" data-quick-view-target="${target}">Open ${targetLabel}</button>
      </article>
    `;
  }).join("");
}

function setActiveView(target) {
  const allowedViews = new Set(["themes", "whatsnew", "comparison", "portfolio", "network"]);
  if (!allowedViews.has(target)) {
    target = "themes";
  }
  if (target === "portfolio" && !runtimeState.enablePortfolioView) {
    target = "themes";
  }
  state.activeView = target;
  themesViewEl.classList.toggle("active-view", target === "themes");
  whatsNewViewEl.classList.toggle("active-view", target === "whatsnew");
  comparisonViewEl.classList.toggle("active-view", target === "comparison");
  portfolioViewEl.classList.toggle("active-view", target === "portfolio");
  networkViewEl.classList.toggle("active-view", target === "network");

  viewLinks.forEach((link) => {
    const active = link.dataset.appViewTarget === target;
    link.classList.toggle("active", active);
    link.classList.toggle("muted", !active);
  });

  if (target === "comparison") {
    clearNetworkRefreshTimer();
    if (modal.open) closeClusterModal();
    requestAnimationFrame(() => {
      initCompareChart();
      initPeerChart();
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
    clearNetworkRefreshTimer();
  } else if (target === "network") {
    refreshNetworkDashboard({ silent: false }).catch((error) => {
      console.error("Failed to refresh network dashboard on view switch", error);
      renderNetworkDashboard();
    });
  } else {
    clearNetworkRefreshTimer();
  }
}

async function initializeComparisonState() {
  const defaultSelection = [...state.clusters]
    .sort((a, b) => b.momentum["1M"] - a.momentum["1M"])
    .slice(0, 4)
    .map((cluster) => cluster.id);

  compareState.selectedClusterIds = defaultSelection;
  compareState.peerAnchor = pickDefaultPeerAnchor();
  applyCompareButtonStates();
  initCompareChart();
  initPeerChart();
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

  document.addEventListener("click", (event) => {
    const targetButton = event.target.closest("[data-quick-view-target]");
    if (!targetButton) return;
    event.preventDefault();
    const target = targetButton.dataset.quickViewTarget;
    if (!target) return;
    setActiveView(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    const isPaletteToggle = key === "k" && (event.metaKey || event.ctrlKey);
    if (isPaletteToggle) {
      event.preventDefault();
      toggleCommandPalette();
      return;
    }

    if (key === "escape" && commandPaletteState.isOpen) {
      event.preventDefault();
      setCommandPaletteOpen(false);
    }
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

  if (peerStockInput) {
    peerStockInput.addEventListener("input", (event) => {
      compareState.peerSearch = event.target.value;
      renderPeerSearchResults();
    });
    peerStockInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const first = searchPeerStocks(compareState.peerSearch)[0];
      if (!first) return;
      setPeerAnchorStock(first.symbol, first.exchange);
      compareState.peerSearch = "";
      peerStockInput.value = "";
      if (peerSearchResults) peerSearchResults.innerHTML = "";
    });
  }

  if (runBacktestBtn) {
    runBacktestBtn.addEventListener("click", () => {
      runClusterBacktest().catch((error) => {
        console.error("Backtest run failed", error);
        compareState.backtestLoading = false;
        compareState.backtestResult = null;
        compareState.backtestError = error.message || "Backtest request failed";
        renderBacktestSummary();
      });
    });
  }

  document.addEventListener("click", (event) => {
    if (!compareSearchResults.contains(event.target) && event.target !== compareClusterInput) {
      compareSearchResults.innerHTML = "";
    }
    if (peerSearchResults && !peerSearchResults.contains(event.target) && event.target !== peerStockInput) {
      peerSearchResults.innerHTML = "";
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

  portfolioRationaleTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.rationaleTab;
      setRationaleTab(tab);
      if (tab === "macro") {
        const selectedRow =
          portfolioState.rows.find((item) => item.key === portfolioState.selectedKey) ||
          filteredPortfolioRows()[0] ||
          null;
        if (selectedRow) {
          requestMacroContextForRow(selectedRow, { force: true }).catch((error) => {
            console.error("Macro context refresh failed", error);
          });
        }
      }
    });
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

  if (calculateSizingBtn) {
    calculateSizingBtn.addEventListener("click", () => {
      handleCalculateOptimalSizing().catch((error) => {
        console.error("Optimal sizing failed", error);
        portfolioState.allocationLoading = false;
        portfolioState.allocationResult = null;
        portfolioState.allocationError = error.message || "Allocation request failed";
        renderOptimalSizingPanel();
      });
    });
  }

  if (networkRefreshBtn) {
    networkRefreshBtn.addEventListener("click", () => {
      refreshNetworkDashboard({ silent: false }).catch((error) => {
        console.error("Manual network refresh failed", error);
      });
    });
  }

  if (commandPaletteOverlay) {
    commandPaletteOverlay.addEventListener("click", (event) => {
      if (event.target === commandPaletteOverlay) {
        setCommandPaletteOpen(false);
      }
    });
  }

  if (commandInput) {
    commandInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleCommandPaletteSubmit().catch((error) => {
        console.error("Command palette submit failed", error);
        renderCommandPaletteError(error.message || "Command interpretation failed");
      });
    });
  }

  if (copilotChatSend) {
    copilotChatSend.addEventListener("click", () => {
      handleCopilotChatSubmit().catch((error) => {
        console.error("Copilot chat send failed", error);
      });
    });
  }

  if (copilotChatInput) {
    copilotChatInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleCopilotChatSubmit().catch((error) => {
        console.error("Copilot chat submit failed", error);
      });
    });
  }

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
    if (state.activeView === "comparison") {
      renderCompareSeriesToChart();
      renderPeerChart();
    }
  });

  renderCommandPaletteIdle();
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

  let bootstrap;
  try {
    bootstrap = await runtimeState.adapter.bootstrap({
      exchange: "all",
      window: compareState.window,
    });
  } catch (error) {
    if (runtimeState.adapterMode !== "backend") {
      throw error;
    }

    const fallbackReason = error?.message || "backend bootstrap failed";
    runtimeState.adapter = createSyntheticAdapter();
    runtimeState.adapterMode = "synthetic";
    runtimeState.persistentWarning = `Backend bootstrap failed (${fallbackReason}). Using synthetic mode.`;
    setRuntimeHealth("error", runtimeState.persistentWarning);

    bootstrap = await runtimeState.adapter.bootstrap({
      exchange: "all",
      window: compareState.window,
    });
  }

  applyNormalizedUniverse(bootstrap, {
    skipRecalc: runtimeState.adapterMode === "backend",
  });
  state.liveTick = 1;
  runtimeState.lastSuccessAtMs = Date.now();
  runtimeState.lastAsOfLabel = bootstrap.asOf;

  attachHandlers();
  renderPlanTraceGrid();
  renderWhatsNewLog();
  renderMatrix();
  if (runtimeState.enablePortfolioView) {
    renderPortfolio();
  }
  renderNetworkDashboard();
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
  setRuntimeHealth("error", `Unable to initialize data adapter: ${error?.message || "unknown error"}`);
});
