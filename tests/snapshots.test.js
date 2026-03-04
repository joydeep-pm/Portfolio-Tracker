const test = require("node:test");
const assert = require("node:assert/strict");

const { saveEodSnapshot } = require("../api/_lib/snapshots");

function sampleSnapshot(asOf = "2026-03-04T10:00:00+05:30") {
  return {
    asOf,
    provider: "kite-direct",
    providerMode: "demo",
    connected: false,
    summary: {
      totalSymbols: 1,
      totalInvested: 1000,
      totalCurrent: 1100,
      totalPnl: 100,
      totalPnlPct: 10,
      cashAvailable: 5000,
      gainers: 1,
      losers: 0,
    },
    rows: [
      {
        symbol: "TCS",
        exchange: "NSE",
        decision: {
          action: "HOLD",
          confidence: 65,
          score: 10,
          reasons: ["Test reason"],
          riskFlags: [],
          asOf,
        },
      },
    ],
  };
}

test("saveEodSnapshot is idempotent for same snapshot date in memory mode", async () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const snapshotDate = "2099-12-30";
  const snapshot = sampleSnapshot();

  const first = await saveEodSnapshot({
    snapshotDate,
    snapshot,
  });

  const second = await saveEodSnapshot({
    snapshotDate,
    snapshot,
  });

  assert.equal(first.stored, true);
  assert.equal(first.mode, "memory");
  assert.equal(second.stored, false);
  assert.equal(second.mode, "memory");
  assert.equal(second.reason, "snapshot-exists");

  if (typeof originalUrl === "string") process.env.SUPABASE_URL = originalUrl;
  if (typeof originalKey === "string") process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});
