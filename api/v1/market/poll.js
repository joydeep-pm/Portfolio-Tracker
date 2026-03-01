const mockMarket = require("../../_lib/mockMarket");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  mockMarket.tickMarket();

  const exchange = mockMarket.getExchange(req.query?.exchange);
  const view = mockMarket.buildView(exchange);

  return res.status(200).json({
    asOf: view.asOf,
    cursor: view.cursor,
    updates: {
      stocks: view.stocks,
      clusters: view.clusters,
      heads: view.heads,
    },
  });
};
