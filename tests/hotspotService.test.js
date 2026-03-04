const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildHotspotScores,
  shouldRefreshCache,
  getScanCadenceMs,
  isMarketHoursIST,
} = require("../api/_lib/hotspotService");

test("buildHotspotScores aggregates theme scores and coverage", () => {
  const snapshot = {
    thematicMappings: [
      {
        symbol: "RELIANCE",
        exchange: "NSE",
        index_id: "nifty-energy",
        index_name: "NIFTY ENERGY",
        index_category: "sector",
        sector_tag: "Energy",
        source: "bharatfintrack",
      },
      {
        symbol: "ONGC",
        exchange: "NSE",
        index_id: "nifty-energy",
        index_name: "NIFTY ENERGY",
        index_category: "sector",
        sector_tag: "Energy",
        source: "bharatfintrack",
      },
    ],
  };

  const scanResult = {
    rows: [
      {
        symbol: "RELIANCE",
        exchange: "NSE",
        scanFlags: [
          { type: "breakout", score: 88 },
          { type: "momentum_anomaly", score: 72 },
        ],
      },
      {
        symbol: "ONGC",
        exchange: "NSE",
        scanFlags: [{ type: "consolidation", score: 81 }],
      },
    ],
  };

  const output = buildHotspotScores(snapshot, scanResult);
  assert.equal(Array.isArray(output.hotspots), true);
  assert.equal(output.hotspots.length, 1);
  assert.equal(output.hotspots[0].themeName, "NIFTY ENERGY");
  assert.equal(output.hotspots[0].score > 0, true);
  assert.equal(output.coverage.totalMappedHoldings, 2);
});

test("shouldRefreshCache honors cadence and force refresh", () => {
  const state = {
    cache: { exchange: "all" },
    lastRunAtMs: 1000,
  };

  assert.equal(
    shouldRefreshCache(state, {
      forceRefresh: false,
      exchange: "all",
      nowMs: 2000,
      cadenceMs: 2000,
    }),
    false,
  );

  assert.equal(
    shouldRefreshCache(state, {
      forceRefresh: false,
      exchange: "all",
      nowMs: 4001,
      cadenceMs: 2000,
    }),
    true,
  );

  assert.equal(
    shouldRefreshCache(state, {
      forceRefresh: true,
      exchange: "all",
      nowMs: 1100,
      cadenceMs: 2000,
    }),
    true,
  );
});

test("market-hours cadence is shorter than off-hours cadence", () => {
  const market = new Date("2026-03-04T10:00:00+05:30");
  const off = new Date("2026-03-04T20:00:00+05:30");

  assert.equal(isMarketHoursIST(market), true);
  assert.equal(isMarketHoursIST(off), false);
  assert.equal(getScanCadenceMs(market) < getScanCadenceMs(off), true);
});
