const test = require("node:test");
const assert = require("node:assert/strict");

const { createBrokerProvider, assertProviderContract } = require("../api/_lib/brokers/providerFactory");

test("kite-direct provider satisfies broker contract", () => {
  const provider = createBrokerProvider({
    provider: "kite-direct",
    apiKey: "",
    accessToken: "",
    fetchImpl: null,
  });

  assert.equal(typeof provider.getHoldings, "function");
  assert.equal(typeof provider.getPositions, "function");
  assert.equal(typeof provider.getQuotes, "function");
  assert.equal(typeof provider.getHistoricalReturns, "function");
  assert.equal(typeof provider.getCashBalance, "function");
  assert.equal(typeof provider.meta, "function");

  const meta = provider.meta();
  assert.equal(typeof meta.provider, "string");
  assert.equal(typeof meta.mode, "string");
  assert.equal(typeof meta.connected, "boolean");
});

test("kite-mcp provider satisfies broker contract", () => {
  const provider = createBrokerProvider({
    provider: "kite-mcp",
  });

  const meta = provider.meta();
  assert.equal(meta.provider, "kite-mcp");
  assert.equal(meta.mode, "stub");
  assert.equal(meta.connected, false);
});

test("assertProviderContract rejects invalid provider object", () => {
  assert.throws(
    () =>
      assertProviderContract({
        meta() {
          return {
            provider: "bad-provider",
            mode: "demo",
            connected: true,
          };
        },
      }),
    /missing required method "getHoldings"/i,
  );
});
