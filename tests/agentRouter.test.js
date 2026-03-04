const test = require("node:test");
const assert = require("node:assert/strict");

const { routePrompt } = require("../api/_lib/agentRouter");

test("routePrompt detects thematic portfolio momentum intent", () => {
  const routed = routePrompt("evaluate my portfolio against current PSU bank thematic momentum");
  assert.equal(routed.intent, "portfolio_thematic_momentum");
  assert.equal(typeof routed.route, "string");
  assert.equal(routed.themeHints.includes("psu bank"), true);
});

test("routePrompt detects watchlist suggestion intent", () => {
  const routed = routePrompt("suggest watchlist ideas for banking and IT");
  assert.equal(routed.intent, "watchlist_suggestions");
});
