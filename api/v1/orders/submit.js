const { buildPreview, saveSubmittedOrder } = require("../../_lib/orderService");
const { json, methodNotAllowed, parseJsonBody } = require("../../_lib/http");

module.exports = async function handler(req, res) {
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
};
