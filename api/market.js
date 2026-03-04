const mockMarket = require("./_lib/mockMarket");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json } = require("./_lib/http");

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "market-api");
  const respond = (statusCode, payload) =>
    json(res, statusCode, {
      ...(payload || {}),
      meta: {
        contractVersion: CONTRACTS.market,
        traceId: trace.traceId,
      },
    });
  const route = String(req.query?.route || "").toLowerCase();

  if (route === "bootstrap") {
    if (req.method !== "GET") {
      return respond(405, { error: "Method not allowed" });
    }

    const exchange = mockMarket.getExchange(req.query?.exchange);
    const payload = mockMarket.buildView(exchange);
    traceLog(trace, "info", "market.bootstrap.success", {
      exchange,
      stocks: Array.isArray(payload.stocks) ? payload.stocks.length : 0,
    });
    return respond(200, payload);
  }

  if (route === "poll") {
    if (req.method !== "GET") {
      return respond(405, { error: "Method not allowed" });
    }

    mockMarket.tickMarket();
    const exchange = mockMarket.getExchange(req.query?.exchange);
    const view = mockMarket.buildView(exchange);

    traceLog(trace, "info", "market.poll.success", {
      exchange,
      stocks: Array.isArray(view.stocks) ? view.stocks.length : 0,
    });
    return respond(200, {
      asOf: view.asOf,
      cursor: view.cursor,
      updates: {
        stocks: view.stocks,
        clusters: view.clusters,
        heads: view.heads,
      },
    });
  }

  return respond(404, { error: "Not found" });
};
