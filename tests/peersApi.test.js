const test = require("node:test");
const assert = require("node:assert/strict");

const peersHandler = require("../api/peers");
const mockMarket = require("../api/_lib/mockMarket");

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

test("peers relative-strength returns anchor plus top 3 peers with aligned series", async () => {
  const view = mockMarket.buildView("all");
  const targetCluster = view.clusters.find((cluster) => view.stocks.filter((stock) => stock.clusterId === cluster.id).length >= 4);
  assert.equal(Boolean(targetCluster), true);

  const stocks = view.stocks.filter((stock) => stock.clusterId === targetCluster.id);
  const anchor = stocks[0];
  const res = createRes();

  await peersHandler(
    {
      method: "GET",
      query: {
        route: "relative-strength",
        symbol: anchor.symbol,
        exchange: "all",
        window: "1M",
        points: "24",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.anchor.symbol, anchor.symbol);
  assert.equal(res.body.cluster.id, targetCluster.id);
  assert.equal(Array.isArray(res.body.peers), true);
  assert.equal(res.body.peers.length, 3);

  const anchorSeries = res.body.seriesBySymbol[anchor.symbol];
  assert.equal(Array.isArray(anchorSeries), true);
  assert.equal(anchorSeries.length, 24);

  res.body.peers.forEach((peer) => {
    const series = res.body.seriesBySymbol[peer.symbol];
    assert.equal(Array.isArray(series), true);
    assert.equal(series.length, anchorSeries.length);
  });

  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");
});

test("peers relative-strength rejects missing symbol", async () => {
  const res = createRes();

  await peersHandler(
    {
      method: "GET",
      query: {
        route: "relative-strength",
        exchange: "all",
        window: "1M",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "invalid-symbol");
});
