const { buildPreview, saveSubmittedOrder, getOrderById } = require("./_lib/orderService");
const { json, methodNotAllowed, parseJsonBody, parseCookies } = require("./_lib/http");

function sessionFromRequest(req) {
  const cookies = parseCookies(req);
  const accessToken = String(cookies.kite_access_token || "").trim();
  const userId = String(cookies.kite_user_id || "").trim();
  const userName = String(cookies.kite_user_name || "").trim();

  if (!accessToken) return null;
  return {
    connected: true,
    accessToken,
    userId: userId || null,
    userName: userName || null,
    provider: "kite-direct",
  };
}

module.exports = async function handler(req, res) {
  const route = String(req.query?.route || "").toLowerCase();
  const sessionOverride = sessionFromRequest(req);

  if (route === "preview") {
    if (req.method !== "POST") return methodNotAllowed(res);

    const body = await parseJsonBody(req);
    const preview = await buildPreview(body, { sessionOverride });

    if (!preview.ok) {
      return json(res, 400, preview);
    }

    return json(res, 200, preview);
  }

  if (route === "submit") {
    if (req.method !== "POST") return methodNotAllowed(res);

    const body = await parseJsonBody(req);
    const preview = await buildPreview(body, { sessionOverride });

    if (!preview.ok) {
      return json(res, 400, preview);
    }

    if (preview.guardrails.exceedsLimit) {
      return json(res, 400, {
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

      return json(res, 200, {
        submitted: false,
        dryRun: true,
        order,
      });
    }

    const confirmation = String(body.confirmationText || "").trim().toUpperCase();
    if (confirmation !== "CONFIRM") {
      return json(res, 400, {
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

    return json(res, 200, {
      submitted: true,
      dryRun: false,
      order,
    });
  }

  if (route === "status") {
    if (req.method !== "GET") return methodNotAllowed(res);

    const orderId = String(req.query?.id || "");
    const order = getOrderById(orderId);

    if (!order) {
      return json(res, 404, {
        error: "order-not-found",
        id: orderId,
      });
    }

    return json(res, 200, {
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

  return json(res, 404, { error: "Not found" });
};
