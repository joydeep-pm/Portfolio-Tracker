const crypto = require("node:crypto");

const mockMarket = require("../mockMarket");
const { instrumentKey } = require("../portfolioAssembler");
const { ANGEL_ROOT, buildHeaders } = require("../angelSmartApi");

const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];
const KITE_API_BASE = "https://api.kite.trade";
const HISTORY_TTL_MS = 10 * 60 * 1000;
const ANGEL_SYMBOL_TTL_MS = 60 * 60 * 1000;
const ANGEL_CANDLE_INTERVAL = "ONE_DAY";

const historyCache = new Map();
const angelSymbolCache = new Map();

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

function formatAngelDateTime(date, time = "09:15") {
  return `${formatDate(date)} ${time}`;
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

function toBool(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "1" || key === "true" || key === "yes" || key === "y";
}

function mapAngelExchange(exchange) {
  const value = String(exchange || "NSE").toUpperCase();
  if (value === "BSE") return "BSE";
  return "NSE";
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
  const angelSession = session.angel || {};
  const angelApiKey = options.angelApiKey || process.env.ANGEL_API_KEY || "";
  const angelHistoricalApiKey = options.angelHistoricalApiKey || process.env.ANGEL_HISTORICAL_API_KEY || angelApiKey;
  const overlaySetting = options.enableAngelMarketData ?? process.env.ENABLE_ANGEL_MARKET_DATA;
  const angelOverlayEnabled =
    overlaySetting === undefined || overlaySetting === null || String(overlaySetting).trim() === ""
      ? true
      : toBool(overlaySetting);
  const angelConnected = Boolean(
    fetchImpl &&
      angelOverlayEnabled &&
      angelApiKey &&
      angelSession.connected &&
      angelSession.accessToken &&
      angelSession.clientCode,
  );
  const angelHistoricalConnected = Boolean(
    fetchImpl &&
      angelOverlayEnabled &&
      angelHistoricalApiKey &&
      angelSession.connected &&
      angelSession.accessToken &&
      angelSession.clientCode,
  );

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

  async function angelRequest(pathname, method = "GET", body = null) {
    if (!angelConnected) {
      throw new Error("Angel market overlay is not connected");
    }

    const methodKey = String(method || "GET").toUpperCase();
    const query = methodKey === "GET" && body && typeof body === "object" ? `?${new URLSearchParams(body).toString()}` : "";
    const response = await fetchImpl(`${ANGEL_ROOT}${pathname}${query}`, {
      method: methodKey,
      headers: buildHeaders(angelApiKey, angelSession.accessToken),
      body: methodKey === "GET" ? undefined : body ? JSON.stringify(body) : undefined,
    });

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      payload = {
        status: false,
        message: "angel-non-json-response",
      };
    }

    if (!response.ok || payload?.status === false) {
      throw new Error(payload?.message || `Angel request failed (${response.status})`);
    }

    return payload;
  }

  async function angelHistoricalRequest(pathname, method = "GET", body = null) {
    if (!angelHistoricalConnected) {
      throw new Error("Angel historical overlay is not connected");
    }

    const methodKey = String(method || "GET").toUpperCase();
    const query = methodKey === "GET" && body && typeof body === "object" ? `?${new URLSearchParams(body).toString()}` : "";
    const response = await fetchImpl(`${ANGEL_ROOT}${pathname}${query}`, {
      method: methodKey,
      headers: buildHeaders(angelHistoricalApiKey, angelSession.accessToken),
      body: methodKey === "GET" ? undefined : body ? JSON.stringify(body) : undefined,
    });

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      payload = {
        status: false,
        message: "angel-historical-non-json-response",
      };
    }

    if (!response.ok || payload?.status === false) {
      throw new Error(payload?.message || `Angel historical request failed (${response.status})`);
    }

    return payload;
  }

  function candleClose(row) {
    if (Array.isArray(row)) {
      return toNumber(row?.[4], 0);
    }
    if (row && typeof row === "object") {
      return toNumber(row.close, 0);
    }
    return 0;
  }

  async function resolveAngelSymbolToken(item) {
    const key = instrumentKey(item.exchange, item.symbol);
    const cached = angelSymbolCache.get(key);
    if (cached && Date.now() - cached.updatedAtMs <= ANGEL_SYMBOL_TTL_MS) {
      return cached.token;
    }

    try {
      const payload = await angelRequest("/rest/secure/angelbroking/order/v1/searchScrip", "POST", {
        exchange: mapAngelExchange(item.exchange),
        searchscrip: String(item.symbol || "").toUpperCase(),
      });
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const exact = rows.find((row) => String(row.tradingsymbol || "").toUpperCase() === String(item.symbol || "").toUpperCase());
      const best = exact || rows[0] || null;
      const token = best ? String(best.symboltoken || "").trim() : "";
      if (!token) return "";
      angelSymbolCache.set(key, {
        token,
        updatedAtMs: Date.now(),
      });
      return token;
    } catch (_error) {
      return "";
    }
  }

  async function fetchAngelQuote(item) {
    try {
      const symbolToken = await resolveAngelSymbolToken(item);
      if (!symbolToken) return null;
      const payload = await angelRequest("/rest/secure/angelbroking/order/v1/getLtpData", "POST", {
        exchange: mapAngelExchange(item.exchange),
        tradingsymbol: String(item.symbol || "").toUpperCase(),
        symboltoken: symbolToken,
      });

      const data = payload?.data || {};
      const ltp = toNumber(data.ltp, 0);
      const previousClose = toNumber(data.close ?? data.prevclose ?? data.previousclose, ltp);
      if (!ltp) return null;
      return {
        lastPrice: ltp,
        previousClose,
      };
    } catch (_error) {
      return null;
    }
  }

  async function getHoldings() {
    if (!connected) {
      return createDemoPortfolioRows();
    }

    const payload = await kiteGet("/portfolio/holdings");
    return Array.isArray(payload.data) ? payload.data : [];
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

    const output = {};

    if (angelConnected) {
      await Promise.all(
        list.map(async (item) => {
          const key = instrumentKey(item.exchange, item.symbol);
          const quote = await fetchAngelQuote(item);
          if (!quote) return;
          output[key] = {
            ...quote,
            source: "angel",
          };
        }),
      );
    }

    const unresolved = list.filter((item) => {
      const key = instrumentKey(item.exchange, item.symbol);
      return !output[key];
    });

    if (!connected) {
      const base = mockReturnsByKey(list);
      unresolved.forEach((item, index) => {
        const key = instrumentKey(item.exchange, item.symbol);
        const oneDay = toNumber(base[key]?.["1D"], 0);
        const average = 120 + index * 31;
        const previousClose = average * (1 - oneDay / 100);
        output[key] = {
          lastPrice: Number.parseFloat(average.toFixed(2)),
          previousClose: Number.parseFloat(previousClose.toFixed(2)),
          source: "demo",
        };
      });
      return output;
    }

    try {
      const search = new URLSearchParams();
      unresolved.forEach((item) => {
        search.append("i", `${String(item.exchange || "NSE").toUpperCase()}:${String(item.symbol || "").toUpperCase()}`);
      });

      if (!search.toString()) return output;

      const response = await fetchImpl(`${KITE_API_BASE}/quote?${search.toString()}`, {
        method: "GET",
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
      });

      const payload = await parseKiteResponse(response);
      const data = payload.data || {};

      unresolved.forEach((item) => {
        const key = instrumentKey(item.exchange, item.symbol);
        const quoteKey = `${String(item.exchange || "NSE").toUpperCase()}:${String(item.symbol || "").toUpperCase()}`;
        const quote = data[quoteKey] || {};
        const previousClose = toNumber(quote?.ohlc?.close, toNumber(quote?.last_price, 0));
        output[key] = {
          lastPrice: toNumber(quote.last_price, previousClose),
          previousClose,
          instrumentToken: toNumber(quote.instrument_token, item.instrumentToken || 0),
          source: "kite",
        };
      });

      return output;
    } catch (_error) {
      return output;
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

  async function fetchAngelHistoricalWindowReturn(item, windowKey, now) {
    const symbolToken = await resolveAngelSymbolToken(item);
    if (!symbolToken) return null;

    const cacheKey = `angel:${symbolToken}:${windowKey}`;
    const cached = historyCache.get(cacheKey);
    if (cached && now.getTime() - cached.updatedAtMs <= HISTORY_TTL_MS) {
      return cached.value;
    }

    const from = startDateForWindow(windowKey, now);
    const payload = await angelHistoricalRequest("/rest/secure/angelbroking/historical/v1/getCandleData", "POST", {
      exchange: mapAngelExchange(item.exchange),
      symboltoken: symbolToken,
      interval: ANGEL_CANDLE_INTERVAL,
      fromdate: formatAngelDateTime(from, "09:15"),
      todate: formatAngelDateTime(now, "15:30"),
    });

    const candles = Array.isArray(payload?.data) ? payload.data : [];
    if (!candles.length) return null;

    const first = candles[0];
    const last = candles[candles.length - 1];
    const startClose = candleClose(first);
    const endClose = candleClose(last) || startClose;
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
    const now = new Date();

    for (const item of list) {
      const key = instrumentKey(item.exchange, item.symbol);
      if (!output[key]) {
        output[key] = WINDOWS.reduce((acc, windowKey) => {
          acc[windowKey] = deterministicReturn(key, windowKey);
          return acc;
        }, {});
      }

      for (const windowKey of targetWindows) {
        if (windowKey === "1D") continue;
        let resolved = false;
        if (angelHistoricalConnected) {
          try {
            const value = await fetchAngelHistoricalWindowReturn(item, windowKey, now);
            if (Number.isFinite(value)) {
              output[key][windowKey] = value;
              resolved = true;
            }
          } catch (_error) {
            // Keep fallback value if Angel historical fetch fails.
          }
        }
        if (resolved) continue;
        if (!connected || !item.instrumentToken) continue;
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
        marketDataProvider: angelConnected ? "angel" : connected ? "kite" : "demo",
        angelOverlayActive: angelConnected,
        angelHistoricalActive: angelHistoricalConnected,
      };
    },
  };
}

module.exports = {
  createKiteDirectProvider,
};
