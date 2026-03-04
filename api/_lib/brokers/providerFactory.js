const { createKiteDirectProvider } = require("./kiteDirectProvider");
const { createKiteMcpProvider } = require("./kiteMcpProvider");

const REQUIRED_METHODS = [
  "getHoldings",
  "getPositions",
  "getQuotes",
  "getHistoricalReturns",
  "getCashBalance",
];
const ALLOWED_MODES = new Set(["live", "demo", "stub"]);

function normalizeProvider(value) {
  const key = String(value || "kite-direct").trim().toLowerCase();
  if (key === "kite-mcp") return "kite-mcp";
  return "kite-direct";
}

function assertProviderContract(provider) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Broker provider contract violation: provider must be an object");
  }

  REQUIRED_METHODS.forEach((methodName) => {
    if (typeof provider[methodName] !== "function") {
      throw new Error(`Broker provider contract violation: missing required method "${methodName}"`);
    }
  });

  if (typeof provider.meta !== "function") {
    throw new Error('Broker provider contract violation: missing required method "meta"');
  }

  const meta = provider.meta();
  if (!meta || typeof meta !== "object") {
    throw new Error("Broker provider contract violation: meta() must return an object");
  }

  if (!meta.provider || typeof meta.provider !== "string") {
    throw new Error('Broker provider contract violation: meta().provider must be a non-empty string');
  }

  if (!meta.mode || typeof meta.mode !== "string" || !ALLOWED_MODES.has(meta.mode)) {
    throw new Error(`Broker provider contract violation: meta().mode must be one of ${[...ALLOWED_MODES].join(", ")}`);
  }

  if (typeof meta.connected !== "boolean") {
    throw new Error("Broker provider contract violation: meta().connected must be a boolean");
  }

  return provider;
}

function createBrokerProvider(options = {}) {
  const providerKey = normalizeProvider(options.provider || process.env.BROKER_PROVIDER);
  const provider = providerKey === "kite-mcp" ? createKiteMcpProvider(options) : createKiteDirectProvider(options);
  return assertProviderContract(provider);
}

module.exports = {
  createBrokerProvider,
  normalizeProvider,
  assertProviderContract,
};
