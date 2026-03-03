const mockMarket = require("../../_lib/mockMarket");

module.exports = async function handler(req, res) {
  const action = String(req.query?.action || "").toLowerCase();

  if (action !== "series") {
    return res.status(404).json({ error: "Not found" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const payload = mockMarket.getComparisonSeries({
    clusterIds: req.query?.clusterIds,
    window: req.query?.window,
    exchange: req.query?.exchange,
    points: req.query?.points,
  });

  return res.status(200).json(payload);
};
