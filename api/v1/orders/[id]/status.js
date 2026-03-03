const { getOrderById } = require("../../../_lib/orderService");
const { json, methodNotAllowed } = require("../../../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const orderId = req.query?.id || "";
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
};
