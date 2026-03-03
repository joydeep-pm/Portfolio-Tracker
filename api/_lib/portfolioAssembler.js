const { evaluatePortfolio } = require("./decisionEngine");

const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function instrumentKey(exchange, symbol) {
  return `${String(exchange || "").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function normalizeHolding(holding) {
  return {
    symbol: String(holding.tradingsymbol || holding.symbol || "").toUpperCase(),
    exchange: String(holding.exchange || "NSE").toUpperCase(),
    quantity: toNumber(holding.quantity, 0),
    averagePrice: toNumber(holding.average_price ?? holding.averagePrice, 0),
    lastPrice: toNumber(holding.last_price ?? holding.lastPrice, 0),
    instrumentToken: toNumber(holding.instrument_token ?? holding.instrumentToken, 0),
    product: String(holding.product || "CNC").toUpperCase(),
    source: "holding",
  };
}

function normalizePosition(position) {
  return {
    symbol: String(position.tradingsymbol || position.symbol || "").toUpperCase(),
    exchange: String(position.exchange || "NSE").toUpperCase(),
    quantity: toNumber(position.quantity ?? position.net_quantity, 0),
    averagePrice: toNumber(position.average_price ?? position.averagePrice, 0),
    lastPrice: toNumber(position.last_price ?? position.lastPrice, 0),
    instrumentToken: toNumber(position.instrument_token ?? position.instrumentToken, 0),
    product: String(position.product || "MIS").toUpperCase(),
    source: "position",
  };
}

function safeReturns(returnsMap) {
  const output = {};
  WINDOWS.forEach((windowKey) => {
    output[windowKey] = toNumber(returnsMap?.[windowKey], 0);
  });
  return output;
}

function assemblePortfolioSnapshot(input = {}) {
  const holdings = Array.isArray(input.holdings) ? input.holdings.map(normalizeHolding) : [];
  const positions = Array.isArray(input.positions) ? input.positions.map(normalizePosition) : [];
  const quotesByKey = input.quotesByKey || {};
  const returnsByKey = input.returnsByKey || {};
  const asOf = input.asOf || new Date().toISOString();

  const rowsByKey = new Map();

  const consume = (item) => {
    if (!item.symbol || item.quantity === 0) return;
    const key = instrumentKey(item.exchange, item.symbol);
    const existing = rowsByKey.get(key);

    if (!existing) {
      rowsByKey.set(key, {
        key,
        symbol: item.symbol,
        exchange: item.exchange,
        instrumentToken: item.instrumentToken || 0,
        quantity: item.quantity,
        averagePrice: item.averagePrice,
        lastPrice: item.lastPrice,
        product: item.product,
        sourceTypes: [item.source],
      });
      return;
    }

    // Zerodha may surface CNC in both holdings and positions views; avoid double-counting.
    const isPotentialCncDuplicate =
      item.source === "position" &&
      item.product === "CNC" &&
      existing.sourceTypes.includes("holding");
    if (isPotentialCncDuplicate) {
      if (!existing.lastPrice && item.lastPrice) existing.lastPrice = item.lastPrice;
      return;
    }

    const combinedQty = existing.quantity + item.quantity;
    const invested = existing.averagePrice * existing.quantity + item.averagePrice * item.quantity;
    existing.quantity = combinedQty;
    existing.averagePrice = combinedQty !== 0 ? invested / combinedQty : existing.averagePrice;
    if (!existing.sourceTypes.includes(item.source)) existing.sourceTypes.push(item.source);
    if (!existing.instrumentToken && item.instrumentToken) existing.instrumentToken = item.instrumentToken;
    if (!existing.lastPrice && item.lastPrice) existing.lastPrice = item.lastPrice;
    existing.product = existing.product === item.product ? existing.product : `${existing.product}+${item.product}`;
  };

  holdings.forEach(consume);
  positions.forEach(consume);

  const rows = [...rowsByKey.values()]
    .filter((row) => row.quantity > 0)
    .map((row) => {
      const quote = quotesByKey[row.key] || {};
      const returns = safeReturns(returnsByKey[row.key]);
      const lastPrice = toNumber(quote.lastPrice ?? quote.last_price, toNumber(row.lastPrice, row.averagePrice));
      const investedValue = toNumber(row.averagePrice * row.quantity, 0);
      const currentValue = toNumber(lastPrice * row.quantity, 0);
      const unrealizedPnl = toNumber(currentValue - investedValue, 0);
      const unrealizedPnlPct = investedValue > 0 ? toNumber((unrealizedPnl / investedValue) * 100, 0) : 0;

      return {
        key: row.key,
        symbol: row.symbol,
        exchange: row.exchange,
        instrumentToken: row.instrumentToken,
        quantity: row.quantity,
        averagePrice: Number.parseFloat(row.averagePrice.toFixed(4)),
        lastPrice: Number.parseFloat(lastPrice.toFixed(4)),
        investedValue: Number.parseFloat(investedValue.toFixed(2)),
        currentValue: Number.parseFloat(currentValue.toFixed(2)),
        unrealizedPnl: Number.parseFloat(unrealizedPnl.toFixed(2)),
        unrealizedPnlPct: Number.parseFloat(unrealizedPnlPct.toFixed(2)),
        returns,
        product: row.product,
        sourceTypes: row.sourceTypes,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const totalInvested = rows.reduce((acc, row) => acc + row.investedValue, 0);
  const totalCurrent = rows.reduce((acc, row) => acc + row.currentValue, 0);
  const totalPnl = totalCurrent - totalInvested;

  rows.forEach((row) => {
    row.weightPct = totalCurrent > 0 ? Number.parseFloat(((row.currentValue / totalCurrent) * 100).toFixed(2)) : 0;
  });

  const decisions = evaluatePortfolio(rows, asOf);
  const decisionMap = new Map(decisions.map((decision) => [instrumentKey(decision.exchange, decision.symbol), decision]));

  rows.forEach((row) => {
    const decision = decisionMap.get(row.key);
    row.decision = decision || {
      action: "HOLD",
      confidence: 50,
      score: 0,
      reasons: ["No decision computed"],
      riskFlags: [],
      asOf,
      symbol: row.symbol,
      exchange: row.exchange,
    };
  });

  const gainers = rows.filter((row) => row.unrealizedPnl > 0).length;
  const losers = rows.filter((row) => row.unrealizedPnl < 0).length;

  return {
    asOf,
    rows,
    decisions,
    summary: {
      totalSymbols: rows.length,
      totalInvested: Number.parseFloat(totalInvested.toFixed(2)),
      totalCurrent: Number.parseFloat(totalCurrent.toFixed(2)),
      totalPnl: Number.parseFloat(totalPnl.toFixed(2)),
      totalPnlPct: totalInvested > 0 ? Number.parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
      gainers,
      losers,
    },
  };
}

module.exports = {
  assemblePortfolioSnapshot,
  instrumentKey,
};
