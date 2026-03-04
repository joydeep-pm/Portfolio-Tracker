const { buildPreview, saveSubmittedOrder, getOrderById } = require("./_lib/orderService");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, parseJsonBody, parseCookies } = require("./_lib/http");
const { isSessionExpired } = require("./_lib/zerodhaSession");

function sessionFromRequest(req) {
  const cookies = parseCookies(req);
  const accessToken = String(cookies.kite_access_token || "").trim();
  const userId = String(cookies.kite_user_id || "").trim();
  const userName = String(cookies.kite_user_name || "").trim();
  const expiresAt = String(cookies.kite_expires_at || "").trim();

  if (!accessToken) return null;
  if (isSessionExpired({ expiresAt })) return null;
  return {
    connected: true,
    accessToken,
    userId: userId || null,
    userName: userName || null,
    expiresAt: expiresAt || null,
    provider: "kite-direct",
  };
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "orders-api");
  const withMeta = (payload) => ({
    ...(payload || {}),
    meta: {
      contractVersion: CONTRACTS.orders,
      traceId: trace.traceId,
    },
  });
  const respond = (statusCode, payload) => json(res, statusCode, withMeta(payload));

  const route = String(req.query?.route || "").toLowerCase();
  const sessionOverride = sessionFromRequest(req);

  if (route === "preview") {
    if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

    const body = await parseJsonBody(req);
    const preview = await buildPreview(body, { sessionOverride });

    if (!preview.ok) {
      traceLog(trace, "info", "orders.preview.rejected", { error: preview.error || "invalid-preview" });
      return respond(400, preview);
    }

    traceLog(trace, "info", "orders.preview.success", {
      symbol: preview.symbol,
      notionalValue: preview.notionalValue,
    });
    return respond(200, preview);
  }

  if (route === "submit") {
    if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

    const body = await parseJsonBody(req);
    const preview = await buildPreview(body, { sessionOverride });

    if (!preview.ok) {
      traceLog(trace, "info", "orders.submit.rejected-preview", { error: preview.error || "invalid-preview" });
      return respond(400, preview);
    }

    if (preview.guardrails.exceedsLimit) {
      traceLog(trace, "info", "orders.submit.rejected-limit", {
        symbol: preview.symbol,
        notionalValue: preview.notionalValue,
      });
      return respond(400, {
        error: "order-limit-exceeded",
        message: `Order value exceeds MAX_ORDER_VALUE_INR (${preview.guardrails.maxOrderValue})`,
        preview,
      });
    }

    const liveTradingEnabled = String(process.env.ENABLE_LIVE_TRADING || "false").toLowerCase() === "true";
    if (!liveTradingEnabled) {
      const order = saveSubmittedOrder({
        ...preview,
        liveTradingEnabled,
        note: "Dry-run mode is active. Live order execution is disabled.",
      });

      traceLog(trace, "info", "orders.submit.dry-run", { id: order.id, symbol: order.symbol });
      return respond(200, {
        submitted: false,
        dryRun: true,
        order,
      });
    }

    const confirmation = String(body.confirmationText || "").trim().toUpperCase();
    if (confirmation !== "CONFIRM") {
      traceLog(trace, "info", "orders.submit.rejected-confirmation", { symbol: preview.symbol });
      return respond(400, {
        error: "missing-confirmation",
        message: "confirmationText must be CONFIRM for live order submission",
        preview,
      });
    }

    const order = saveSubmittedOrder({
      ...preview,
      liveTradingEnabled,
      note: "Live mode enabled. Integrate broker place-order call before production use.",
    });

    traceLog(trace, "info", "orders.submit.success", { id: order.id, symbol: order.symbol });
    return respond(200, {
      submitted: true,
      dryRun: false,
      order,
    });
  }

  if (route === "status") {
    if (req.method !== "GET") return respond(405, { error: "Method not allowed" });

    const orderId = String(req.query?.id || "");
    const order = getOrderById(orderId);

    if (!order) {
      traceLog(trace, "info", "orders.status.not-found", { id: orderId });
      return respond(404, {
        error: "order-not-found",
        id: orderId,
      });
    }

    traceLog(trace, "info", "orders.status.success", { id: order.id, status: order.status });
    return respond(200, {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      symbol: order.symbol,
      exchange: order.exchange,
      side: order.side,
      quantity: order.quantity,
      notionalValue: order.notionalValue,
      dryRun: !order.liveTradingEnabled,
      note: order.note,
    });
  }

  return respond(404, { error: "Not found" });
};
