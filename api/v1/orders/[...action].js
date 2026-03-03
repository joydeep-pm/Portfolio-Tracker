const { buildPreview, saveSubmittedOrder, getOrderById } = require("../../_lib/orderService");
const { json, methodNotAllowed, parseJsonBody } = require("../../_lib/http");

function pathParts(req) {
  const raw = req.query?.action;
  if (Array.isArray(raw)) return raw.map((part) => String(part).toLowerCase());
  if (!raw) return [];
  return [String(raw).toLowerCase()];
}

module.exports = async function handler(req, res) {
  const parts = pathParts(req);

  if (parts.length === 1 && parts[0] === "preview") {
    if (req.method !== "POST") return methodNotAllowed(res);

    const body = await parseJsonBody(req);
    const preview = await buildPreview(body);

    if (!preview.ok) {
      return json(res, 400, preview);
    }

    return json(res, 200, preview);
  }

  if (parts.length === 1 && parts[0] === "submit") {
    if (req.method !== "POST") return methodNotAllowed(res);

    const body = await parseJsonBody(req);
    const preview = await buildPreview(body);

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

  if (parts.length === 2 && parts[1] === "status") {
    if (req.method !== "GET") return methodNotAllowed(res);

    const orderId = String(parts[0] || "");
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
