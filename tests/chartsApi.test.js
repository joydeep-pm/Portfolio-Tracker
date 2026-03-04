const test = require("node:test");
const assert = require("node:assert/strict");

const chartsHandler = require("../api/charts");
const mockMarket = require("../api/_lib/mockMarket");
const { saveEodSnapshot } = require("../api/_lib/snapshots");
const { bootstrapPortfolio } = require("../api/_lib/portfolioService");

function createRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

test("charts normalized-returns returns cluster series payload", async () => {
  const view = mockMarket.buildView("all");
  const clusterIds = view.clusters.slice(0, 2).map((item) => item.id).join(",");
  const res = createRes();

  await chartsHandler(
    {
      method: "GET",
      query: {
        route: "normalized-returns",
        clusterIds,
        window: "1M",
        exchange: "all",
        points: "16",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.source, "string");
  assert.equal(Object.keys(res.body.seriesByClusterId).length, 2);
  assert.equal(Array.isArray(res.body.seriesByClusterId[view.clusters[0].id]), true);
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");
});

test("charts decision-markers returns history markers from decision audit", async () => {
  const view = mockMarket.buildView("all");
  const clusterId = view.clusters[0].id;
  const symbol = `P4HIST${Math.floor(Math.random() * 9000 + 1000)}`;

  await saveEodSnapshot({
    snapshotDate: `2099-12-${Math.floor(Math.random() * 27 + 1).toString().padStart(2, "0")}`,
    snapshot: {
      asOf: new Date().toISOString(),
      provider: "synthetic",
      providerMode: "demo",
      connected: false,
      summary: {},
      rows: [
        {
          symbol,
          exchange: "NSE",
          decision: {
            action: "BUY",
            confidence: 81.2,
            score: 42,
          },
        },
      ],
    },
  });

  const res = createRes();
  await chartsHandler(
    {
      method: "GET",
      query: {
        route: "decision-markers",
        symbol,
        symbolExchange: "NSE",
        clusterId,
        window: "1M",
        exchange: "all",
        points: "28",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body.markers), true);
  assert.equal(res.body.markers.length > 0, true);
  assert.equal(res.body.markers[res.body.markers.length - 1].action, "BUY");
  assert.equal(typeof res.body.meta?.contractVersion, "string");
});

test("charts decision-markers falls back to latest decision when no history exists", async (t) => {
  const snapshot = await bootstrapPortfolio({ exchange: "all", forceRefresh: true });
  const actionable = snapshot.rows.find((row) => ["BUY", "ACCUMULATE", "REDUCE", "SELL"].includes(row?.decision?.action));
  if (!actionable) {
    t.skip("No actionable decision available in snapshot for fallback assertion");
    return;
  }

  const view = mockMarket.buildView("all");
  const clusterId = view.clusters[1]?.id || view.clusters[0].id;
  const res = createRes();

  await chartsHandler(
    {
      method: "GET",
      query: {
        route: "decision-markers",
        symbol: actionable.symbol,
        symbolExchange: actionable.exchange,
        clusterId,
        window: "1M",
        exchange: "all",
        points: "32",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body.markers), true);
  assert.equal(res.body.markers.length > 0, true);
  assert.equal(res.body.fallbackUsed, true);
  assert.equal(res.body.markers.some((item) => item.source === "latest-decision"), true);
});
