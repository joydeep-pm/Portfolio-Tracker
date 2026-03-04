const test = require("node:test");
const assert = require("node:assert/strict");

const { createKiteDirectProvider } = require("../api/_lib/brokers/kiteDirectProvider");
const { instrumentKey } = require("../api/_lib/portfolioAssembler");

test("kite-direct overlays Angel quote when Angel session is connected", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.includes("/searchScrip")) {
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            status: true,
            data: [{ tradingsymbol: "SBIN", symboltoken: "3045" }],
          });
        },
      };
    }

    if (target.includes("/getLtpData")) {
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            status: true,
            data: { ltp: 725.5, close: 721.0 },
          });
        },
      };
    }

    return {
      ok: false,
      status: 404,
      async text() {
        return JSON.stringify({ status: false, message: "not-found" });
      },
    };
  };

  const provider = createKiteDirectProvider({
    apiKey: "",
    accessToken: "",
    fetchImpl,
    angelApiKey: "angel-key",
    enableAngelMarketData: true,
    session: {
      angel: {
        connected: true,
        accessToken: "angel-jwt",
        clientCode: "C12345",
      },
    },
  });

  const rows = [{ exchange: "NSE", symbol: "SBIN", instrumentToken: 0 }];
  const quotes = await provider.getQuotes(rows);
  const key = instrumentKey("NSE", "SBIN");

  assert.equal(quotes[key].lastPrice, 725.5);
  assert.equal(quotes[key].previousClose, 721.0);
  assert.equal(quotes[key].source, "angel");

  const meta = provider.meta();
  assert.equal(meta.provider, "kite-direct");
  assert.equal(meta.marketDataProvider, "angel");
  assert.equal(meta.angelOverlayActive, true);
  assert.equal(requests.some((item) => item.includes("/searchScrip")), true);
  assert.equal(requests.some((item) => item.includes("/getLtpData")), true);
});

test("kite-direct falls back to demo quotes when Angel overlay is unavailable", async () => {
  const provider = createKiteDirectProvider({
    apiKey: "",
    accessToken: "",
    fetchImpl: null,
    enableAngelMarketData: false,
    session: {
      angel: {
        connected: false,
      },
    },
  });

  const rows = [{ exchange: "NSE", symbol: "INFY", instrumentToken: 0 }];
  const quotes = await provider.getQuotes(rows);
  const key = instrumentKey("NSE", "INFY");

  assert.equal(typeof quotes[key].lastPrice, "number");
  assert.equal(typeof quotes[key].previousClose, "number");
  assert.equal(quotes[key].source, "demo");

  const meta = provider.meta();
  assert.equal(meta.marketDataProvider, "demo");
  assert.equal(meta.angelOverlayActive, false);
});
