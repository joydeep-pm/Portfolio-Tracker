const { createBrokerProvider } = require("./brokers/providerFactory");
const { evaluatePortfolio } = require("./decisionEngine");
const { assemblePortfolioSnapshot, instrumentKey } = require("./portfolioAssembler");
const { getSession } = require("./zerodhaSession");

const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];

const runtime = {
  snapshot: null,
  cursor: "",
  tick: 0,
  lastStructureSyncMs: 0,
};

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

function normalizeExchange(value) {
  const key = String(value || "all").toLowerCase();
  if (key === "nse" || key === "bse") return key;
  return "all";
}

function computeSummary(rows) {
  const totalInvested = rows.reduce((acc, row) => acc + toNumber(row.investedValue, 0), 0);
  const totalCurrent = rows.reduce((acc, row) => acc + toNumber(row.currentValue, 0), 0);
  const totalPnl = totalCurrent - totalInvested;

  return {
    totalSymbols: rows.length,
    totalInvested: Number.parseFloat(totalInvested.toFixed(2)),
    totalCurrent: Number.parseFloat(totalCurrent.toFixed(2)),
    totalPnl: Number.parseFloat(totalPnl.toFixed(2)),
    totalPnlPct: totalInvested > 0 ? Number.parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
    gainers: rows.filter((row) => toNumber(row.unrealizedPnl, 0) > 0).length,
    losers: rows.filter((row) => toNumber(row.unrealizedPnl, 0) < 0).length,
  };
}

function addPortfolioMetadata(snapshot, details) {
  const session = details.session || getSession();
  const providerMeta = details.providerMeta || { provider: "unknown", mode: "demo", connected: false };

  return {
    ...snapshot,
    cursor: details.cursor,
    connected: Boolean(session.connected || providerMeta.connected),
    provider: providerMeta.provider,
    providerMode: providerMeta.mode,
    user: {
      userId: session.userId || null,
      userName: session.userName || null,
    },
  };
}

function filterSnapshotByExchange(snapshot, exchange) {
  const normalized = normalizeExchange(exchange);
  if (normalized === "all") return snapshot;

  const rows = snapshot.rows.filter((row) => row.exchange.toLowerCase() === normalized);
  const decisions = rows.map((row) => row.decision);

  return {
    ...snapshot,
    rows,
    decisions,
    summary: {
      ...computeSummary(rows),
      cashAvailable: snapshot.summary?.cashAvailable || 0,
    },
  };
}

function rowChanged(previousRow, nextRow) {
  if (!previousRow) return true;
  if (toNumber(previousRow.lastPrice, 0) !== toNumber(nextRow.lastPrice, 0)) return true;
  if (toNumber(previousRow.currentValue, 0) !== toNumber(nextRow.currentValue, 0)) return true;

  const previousDecision = previousRow.decision || {};
  const nextDecision = nextRow.decision || {};
  if (previousDecision.action !== nextDecision.action) return true;
  if (toNumber(previousDecision.confidence, 0) !== toNumber(nextDecision.confidence, 0)) return true;

  return false;
}

function buildPollDelta(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot) {
    return {
      rows: nextSnapshot.rows,
      decisions: nextSnapshot.decisions,
      summary: nextSnapshot.summary,
    };
  }

  const previousByKey = new Map(previousSnapshot.rows.map((row) => [instrumentKey(row.exchange, row.symbol), row]));
  const changedRows = nextSnapshot.rows.filter((row) => rowChanged(previousByKey.get(instrumentKey(row.exchange, row.symbol)), row));

  const decisionByKey = new Map(changedRows.map((row) => [instrumentKey(row.exchange, row.symbol), row.decision]));

  return {
    rows: changedRows,
    decisions: nextSnapshot.decisions.filter((decision) => decisionByKey.has(instrumentKey(decision.exchange, decision.symbol))),
    summary: nextSnapshot.summary,
  };
}

function snapshotFromRows(rows, asOf, cashAvailable) {
  const sorted = [...rows].sort((a, b) => toNumber(b.currentValue, 0) - toNumber(a.currentValue, 0));
  const totalCurrent = sorted.reduce((acc, row) => acc + toNumber(row.currentValue, 0), 0);
  sorted.forEach((row) => {
    row.weightPct = totalCurrent > 0 ? Number.parseFloat(((row.currentValue / totalCurrent) * 100).toFixed(2)) : 0;
  });

  const decisions = evaluatePortfolio(sorted, asOf);
  const decisionMap = new Map(decisions.map((item) => [instrumentKey(item.exchange, item.symbol), item]));
  sorted.forEach((row) => {
    row.decision = decisionMap.get(instrumentKey(row.exchange, row.symbol)) || {
      symbol: row.symbol,
      exchange: row.exchange,
      action: "HOLD",
      confidence: 50,
      score: 0,
      reasons: ["No decision output available"],
      riskFlags: [],
      asOf,
    };
  });

  return {
    asOf,
    rows: sorted,
    decisions,
    summary: {
      ...computeSummary(sorted),
      cashAvailable: Number.parseFloat(toNumber(cashAvailable, 0).toFixed(2)),
    },
  };
}

