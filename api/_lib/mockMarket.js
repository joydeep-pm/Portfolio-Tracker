const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];
const TARGET_STOCKS = 2486;
const TARGET_CLUSTERS = 175;

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

const CLUSTER_PATTERNS = [
  "Leaders",
  "Midcaps",
  "PSU Chain",
  "Exports",
  "Domestic Demand",
  "Ancillaries",
  "Capex Cycle",
  "Policy Beneficiaries",
  "Turnaround Basket",
  "Premium Segment",
  "Next-Gen Stack",
];

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
const COMPARE_WINDOWS = new Set(["1D", "5D", "1M", "6M", "YTD"]);

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(987654321);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randRange(min, max) {
  return min + rand() * (max - min);
}

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

function makeIndianSymbol(clusterName, clusterIndex, stockIndexInCluster, globalStockIndex) {
  const prefixA = SYMBOL_PREFIXES[(clusterIndex + stockIndexInCluster) % SYMBOL_PREFIXES.length];
  const prefixB = symbolFromCluster(clusterName);
  const prefix = `${prefixA}${prefixB}`.slice(0, 5);
  const suffix = String((globalStockIndex % 900) + 100);
  return `${prefix}${suffix}`;
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

function createStockReturns() {
  return {
    "1D": clamp(randRange(-2.8, 2.8), -14, 14),
    "1W": clamp(randRange(-5.2, 5.2), -24, 24),
    "1M": clamp(randRange(-9.4, 9.4), -38, 38),
    "6M": clamp(randRange(-18, 18), -65, 65),
    YTD: clamp(randRange(-22, 22), -80, 80),
  };
}

function averageReturns(returnMaps) {
  const out = { "1D": 0, "1W": 0, "1M": 0, "6M": 0, YTD: 0 };
  if (!returnMaps.length) return out;

  WINDOWS.forEach((windowKey) => {
    let sum = 0;
    returnMaps.forEach((returns) => {
      sum += returns[windowKey];
    });
    out[windowKey] = sum / returnMaps.length;
  });

  return out;
}

function recalcMomentum(state) {
  state.clusters.forEach((cluster) => {
    cluster.momentum = averageReturns(cluster.stocks.map((stock) => stock.returns));
  });

  state.heads.forEach((head) => {
    const clusters = state.clusters.filter((cluster) => cluster.headId === head.id);
    head.clusterIds = clusters.map((cluster) => cluster.id);
    head.momentum = averageReturns(clusters.map((cluster) => cluster.momentum));
  });
}

function makeClusterName(headName, localIndex, globalIndex) {
  const pattern = CLUSTER_PATTERNS[(localIndex + globalIndex * 2) % CLUSTER_PATTERNS.length];
  return `${headName} ${pattern}`;
}

function makeStockName(clusterName, index) {
  return `${clusterName.split(" ").slice(0, 2).join(" ")} Company ${index + 1}`;
}

function buildInitialState() {
  const heads = [];
  const clusters = [];
  const stocks = [];

  const headClusterCounts = allocateClusterCounts();
  let clusterGlobalIndex = 0;
  for (let headIndex = 0; headIndex < CORE_HEADS.length; headIndex += 1) {
    const headName = CORE_HEADS[headIndex];
    const headId = `head-${headIndex + 1}`;

    heads.push({
      id: headId,
      name: headName,
      momentum: { "1D": 0, "1W": 0, "1M": 0, "6M": 0, YTD: 0 },
      clusterIds: [],
    });

    for (let localClusterIndex = 0; localClusterIndex < headClusterCounts[headIndex]; localClusterIndex += 1) {
      clusters.push({
        id: `cluster-${clusterGlobalIndex + 1}`,
        headId,
        headName,
        name: makeClusterName(headName, localClusterIndex, clusterGlobalIndex),
        momentum: { "1D": 0, "1W": 0, "1M": 0, "6M": 0, YTD: 0 },
        stocks: [],
      });
      clusterGlobalIndex += 1;
    }
  }

  const stockCounts = allocateStockCounts(clusters.length);
  let stockIndex = 0;

  clusters.forEach((cluster, clusterIndex) => {
    const count = stockCounts[clusterIndex];
    for (let i = 0; i < count; i += 1) {
      const stock = {
        id: `stock-${stockIndex + 1}`,
        symbol: makeIndianSymbol(cluster.name, clusterIndex, i, stockIndex),
        exchange: EXCHANGES[rand() > 0.28 ? 0 : 1],
        name: makeStockName(cluster.name, i),
        clusterId: cluster.id,
        returns: createStockReturns(),
      };
      cluster.stocks.push(stock);
      stocks.push(stock);
      stockIndex += 1;
    }
  });

  const state = {
    heads,
    clusters,
    stocks,
    tick: 1,
    cursor: `mock_${Date.now()}_1`,
    asOf: new Date().toISOString(),
  };

  recalcMomentum(state);
  return state;
}

const marketState = buildInitialState();

function getExchange(value) {
  const exchange = (value || "all").toLowerCase();
  if (exchange === "nse" || exchange === "bse" || exchange === "all") return exchange;
  return "all";
}

function cloneReturns(returns) {
  return {
    "1D": returns["1D"],
    "1W": returns["1W"],
    "1M": returns["1M"],
    "6M": returns["6M"],
    YTD: returns.YTD,
  };
}

function buildView(exchangeValue) {
  const exchange = getExchange(exchangeValue);
  const sourceStocks = exchange === "all" ? marketState.stocks : marketState.stocks.filter((stock) => stock.exchange.toLowerCase() === exchange);

  const stocks = sourceStocks.map((stock) => ({
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

  const clusters = marketState.clusters
    .map((cluster) => {
      const clusterStocks = stocksByCluster.get(cluster.id) || [];
      if (exchange !== "all" && !clusterStocks.length) {
        return null;
      }
      return {
        id: cluster.id,
        headId: cluster.headId,
        headName: cluster.headName,
        name: cluster.name,
        momentum: cloneReturns(averageReturns(clusterStocks.length ? clusterStocks.map((stock) => stock.returns) : cluster.stocks.map((stock) => stock.returns))),
      };
    })
    .filter(Boolean);

  const clustersByHead = new Map();
  clusters.forEach((cluster) => {
    if (!clustersByHead.has(cluster.headId)) clustersByHead.set(cluster.headId, []);
    clustersByHead.get(cluster.headId).push(cluster.id);
  });

  const heads = marketState.heads
    .map((head) => {
      const clusterIds = clustersByHead.get(head.id) || [];
      if (!clusterIds.length) return null;

      const clusterMomentum = clusters
        .filter((cluster) => cluster.headId === head.id)
        .map((cluster) => cluster.momentum);

      return {
        id: head.id,
        name: head.name,
        momentum: cloneReturns(averageReturns(clusterMomentum)),
        clusterIds,
      };
    })
    .filter(Boolean);

  return {
    asOf: marketState.asOf,
    cursor: marketState.cursor,
    heads,
    clusters,
    stocks,
  };
}

function tickMarket() {
  marketState.stocks.forEach((stock) => {
    stock.returns["1D"] = clamp(stock.returns["1D"] + (rand() - 0.5) * 0.68, -15, 15);
    stock.returns["1W"] = clamp(stock.returns["1W"] + stock.returns["1D"] * 0.018 + (rand() - 0.5) * 0.14, -30, 30);
    stock.returns["1M"] = clamp(stock.returns["1M"] + stock.returns["1D"] * 0.009 + (rand() - 0.5) * 0.08, -45, 45);
    stock.returns["6M"] = clamp(stock.returns["6M"] + stock.returns["1D"] * 0.006 + (rand() - 0.5) * 0.05, -70, 70);
    stock.returns.YTD = clamp(stock.returns.YTD + stock.returns["1D"] * 0.005 + (rand() - 0.5) * 0.04, -90, 90);
  });

  marketState.tick += 1;
  marketState.asOf = new Date().toISOString();
  marketState.cursor = `mock_${Date.now()}_${marketState.tick}`;
  recalcMomentum(marketState);
}

function compareWindowToMomentumKey(windowKey) {
  if (windowKey === "5D") return "1W";
  return windowKey;
}

function getComparisonSeries(options = {}) {
  const exchange = getExchange(options.exchange);
  const windowKey = COMPARE_WINDOWS.has(options.window) ? options.window : "1M";
  const points = Math.max(5, Math.min(120, Number.parseInt(options.points || "40", 10) || 40));
  const clusterIds = String(options.clusterIds || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const view = buildView(exchange);
  const clustersById = new Map(view.clusters.map((cluster) => [cluster.id, cluster]));
  const seriesByClusterId = {};

  clusterIds.forEach((clusterId) => {
    const cluster = clustersById.get(clusterId);
    if (!cluster) {
      seriesByClusterId[clusterId] = [];
      return;
    }

    const momentumKey = compareWindowToMomentumKey(windowKey);
    const base = cluster.momentum[momentumKey] || 0;
    const seed = hashString(`${clusterId}|${windowKey}|${exchange}|${marketState.tick}`);
    const seeded = mulberry32(seed || 1);

    const output = [];
    let cursor = 0;
    for (let i = 0; i < points; i += 1) {
      const seasonal = Math.sin((i / points) * Math.PI * 2) * 0.14;
      const drift = base / points;
      const noise = (seeded() - 0.5) * 0.74;
      cursor = clamp(cursor + drift + noise + seasonal, -85, 85);
      output.push({
        ts: new Date(Date.now() - (points - i) * 60000).toISOString(),
        value: Number.parseFloat(cursor.toFixed(4)),
      });
    }

    seriesByClusterId[clusterId] = output;
  });

  return {
    asOf: marketState.asOf,
    window: windowKey,
    exchange,
    seriesByClusterId,
  };
}

module.exports = {
  buildView,
  tickMarket,
  getComparisonSeries,
  getExchange,
  state: marketState,
};
