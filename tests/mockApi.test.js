const test = require("node:test");
const assert = require("node:assert/strict");

const mockMarket = require("../api/_lib/mockMarket");
const marketHandler = require("../api/market");
const comparisonHandler = require("../api/comparison");
const angelHandler = require("../api/angel");

function createRes() {
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
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("mock market view returns expected scale for all exchange", () => {
  const view = mockMarket.buildView("all");

  assert.equal(view.stocks.length, 2486);
  assert.equal(view.clusters.length, 175);
  assert.equal(view.heads.length, 26);
  assert.match(view.cursor, /^mock_/);
});

test("bootstrap endpoint returns contract payload", async () => {
  const req = { method: "GET", query: { route: "bootstrap", exchange: "all" } };
  const res = createRes();

  await marketHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body.heads), true);
  assert.equal(Array.isArray(res.body.clusters), true);
  assert.equal(Array.isArray(res.body.stocks), true);
  assert.equal(typeof res.body.asOf, "string");
  assert.equal(typeof res.body.cursor, "string");
});

test("poll endpoint ticks cursor and returns update envelope", async () => {
  const before = mockMarket.state.cursor;
  const req = { method: "GET", query: { route: "poll", exchange: "nse" } };
  const res = createRes();

  await marketHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.cursor, "string");
  assert.notEqual(res.body.cursor, before);
  assert.equal(Array.isArray(res.body.updates.stocks), true);
  assert.equal(Array.isArray(res.body.updates.clusters), true);
  assert.equal(Array.isArray(res.body.updates.heads), true);
});

test("comparison series endpoint maps requested cluster IDs", async () => {
  const view = mockMarket.buildView("all");
  const clusterIds = view.clusters.slice(0, 2).map((cluster) => cluster.id).join(",");

  const req = {
    method: "GET",
    query: {
      route: "series",
      clusterIds,
      window: "1M",
      exchange: "all",
      points: "12",
    },
  };

  const res = createRes();
  await comparisonHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.window, "1M");
  assert.equal(res.body.exchange, "all");
  const keys = Object.keys(res.body.seriesByClusterId);
  assert.equal(keys.length, 2);
  assert.equal(res.body.seriesByClusterId[keys[0]].length, 12);
});

test("angel health endpoint marks missing env vars", async () => {
  const snapshot = {
    ANGEL_API_KEY: process.env.ANGEL_API_KEY,
    ANGEL_CLIENT_CODE: process.env.ANGEL_CLIENT_CODE,
    ANGEL_PIN: process.env.ANGEL_PIN,
    ANGEL_TOTP_SECRET: process.env.ANGEL_TOTP_SECRET,
  };

  delete process.env.ANGEL_API_KEY;
  delete process.env.ANGEL_CLIENT_CODE;
  delete process.env.ANGEL_PIN;
  delete process.env.ANGEL_TOTP_SECRET;

  const res = createRes();
  await angelHandler({ method: "GET", query: { route: "health" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ready, false);
  assert.equal(res.body.mode, "missing-env-values");
  assert.equal(res.body.checks.every((entry) => entry.present === false), true);

  Object.keys(snapshot).forEach((key) => {
    if (typeof snapshot[key] === "string") process.env[key] = snapshot[key];
  });
});
