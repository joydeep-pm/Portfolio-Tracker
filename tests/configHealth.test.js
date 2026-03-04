const test = require("node:test");
const assert = require("node:assert/strict");

const { inspectConfig } = require("../api/_lib/configHealth");

test("inspectConfig reports live-ready profile when Zerodha keys are present", () => {
  const payload = inspectConfig({
    BROKER_PROVIDER: "kite-direct",
    KITE_API_KEY: "kite-key",
    KITE_API_SECRET: "kite-secret",
    ENABLE_LIVE_TRADING: "false",
  });

  assert.equal(payload.profiles.zerodhaLiveReady, true);
  assert.equal(payload.profiles.liveTradingEnabled, false);
  assert.equal(Array.isArray(payload.checks), true);
  assert.equal(payload.checks.some((row) => row.key === "KITE_API_SECRET" && row.maskedValue.includes("*")), true);
});

test("inspectConfig flags warnings for missing required live-mode fields", () => {
  const payload = inspectConfig({
    BROKER_PROVIDER: "kite-mcp",
    ENABLE_LIVE_TRADING: "true",
    ENABLE_PKSCREENER_LIVE: "true",
  });

  assert.equal(payload.profiles.zerodhaLiveReady, false);
  assert.equal(payload.profiles.liveTradingReady, false);
  assert.equal(payload.profiles.pkscreenerLiveReady, false);
  assert.equal(payload.warnings.length >= 2, true);
});
