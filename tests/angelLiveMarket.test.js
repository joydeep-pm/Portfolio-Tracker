const test = require("node:test");
const assert = require("node:assert/strict");

const { buildLiveMarketView, getLiveComparisonSeries, resetLiveMarketCache } = require("../api/_lib/angelLiveMarket");

function mockFetch(url, options = {}) {
  const target = String(url);
  const body = options?.body ? JSON.parse(options.body) : {};

  if (target.includes("/searchScrip")) {
    const symbol = String(body.searchscrip || "").toUpperCase();
    const token = String(
      [...symbol].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100000,
    );
    return Promise.resolve({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          status: true,
          data: [
            {
              tradingsymbol: symbol,
              symboltoken: token,
              companyname: `${symbol} LTD`,
            },
          ],
        });
      },
    });
  }

  if (target.includes("/getLtpData")) {
    const token = Number.parseInt(String(body.symboltoken || "0"), 10) || 1;
    const close = 200 + (token % 25);
    const ltp = close * 1.015;
    return Promise.resolve({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          status: true,
          data: { ltp, close },
        });
      },
    });
  }

  if (target.includes("/historical/v1/getCandleData")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          status: true,
          data: [
            ["2026-02-01T00:00:00+05:30", 100, 100, 100, 100, 10],
            ["2026-03-01T00:00:00+05:30", 110, 110, 110, 110, 10],
          ],
        });
      },
    });
  }

  return Promise.resolve({
    ok: false,
    status: 404,
    async text() {
      return JSON.stringify({ status: false, message: "not-found" });
    },
  });
}

test("buildLiveMarketView builds Angel-backed themes view", async () => {
  resetLiveMarketCache();
  const catalog = {
    source: "test-catalog",
    indices: [
      {
        id: "nifty-bank",
        name: "NIFTY BANK",
        category: "sector",
        sectorTag: "Banking",
        constituents: ["NSE:SBIN", "NSE:ICICIBANK"],
      },
      {
        id: "nifty-it",
        name: "NIFTY IT",
        category: "sector",
        sectorTag: "IT",
        constituents: ["NSE:INFY", "NSE:TCS"],
      },
    ],
  };

  const view = await buildLiveMarketView({
    exchange: "all",
    session: {
      connected: true,
      accessToken: "angel-jwt",
      clientCode: "C12345",
    },
    fetchImpl: mockFetch,
    angelApiKey: "quote-key",
    angelHistoricalApiKey: "historical-key",
    catalogOverride: catalog,
  });

  assert.equal(Boolean(view), true);
  assert.equal(view.source, "angel-live");
  assert.equal(Array.isArray(view.stocks), true);
  assert.equal(Array.isArray(view.clusters), true);
  assert.equal(Array.isArray(view.heads), true);
  assert.equal(view.stocks.length >= 4, true);
  assert.equal(view.clusters.length, 2);
  assert.equal(view.heads.length, 1);
  assert.equal(view.stocks[0].returns["1W"], 10);
  assert.equal(view.stocks[0].returns["1M"], 10);
  assert.equal(view.stocks[0].returns["6M"], 10);
  assert.equal(view.stocks[0].returns["YTD"], 10);
});

test("getLiveComparisonSeries maps live clusters to chart points", async () => {
  resetLiveMarketCache();
  const catalog = {
    source: "test-catalog",
    indices: [
      {
        id: "nifty-energy",
        name: "NIFTY ENERGY",
        category: "sector",
        sectorTag: "Energy",
        constituents: ["NSE:ONGC", "NSE:NTPC"],
      },
    ],
  };

  const view = await buildLiveMarketView({
    exchange: "all",
    session: {
      connected: true,
      accessToken: "angel-jwt",
      clientCode: "C12345",
    },
    fetchImpl: mockFetch,
    angelApiKey: "quote-key",
    angelHistoricalApiKey: "historical-key",
    catalogOverride: catalog,
  });

  const clusterId = view.clusters[0].id;
  const payload = getLiveComparisonSeries({
    view,
    clusterIds: clusterId,
    window: "1M",
    points: 9,
    exchange: "all",
  });

  assert.equal(Boolean(payload), true);
  assert.equal(payload.window, "1M");
  assert.equal(payload.exchange, "all");
  assert.equal(payload.seriesByClusterId[clusterId].length, 9);
});

test("buildLiveMarketView returns null when session is missing", async () => {
  resetLiveMarketCache();
  const view = await buildLiveMarketView({
    exchange: "all",
    session: {
      connected: false,
    },
    fetchImpl: mockFetch,
    angelApiKey: "quote-key",
    angelHistoricalApiKey: "historical-key",
  });

  assert.equal(view, null);
});

