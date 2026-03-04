const mockMarket = require("./_lib/mockMarket");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json } = require("./_lib/http");

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "comparison-api");
  const respond = (statusCode, payload) =>
    json(res, statusCode, {
      ...(payload || {}),
      meta: {
        contractVersion: CONTRACTS.comparison,
        traceId: trace.traceId,
      },
    });
  const route = String(req.query?.route || "").toLowerCase();

  if (route !== "series") {
    return respond(404, { error: "Not found" });
  }

  if (req.method !== "GET") {
    return respond(405, { error: "Method not allowed" });
  }

  const payload = mockMarket.getComparisonSeries({
    clusterIds: req.query?.clusterIds,
    window: req.query?.window,
    exchange: req.query?.exchange,
    points: req.query?.points,
  });

  traceLog(trace, "info", "comparison.series.success", {
    exchange: payload.exchange,
    clusters: Object.keys(payload.seriesByClusterId || {}).length,
  });
  return respond(200, payload);
};
