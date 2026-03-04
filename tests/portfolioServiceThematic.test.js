const test = require("node:test");
const assert = require("node:assert/strict");

const { bootstrapPortfolio } = require("../api/_lib/portfolioService");

test("bootstrapPortfolio includes thematic mapping metadata", async () => {
  const snapshot = await bootstrapPortfolio({
    exchange: "all",
    forceRefresh: true,
  });

  assert.equal(Array.isArray(snapshot.rows), true);
  assert.equal(Array.isArray(snapshot.thematicMappings), true);
  assert.equal(typeof snapshot.thematicSummary, "object");
  assert.equal(typeof snapshot.thematicCatalogSource, "string");
});