async function buildFullSnapshot(provider) {
  const asOf = new Date().toISOString();
  const holdings = await provider.getHoldings();
  const positions = await provider.getPositions();
  const mergedRefs = [...holdings, ...positions]
    .map((item) => ({
      symbol: String(item.tradingsymbol || item.symbol || "").toUpperCase(),
      exchange: String(item.exchange || "NSE").toUpperCase(),
      instrumentToken: toNumber(item.instrument_token ?? item.instrumentToken, 0),
    }))
    .filter((item) => item.symbol);

  const uniqueRefs = [];
  const seen = new Set();
  mergedRefs.forEach((ref) => {
    const key = instrumentKey(ref.exchange, ref.symbol);
    if (seen.has(key)) return;
    seen.add(key);
    uniqueRefs.push(ref);
  });

  const [quotesByKey, returnsByKey, cashAvailable] = await Promise.all([
    provider.getQuotes(uniqueRefs),
    provider.getHistoricalReturns(uniqueRefs, WINDOWS),
    provider.getCashBalance ? provider.getCashBalance() : 0,
  ]);

  const snapshot = assemblePortfolioSnapshot({
    holdings,
    positions,
    quotesByKey,
    returnsByKey,
    asOf,
  });

  return {
    ...snapshot,
    summary: {
      ...snapshot.summary,
      cashAvailable: Number.parseFloat(toNumber(cashAvailable, 0).toFixed(2)),
    },
  };
}

async function updateSnapshotQuotes(provider) {
  if (!runtime.snapshot || !runtime.snapshot.rows.length) {
    return buildFullSnapshot(provider);
  }

  const asOf = new Date().toISOString();
  const refs = runtime.snapshot.rows.map((row) => ({
    symbol: row.symbol,
    exchange: row.exchange,
    instrumentToken: row.instrumentToken,
  }));

  const [quotesByKey, cashAvailable] = await Promise.all([
    provider.getQuotes(refs),
    provider.getCashBalance ? provider.getCashBalance() : 0,
  ]);

  const rows = runtime.snapshot.rows.map((row) => {
    const key = instrumentKey(row.exchange, row.symbol);
    const quote = quotesByKey[key] || {};
    const lastPrice = toNumber(quote.lastPrice ?? quote.last_price, toNumber(row.lastPrice, row.averagePrice));
    const previousClose = toNumber(quote.previousClose ?? quote.previous_close, 0);

    const investedValue = toNumber(row.averagePrice, 0) * toNumber(row.quantity, 0);
    const currentValue = lastPrice * toNumber(row.quantity, 0);
    const unrealizedPnl = currentValue - investedValue;
    const unrealizedPnlPct = investedValue > 0 ? pctChange(currentValue, investedValue) : 0;

    const nextReturns = {
      ...row.returns,
      "1D": previousClose > 0 ? Number.parseFloat(pctChange(lastPrice, previousClose).toFixed(2)) : toNumber(row.returns?.["1D"], 0),
    };

    nextReturns["1D"] = clamp(nextReturns["1D"], -30, 30);

    return {
      ...row,
      lastPrice: Number.parseFloat(lastPrice.toFixed(4)),
      investedValue: Number.parseFloat(investedValue.toFixed(2)),
      currentValue: Number.parseFloat(currentValue.toFixed(2)),
      unrealizedPnl: Number.parseFloat(unrealizedPnl.toFixed(2)),
      unrealizedPnlPct: Number.parseFloat(unrealizedPnlPct.toFixed(2)),
      returns: nextReturns,
    };
  });

  return snapshotFromRows(rows, asOf, cashAvailable);
}

async function ensureSnapshot(options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const session = getSession();
  const provider = createBrokerProvider({ session });

  const nowMs = Date.now();
  const requiresStructureSync =
    forceRefresh ||
    !runtime.snapshot ||
    !runtime.lastStructureSyncMs ||
    nowMs - runtime.lastStructureSyncMs > 60_000;

  const previousSnapshot = runtime.snapshot;
  const nextSnapshot = requiresStructureSync ? await buildFullSnapshot(provider) : await updateSnapshotQuotes(provider);
  if (requiresStructureSync) runtime.lastStructureSyncMs = nowMs;

  runtime.snapshot = nextSnapshot;
  runtime.tick += 1;
  runtime.cursor = `portfolio_${Date.now()}_${runtime.tick}`;

  return {
    snapshot: addPortfolioMetadata(nextSnapshot, {
      cursor: runtime.cursor,
      providerMeta: provider.meta ? provider.meta() : { provider: "unknown", mode: "demo", connected: false },
      session,
    }),
    previousSnapshot,
    provider,
  };
}

async function bootstrapPortfolio(options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const { snapshot } = await ensureSnapshot({ forceRefresh: Boolean(options.forceRefresh) });
  return filterSnapshotByExchange(snapshot, exchange);
}

async function pollPortfolio(options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const { snapshot, previousSnapshot } = await ensureSnapshot({ forceRefresh: false });
  const filteredSnapshot = filterSnapshotByExchange(snapshot, exchange);
  const filteredPrevious = previousSnapshot ? filterSnapshotByExchange(previousSnapshot, exchange) : null;

  return {
    asOf: filteredSnapshot.asOf,
    cursor: filteredSnapshot.cursor,
    updates: buildPollDelta(filteredPrevious, filteredSnapshot),
    connected: filteredSnapshot.connected,
    provider: filteredSnapshot.provider,
    providerMode: filteredSnapshot.providerMode,
  };
}

async function getDecisions(options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const snapshot = await bootstrapPortfolio({ exchange, forceRefresh: false });
  return {
    asOf: snapshot.asOf,
    decisions: snapshot.rows.map((row) => row.decision),
  };
}

module.exports = {
  bootstrapPortfolio,
  pollPortfolio,
  getDecisions,
};
