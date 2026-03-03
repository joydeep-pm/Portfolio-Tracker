function createKiteMcpProvider() {
  return {
    name: "kite-mcp",
    mode: "stub",
    async getHoldings() {
      return [];
    },
    async getPositions() {
      return [];
    },
    async getQuotes() {
      return {};
    },
    async getHistoricalReturns() {
      return {};
    },
    async getCashBalance() {
      return 0;
    },
    meta() {
      return {
        provider: "kite-mcp",
        mode: "stub",
        connected: false,
        warning: "kite-mcp provider stub is active. Switch BROKER_PROVIDER to kite-direct for live data.",
      };
    },
  };
}

module.exports = {
  createKiteMcpProvider,
};
