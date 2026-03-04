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

test("kite-direct derives historical returns from Angel candle data", async () => {
  const requests = [];
  const headersByPath = new Map();
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    requests.push(target);
    const keyHeader = String(options?.headers?.["X-PrivateKey"] || "");
    if (target.includes("/searchScrip")) {
      headersByPath.set("searchScrip", keyHeader);
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            status: true,
            data: [{ tradingsymbol: "SBINHIST", symboltoken: "93045" }],
          });
        },
      };
    }

    if (target.includes("/historical/v1/getCandleData")) {
      headersByPath.set("historical", keyHeader);
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            status: true,
            data: [
              ["2026-02-20T00:00:00+05:30", 700, 710, 690, 700, 1000],
              ["2026-03-04T00:00:00+05:30", 770, 780, 760, 770, 1000],
            ],
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
    angelApiKey: "angel-quote-key",
    angelHistoricalApiKey: "angel-historical-key",
    enableAngelMarketData: true,
    session: {
      angel: {
        connected: true,
        accessToken: "angel-jwt",
        clientCode: "C12345",
      },
    },
  });

  const rows = [{ exchange: "NSE", symbol: "SBINHIST", instrumentToken: 0 }];
  const returns = await provider.getHistoricalReturns(rows, ["1W", "1M", "6M", "YTD"]);
  const key = instrumentKey("NSE", "SBINHIST");

  assert.equal(returns[key]["1W"], 10);
  assert.equal(returns[key]["1M"], 10);
  assert.equal(returns[key]["6M"], 10);
  assert.equal(returns[key]["YTD"], 10);
  assert.equal(headersByPath.get("searchScrip"), "angel-quote-key");
  assert.equal(headersByPath.get("historical"), "angel-historical-key");
  assert.equal(requests.some((item) => item.includes("/historical/v1/getCandleData")), true);
});
