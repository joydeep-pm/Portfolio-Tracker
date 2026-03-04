const test = require("node:test");
const assert = require("node:assert/strict");

const portfolioHandler = require("../api/portfolio");
const ordersHandler = require("../api/orders");

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

test("portfolio bootstrap includes trace and contract metadata", async () => {
  const req = {
    method: "GET",
    query: { route: "bootstrap", exchange: "all", refresh: "true" },
    headers: {},
  };
  const res = createRes();
  await portfolioHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");
  assert.equal(typeof res.getHeader("x-trace-id"), "string");
});

test("portfolio decisions include guardrails disclaimer and metadata", async () => {
  const req = {
    method: "GET",
    query: { route: "decisions", exchange: "all" },
    headers: {},
  };
  const res = createRes();
  await portfolioHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body.decisions), true);
  assert.equal(typeof res.body.disclaimer, "string");
  assert.equal(res.body.disclaimer.length > 10, true);
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");
});

test("orders preview includes trace and contract metadata", async () => {
  const req = {
    method: "POST",
    query: { route: "preview" },
    headers: {},
    body: {
      symbol: "INFY",
      exchange: "NSE",
      side: "BUY",
      quantity: 1,
      price: 1500,
    },
  };
  const res = createRes();
  await ordersHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");
  assert.equal(typeof res.getHeader("x-trace-id"), "string");
});

test("orders status not-found includes trace and contract metadata", async () => {
  const req = {
    method: "GET",
    query: { route: "status", id: "missing-order-id" },
    headers: {},
  };
  const res = createRes();
  await ordersHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "order-not-found");
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");
});
