const test = require("node:test");
const assert = require("node:assert/strict");

const hotspotsHandler = require("../api/hotspots");

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
  };
}

test("hotspots snapshot returns ranked hotspot payload", async () => {
  const req = {
    method: "GET",
    query: { route: "snapshot", exchange: "all", refresh: "true" },
  };
  const res = createRes();

  await hotspotsHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body.hotspots), true);
  assert.equal(typeof res.body.cursor, "string");
  assert.equal(typeof res.body.scheduler, "object");
  assert.equal(typeof res.body.meta, "object");
  assert.equal(typeof res.body.meta.contractVersion, "string");
  assert.equal(typeof res.body.meta.traceId, "string");
});

test("hotspots poll returns updates envelope", async () => {
  const first = createRes();
  await hotspotsHandler(
    {
      method: "GET",
      query: { route: "snapshot", exchange: "all", refresh: "true" },
    },
    first,
  );

  const cursor = first.body.cursor;

  const second = createRes();
  await hotspotsHandler(
    {
      method: "GET",
      query: { route: "poll", exchange: "all", cursor },
    },
    second,
  );

  assert.equal(second.statusCode, 200);
  assert.equal(typeof second.body.cursor, "string");
  assert.equal(typeof second.body.updates, "object");
  assert.equal(Array.isArray(second.body.updates.hotspots), true);
  assert.equal(typeof second.body.meta, "object");
});
