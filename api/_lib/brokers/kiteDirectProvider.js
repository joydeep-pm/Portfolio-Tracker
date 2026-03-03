const crypto = require("node:crypto");

const mockMarket = require("../mockMarket");
const { instrumentKey } = require("../portfolioAssembler");

const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];
const KITE_API_BASE = "https://api.kite.trade";
const HISTORY_TTL_MS = 10 * 60 * 1000;

const historyCache = new Map();

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pctChange(latest, base) {
  if (!Number.isFinite(base) || base === 0) return 0;
  return ((latest - base) / base) * 100;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(base, days) {
  const date = new Date(base.getTime());
  date.setDate(date.getDate() - days);
  return date;
}

function startDateForWindow(windowKey, now) {
  if (windowKey === "1W") return shiftDays(now, 7);
  if (windowKey === "1M") return shiftDays(now, 30);
  if (windowKey === "6M") return shiftDays(now, 182);
  if (windowKey === "YTD") return new Date(now.getFullYear(), 0, 1);
  return shiftDays(now, 1);
}

function hashSeed(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
}

function deterministicReturn(symbol, windowKey) {
  const seed = Number.parseInt(hashSeed(`${symbol}|${windowKey}`), 16);
  const spans = {
    "1D": 4,
    "1W": 9,
    "1M": 16,
    "6M": 28,
    YTD: 34,
  };
  const span = spans[windowKey] || 6;
  const normalized = ((seed % 20001) - 10000) / 10000;
  return Number.parseFloat((normalized * span).toFixed(2));
}

function mockReturnsByKey(instruments) {
  const view = mockMarket.buildView("all");
  const bySymbol = new Map(view.stocks.map((stock) => [instrumentKey(stock.exchange, stock.symbol), stock.returns]));

  const output = {};
  instruments.forEach((item) => {
    const key = instrumentKey(item.exchange, item.symbol);
    const base = bySymbol.get(key);
    output[key] = WINDOWS.reduce((acc, windowKey) => {
      acc[windowKey] = base ? toNumber(base[windowKey], 0) : deterministicReturn(key, windowKey);
      return acc;
    }, {});
  });
  return output;
}

function createDemoPortfolioRows() {
  const view = mockMarket.buildView("all");
  return view.stocks.slice(0, 16).map((stock, index) => ({
    tradingsymbol: stock.symbol,
    exchange: stock.exchange,
    quantity: (index % 4) + 3,
    average_price: Number.parseFloat((130 + (index + 1) * 37.5).toFixed(2)),
    instrument_token: 400000 + index,
    product: "CNC",
  }));
}

async function parseKiteResponse(response) {
  const payload = await response.json();
  if (!response.ok || payload.status === "error") {
    const message = payload?.message || `Kite request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function createKiteDirectProvider(options = {}) {
  const session = options.session || {};
  const fetchImpl = options.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const apiKey = options.apiKey || process.env.KITE_API_KEY || "";
  const accessToken = options.accessToken || session.accessToken || "";
  const connected = Boolean(fetchImpl && apiKey && accessToken);

  async function kiteGet(pathname, query = {}) {
    if (!connected) {
      throw new Error("Zerodha session not connected");
    }

    const search = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      search.append(key, String(value));
    });

    const url = `${KITE_API_BASE}${pathname}${search.toString() ? `?${search.toString()}` : ""}`;
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        "X-Kite-Version": "3",
        Authorization: `token ${apiKey}:${accessToken}`,
      },
    });

    return parseKiteResponse(response);
  }

  async function getHoldings() {
    if (!connected) {
      return createDemoPortfolioRows();
    }

    try {
      const payload = await kiteGet("/portfolio/holdings");
      return Array.isArray(payload.data) ? payload.data : [];
    } catch (_error) {
      return createDemoPortfolioRows();
    }
  }

  async function getPositions() {
    if (!connected) return [];

    try {
      const payload = await kiteGet("/portfolio/positions");
      const net = Array.isArray(payload?.data?.net) ? payload.data.net : [];
      return net;
    } catch (_error) {
      return [];
    }
  }

  async function getQuotes(instruments) {
    const list = Array.isArray(instruments) ? instruments : [];
    if (!list.length) return {};

    if (!connected) {
      const base = mockReturnsByKey(list);
      const output = {};
      list.forEach((item, index) => {
        const key = instrumentKey(item.exchange, item.symbol);
        const oneDay = toNumber(base[key]?.["1D"], 0);
        const average = 120 + index * 31;
        const previousClose = average * (1 - oneDay / 100);
        output[key] = {
          lastPrice: Number.parseFloat(average.toFixed(2)),
          previousClose: Number.parseFloat(previousClose.toFixed(2)),
        };
      });
      return output;
    }

    try {
      const search = new URLSearchParams();
      list.forEach((item) => {
        search.append("i", `${String(item.exchange || "NSE").toUpperCase()}:${String(item.symbol || "").toUpperCase()}`);
      });

      const response = await fetchImpl(`${KITE_API_BASE}/quote?${search.toString()}`, {
        method: "GET",
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
      });

      const payload = await parseKiteResponse(response);
      const data = payload.data || {};
      const output = {};

      list.forEach((item) => {
        const key = instrumentKey(item.exchange, item.symbol);
        const quoteKey = `${String(item.exchange || "NSE").toUpperCase()}:${String(item.symbol || "").toUpperCase()}`;
        const quote = data[quoteKey] || {};
        const previousClose = toNumber(quote?.ohlc?.close, toNumber(quote?.last_price, 0));
        output[key] = {
          lastPrice: toNumber(quote.last_price, previousClose),
          previousClose,
          instrumentToken: toNumber(quote.instrument_token, item.instrumentToken || 0),
        };
      });

      return output;
    } catch (_error) {
      return {};
    }
  }

  async function fetchHistoricalWindowReturn(token, windowKey, now) {
    const cacheKey = `${token}:${windowKey}`;
    const cached = historyCache.get(cacheKey);
    if (cached && now.getTime() - cached.updatedAtMs <= HISTORY_TTL_MS) {
      return cached.value;
    }

    const from = startDateForWindow(windowKey, now);
    const payload = await kiteGet(`/instruments/historical/${token}/day`, {
      from: `${formatDate(from)} 09:15:00`,
      to: `${formatDate(now)} 15:30:00`,
      continuous: 0,
      oi: 0,
    });

    const candles = Array.isArray(payload?.data?.candles) ? payload.data.candles : [];
    if (!candles.length) return null;

    const first = candles[0];
    const last = candles[candles.length - 1];
    const startClose = toNumber(first?.[4], 0);
    const endClose = toNumber(last?.[4], startClose);
    if (!startClose) return null;

    const value = Number.parseFloat(clamp(pctChange(endClose, startClose), -95, 220).toFixed(2));
    historyCache.set(cacheKey, { value, updatedAtMs: now.getTime() });
    return value;
  }

  async function getHistoricalReturns(instruments, windows) {
    const list = Array.isArray(instruments) ? instruments : [];
    const targetWindows = Array.isArray(windows) && windows.length ? windows : WINDOWS;
    if (!list.length) return {};

    const output = mockReturnsByKey(list);
    if (!connected) {
      return output;
    }

    const now = new Date();

    for (const item of list) {
      const key = instrumentKey(item.exchange, item.symbol);
      if (!output[key]) {
        output[key] = WINDOWS.reduce((acc, windowKey) => {
          acc[windowKey] = deterministicReturn(key, windowKey);
          return acc;
        }, {});
      }

      if (!item.instrumentToken) continue;

      for (const windowKey of targetWindows) {
        if (windowKey === "1D") continue;
        try {
          const value = await fetchHistoricalWindowReturn(item.instrumentToken, windowKey, now);
          if (Number.isFinite(value)) output[key][windowKey] = value;
        } catch (_error) {
          // Keep fallback value if historical fetch fails.
        }
      }
    }

    return output;
  }

  async function getCashBalance() {
    if (!connected) {
      return 250000;
    }

    try {
      const payload = await kiteGet("/user/margins/equity");
      const available = payload?.data?.available || {};
      return toNumber(available.live_balance ?? available.cash ?? available.opening_balance, 0);
    } catch (_error) {
      return 0;
    }
  }

  return {
    name: "kite-direct",
    mode: connected ? "live" : "demo",
    async getHoldings() {
      return getHoldings();
    },
    async getPositions() {
      return getPositions();
    },
    async getQuotes(instruments) {
      return getQuotes(instruments);
    },
    async getHistoricalReturns(instruments, windows) {
      return getHistoricalReturns(instruments, windows);
    },
    async getCashBalance() {
      return getCashBalance();
    },
    meta() {
      return {
        provider: "kite-direct",
        mode: connected ? "live" : "demo",
        connected,
      };
    },
  };
}

module.exports = {
  createKiteDirectProvider,
};
