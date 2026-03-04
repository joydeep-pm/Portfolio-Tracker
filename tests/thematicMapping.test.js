const test = require("node:test");
const assert = require("node:assert/strict");

const { loadThematicCatalog } = require("../api/_lib/thematicCatalog");
const { mapHoldingsToThemes } = require("../api/_lib/thematicMapping");

test("thematic catalog falls back to seed and returns normalized categories", async () => {
  const catalog = await loadThematicCatalog({
    path: "data/does-not-exist.json",
    forceReload: true,
  });

  assert.equal(Array.isArray(catalog.categories), true);
  assert.equal(catalog.categories.includes("broad"), true);
  assert.equal(Array.isArray(catalog.indices), true);
  assert.equal(catalog.indices.length > 0, true);
});

test("mapHoldingsToThemes maps known symbols into BharatFinTrack categories", async () => {
  const catalog = await loadThematicCatalog({
    path: "data/does-not-exist.json",
    forceReload: true,
  });

  const mapped = mapHoldingsToThemes(
    [
      { symbol: "RELIANCE", exchange: "NSE" },
      { symbol: "SBIN", exchange: "NSE" },
    ],
    catalog,
    "2026-03-04T10:00:00+05:30",
  );

  assert.equal(Array.isArray(mapped.mappings), true);
  assert.equal(mapped.mappings.length > 0, true);
  assert.equal(mapped.summary.totalHoldingsCovered, 2);
  assert.equal(mapped.mappings.some((item) => item.index_category !== "unclassified"), true);
});
