const crypto = require("node:crypto");

const { bootstrapPortfolio } = require("./portfolioService");
const { toNumber } = require("./http");

const orders = new Map();

function normalizeSide(value) {
  const side = String(value || "BUY").toUpperCase();
  if (side === "BUY" || side === "SELL") return side;
  return "BUY";
}

function normalizeExchange(value) {
  const exchange = String(value || "NSE").toUpperCase();
  if (exchange === "NSE" || exchange === "BSE") return exchange;
  return "NSE";
}

function estimateCharges(notionalValue) {
  const brokerage = Math.min(20, notionalValue * 0.0003);
  const exchangeTxn = notionalValue * 0.0000345;
  const sebi = notionalValue * 0.000001;
  const stamp = notionalValue * 0.00015;
  const gst = (brokerage + exchangeTxn) * 0.18;

  const total = brokerage + exchangeTxn + sebi + stamp + gst;
  return {
    brokerage: Number.parseFloat(brokerage.toFixed(2)),
    exchangeTxn: Number.parseFloat(exchangeTxn.toFixed(2)),
    sebi: Number.parseFloat(sebi.toFixed(2)),
    stamp: Number.parseFloat(stamp.toFixed(2)),
    gst: Number.parseFloat(gst.toFixed(2)),
    total: Number.parseFloat(total.toFixed(2)),
  };
}

async function buildPreview(input = {}) {
  const symbol = String(input.symbol || "").toUpperCase();
  const exchange = normalizeExchange(input.exchange);
  const side = normalizeSide(input.side);
  const quantity = Math.max(0, Math.floor(toNumber(input.quantity, 0)));

  if (!symbol || !quantity) {
    return {
      ok: false,
      error: "symbol and quantity are required",
    };
  }

  const snapshot = await bootstrapPortfolio({ exchange: "all", forceRefresh: false });
  const row = snapshot.rows.find((item) => item.symbol === symbol && item.exchange === exchange);
  const price = toNumber(input.price, toNumber(row?.lastPrice, 0));

  if (!price) {
    return {
      ok: false,
      error: "Unable to resolve price for preview",
    };
  }

  const notionalValue = Number.parseFloat((price * quantity).toFixed(2));
  const charges = estimateCharges(notionalValue);
  const maxOrderValue = toNumber(process.env.MAX_ORDER_VALUE_INR, 200000);
  const exceedsLimit = notionalValue > maxOrderValue;

  return {
    ok: true,
    dryRun: String(process.env.ENABLE_LIVE_TRADING || "false").toLowerCase() !== "true",
    previewId: crypto.randomUUID(),
    symbol,
    exchange,
    side,
    quantity,
    price,
    notionalValue,
    charges,
    estimatedTotal: Number.parseFloat((notionalValue + charges.total).toFixed(2)),
    guardrails: {
      maxOrderValue,
      exceedsLimit,
    },
    asOf: snapshot.asOf,
  };
}

function saveSubmittedOrder(order) {
  const id = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const next = {
    id,
    ...order,
    status: order.liveTradingEnabled ? "SUBMITTED" : "DRY_RUN",
    createdAt: new Date().toISOString(),
  };

  orders.set(id, next);
  return next;
}

function getOrderById(id) {
  if (!id) return null;
  return orders.get(id) || null;
}

module.exports = {
  buildPreview,
  saveSubmittedOrder,
  getOrderById,
};
