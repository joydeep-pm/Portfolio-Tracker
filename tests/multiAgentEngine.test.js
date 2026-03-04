const test = require("node:test");
const assert = require("node:assert/strict");

const { runAgentWorkflow, workflowNodes } = require("../api/_lib/multiAgentEngine");

test("workflowNodes returns non-empty node list for known intent", () => {
  const nodes = workflowNodes("portfolio_thematic_momentum");
  assert.equal(Array.isArray(nodes), true);
  assert.equal(nodes.length > 0, true);
  assert.equal(nodes.includes("recommendation_agent"), true);
});

test("runAgentWorkflow returns decision schema and graph trace", async () => {
  const payload = await runAgentWorkflow({
    prompt: "evaluate my portfolio against current PSU bank thematic momentum",
    exchange: "all",
  });

  assert.equal(typeof payload.intent, "string");
  assert.equal(typeof payload.route, "string");
  assert.equal(Array.isArray(payload.decisions), true);
  assert.equal(Array.isArray(payload.graphTrace), true);
  assert.equal(typeof payload.disclaimer, "string");

  if (payload.decisions.length > 0) {
    const decision = payload.decisions[0];
    assert.equal(typeof decision.symbol, "string");
    assert.equal(typeof decision.action, "string");
    assert.equal(typeof decision.confidence, "number");
    assert.equal(typeof decision.weightedScore, "number");
    assert.equal(Array.isArray(decision.riskFlags), true);
    assert.equal(Array.isArray(decision.rationale), true);
    assert.equal(Array.isArray(decision.invalidation), true);
  }
});
