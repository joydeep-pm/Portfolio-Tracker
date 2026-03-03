const { createKiteDirectProvider } = require("./kiteDirectProvider");
const { createKiteMcpProvider } = require("./kiteMcpProvider");

function normalizeProvider(value) {
  const key = String(value || "kite-direct").trim().toLowerCase();
  if (key === "kite-mcp") return "kite-mcp";
  return "kite-direct";
}

function createBrokerProvider(options = {}) {
  const providerKey = normalizeProvider(options.provider || process.env.BROKER_PROVIDER);

  if (providerKey === "kite-mcp") {
    return createKiteMcpProvider(options);
  }

  return createKiteDirectProvider(options);
}

module.exports = {
  createBrokerProvider,
  normalizeProvider,
};
