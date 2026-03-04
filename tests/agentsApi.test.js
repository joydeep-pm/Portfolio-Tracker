const test = require("node:test");
const assert = require("node:assert/strict");

const agentsHandler = require("../api/agents");

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

test("agents intent endpoint classifies prompt", async () => {
  const req = {
    method: "GET",
    query: {
      route: "intent",
      prompt: "evaluate my portfolio against current PSU bank thematic momentum",
    },
  };
  const res = createRes();
  await agentsHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intent, "portfolio_thematic_momentum");
  assert.equal(typeof res.body.meta, "object");
  assert.equal(typeof res.body.meta.contractVersion, "string");
  assert.equal(typeof res.body.meta.traceId, "string");
});

test("agents analyze endpoint returns decision payload", async () => {
  const req = {
    method: "POST",
    query: {
      route: "analyze",
      exchange: "all",
    },
    body: {
      prompt: "evaluate my portfolio against current PSU bank thematic momentum",
    },
  };
  const res = createRes();
  await agentsHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.intent, "string");
  assert.equal(Array.isArray(res.body.decisions), true);
  assert.equal(Array.isArray(res.body.graphTrace), true);
  assert.equal(typeof res.body.meta, "object");
});
