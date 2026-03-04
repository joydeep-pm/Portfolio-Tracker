const test = require("node:test");
const assert = require("node:assert/strict");

const { RECOMMENDATION_DISCLAIMER, applyDecisionGuardrails } = require("../api/_lib/safety");

test("applyDecisionGuardrails downgrades low-confidence aggressive actions", () => {
  const guarded = applyDecisionGuardrails(
    {
      symbol: "SBIN",
      exchange: "NSE",
      action: "BUY",
      confidence: 35,
      weightedScore: 20,
      riskFlags: [],
      rationale: [],
      invalidation: [],
    },
    {
      liveTradingEnabled: false,
      minDecisionConfidence: 40,
    },
  );

  assert.equal(guarded.action, "HOLD");
  assert.equal(guarded.riskFlags.includes("Low-confidence signal"), true);
});

test("disclaimer text is non-empty", () => {
  assert.equal(typeof RECOMMENDATION_DISCLAIMER, "string");
  assert.equal(RECOMMENDATION_DISCLAIMER.length > 20, true);
});
