const mockMarket = require("../../_lib/mockMarket");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const exchange = mockMarket.getExchange(req.query?.exchange);
  const payload = mockMarket.buildView(exchange);

  return res.status(200).json(payload);
};
