(function initAdapterCore(globalScope, factory) {
  const core = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }

  if (globalScope) {
    globalScope.PortfolioAdapterCore = core;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildAdapterCore() {
  const WINDOWS = ["1D", "1W", "1M", "6M", "YTD"];
  const COMPARE_WINDOWS = ["1D", "5D", "1M", "6M", "YTD"];
  const EXCHANGES = ["NSE", "BSE"];
  const PORTFOLIO_ACTIONS = ["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"];

  class DataValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "DataValidationError";
    }
  }

  class DataAdapterError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.name = "DataAdapterError";
      this.statusCode = statusCode;
    }
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function requireObject(value, path) {
    if (!isObject(value)) {
      throw new DataValidationError(`${path} must be an object`);
    }
    return value;
  }

  function requireArray(value, path) {
    if (!Array.isArray(value)) {
      throw new DataValidationError(`${path} must be an array`);
    }
    return value;
  }

  function requireString(value, path) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new DataValidationError(`${path} must be a non-empty string`);
    }
    return value;
  }

  function requireNumber(value, path) {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new DataValidationError(`${path} must be a finite number`);
    }
    return value;
  }

  function requireBoolean(value, path) {
    if (typeof value !== "boolean") {
      throw new DataValidationError(`${path} must be a boolean`);
    }
    return value;
  }

  function normalizeExchange(value, path) {
    const normalized = requireString(value, path).toUpperCase();
    if (!EXCHANGES.includes(normalized)) {
      throw new DataValidationError(`${path} must be one of NSE/BSE`);
    }
    return normalized;
  }

  function normalizeReturns(value, path) {
    const record = requireObject(value, path);
    const output = {};

    WINDOWS.forEach((windowKey) => {
      output[windowKey] = requireNumber(record[windowKey], `${path}.${windowKey}`);
    });

    return output;
  }

  function normalizeHead(value, path) {
    const record = requireObject(value, path);
    return {
      id: requireString(record.id, `${path}.id`),
      name: requireString(record.name, `${path}.name`),
      momentum: normalizeReturns(record.momentum, `${path}.momentum`),
      clusterIds: requireArray(record.clusterIds, `${path}.clusterIds`).map((clusterId, index) =>
        requireString(clusterId, `${path}.clusterIds[${index}]`),
      ),
    };
  }

  function normalizeCluster(value, path) {
    const record = requireObject(value, path);
    return {
      id: requireString(record.id, `${path}.id`),
      headId: requireString(record.headId, `${path}.headId`),
      headName: requireString(record.headName, `${path}.headName`),
      name: requireString(record.name, `${path}.name`),
      momentum: normalizeReturns(record.momentum, `${path}.momentum`),
    };
  }

  function normalizeStock(value, path) {
    const record = requireObject(value, path);
    return {
      id: requireString(record.id, `${path}.id`),
      symbol: requireString(record.symbol, `${path}.symbol`),
      exchange: normalizeExchange(record.exchange, `${path}.exchange`),
      name: requireString(record.name, `${path}.name`),
      clusterId: requireString(record.clusterId, `${path}.clusterId`),
      returns: normalizeReturns(record.returns, `${path}.returns`),
    };
  }

  function normalizeBootstrapPayload(payload) {
    const record = requireObject(payload, "bootstrap");

    return {
      asOf: requireString(record.asOf, "bootstrap.asOf"),
      cursor: requireString(record.cursor, "bootstrap.cursor"),
      heads: requireArray(record.heads, "bootstrap.heads").map((head, index) =>
        normalizeHead(head, `bootstrap.heads[${index}]`),
      ),
      clusters: requireArray(record.clusters, "bootstrap.clusters").map((cluster, index) =>
        normalizeCluster(cluster, `bootstrap.clusters[${index}]`),
      ),
      stocks: requireArray(record.stocks, "bootstrap.stocks").map((stock, index) =>
        normalizeStock(stock, `bootstrap.stocks[${index}]`),
      ),
    };
  }

  function normalizePollPayload(payload) {
    const record = requireObject(payload, "poll");
    const updates = requireObject(record.updates || {}, "poll.updates");

    return {
      asOf: requireString(record.asOf, "poll.asOf"),
      cursor: requireString(record.cursor, "poll.cursor"),
      updates: {
        stocks: requireArray(updates.stocks || [], "poll.updates.stocks").map((stock, index) =>
          normalizeStock(stock, `poll.updates.stocks[${index}]`),
        ),
        clusters: requireArray(updates.clusters || [], "poll.updates.clusters").map((cluster, index) =>
          normalizeCluster(cluster, `poll.updates.clusters[${index}]`),
        ),
        heads: requireArray(updates.heads || [], "poll.updates.heads").map((head, index) =>
          normalizeHead(head, `poll.updates.heads[${index}]`),
        ),
      },
    };
  }

  function normalizeSeriesPoint(value, path) {
    const record = requireObject(value, path);
    return {
      ts: requireString(record.ts, `${path}.ts`),
      value: requireNumber(record.value, `${path}.value`),
    };
  }

  function normalizeComparisonPayload(payload) {
    const record = requireObject(payload, "comparison");
    const normalizedWindow = requireString(record.window, "comparison.window");
    if (!COMPARE_WINDOWS.includes(normalizedWindow)) {
      throw new DataValidationError("comparison.window must be one of 1D/5D/1M/6M/YTD");
    }

    const normalizedExchange = requireString(record.exchange, "comparison.exchange").toLowerCase();
    if (!["all", "nse", "bse"].includes(normalizedExchange)) {
      throw new DataValidationError("comparison.exchange must be one of all/nse/bse");
    }

    const seriesByClusterId = requireObject(record.seriesByClusterId, "comparison.seriesByClusterId");
    const normalizedSeries = {};
    Object.keys(seriesByClusterId).forEach((clusterId) => {
      normalizedSeries[clusterId] = requireArray(
        seriesByClusterId[clusterId],
        `comparison.seriesByClusterId.${clusterId}`,
      ).map((point, index) => normalizeSeriesPoint(point, `comparison.seriesByClusterId.${clusterId}[${index}]`));
    });

    return {
      asOf: requireString(record.asOf, "comparison.asOf"),
      window: normalizedWindow,
      exchange: normalizedExchange,
      seriesByClusterId: normalizedSeries,
    };
  }

  function normalizeDecision(value, path) {
    const record = requireObject(value, path);
    const action = requireString(record.action, `${path}.action`).toUpperCase();
    if (!PORTFOLIO_ACTIONS.includes(action)) {
      throw new DataValidationError(`${path}.action must be one of ${PORTFOLIO_ACTIONS.join("/")}`);
    }

    return {
      symbol: requireString(record.symbol, `${path}.symbol`).toUpperCase(),
      exchange: normalizeExchange(record.exchange, `${path}.exchange`),
      action,
      confidence: requireNumber(record.confidence, `${path}.confidence`),
      score: requireNumber(record.score, `${path}.score`),
      reasons: requireArray(record.reasons || [], `${path}.reasons`).map((reason, index) =>
        requireString(reason, `${path}.reasons[${index}]`),
      ),
      riskFlags: requireArray(record.riskFlags || [], `${path}.riskFlags`).map((flag, index) =>
        requireString(flag, `${path}.riskFlags[${index}]`),
      ),
      asOf: requireString(record.asOf, `${path}.asOf`),
    };
  }

  function normalizePortfolioSummary(value, path) {
    const record = requireObject(value, path);
    return {
      totalSymbols: requireNumber(record.totalSymbols, `${path}.totalSymbols`),
      totalInvested: requireNumber(record.totalInvested, `${path}.totalInvested`),
      totalCurrent: requireNumber(record.totalCurrent, `${path}.totalCurrent`),
      totalPnl: requireNumber(record.totalPnl, `${path}.totalPnl`),
      totalPnlPct: requireNumber(record.totalPnlPct, `${path}.totalPnlPct`),
      gainers: requireNumber(record.gainers, `${path}.gainers`),
      losers: requireNumber(record.losers, `${path}.losers`),
      cashAvailable: requireNumber(record.cashAvailable, `${path}.cashAvailable`),
    };
  }

  function normalizePortfolioRow(value, path) {
    const record = requireObject(value, path);
    return {
      key: requireString(record.key || `${record.exchange || ""}:${record.symbol || ""}`, `${path}.key`),
      symbol: requireString(record.symbol, `${path}.symbol`).toUpperCase(),
      exchange: normalizeExchange(record.exchange, `${path}.exchange`),
      quantity: requireNumber(record.quantity, `${path}.quantity`),
      averagePrice: requireNumber(record.averagePrice, `${path}.averagePrice`),
      lastPrice: requireNumber(record.lastPrice, `${path}.lastPrice`),
      investedValue: requireNumber(record.investedValue, `${path}.investedValue`),
      currentValue: requireNumber(record.currentValue, `${path}.currentValue`),
      unrealizedPnl: requireNumber(record.unrealizedPnl, `${path}.unrealizedPnl`),
      unrealizedPnlPct: requireNumber(record.unrealizedPnlPct, `${path}.unrealizedPnlPct`),
      weightPct: requireNumber(record.weightPct, `${path}.weightPct`),
      returns: normalizeReturns(record.returns, `${path}.returns`),
      product: requireString(record.product || "CNC", `${path}.product`),
      sourceTypes: requireArray(record.sourceTypes || [], `${path}.sourceTypes`).map((sourceType, index) =>
        requireString(sourceType, `${path}.sourceTypes[${index}]`),
      ),
      decision: normalizeDecision(record.decision, `${path}.decision`),
    };
  }

  function normalizePortfolioBootstrapPayload(payload) {
    const record = requireObject(payload, "portfolio.bootstrap");
    const overlayRaw = record.angelOverlayActive;
    const overlayEnabled = overlayRaw === undefined ? false : requireBoolean(overlayRaw, "portfolio.bootstrap.angelOverlayActive");

    return {
      asOf: requireString(record.asOf, "portfolio.bootstrap.asOf"),
      cursor: requireString(record.cursor, "portfolio.bootstrap.cursor"),
      rows: requireArray(record.rows, "portfolio.bootstrap.rows").map((row, index) =>
        normalizePortfolioRow(row, `portfolio.bootstrap.rows[${index}]`),
      ),
      summary: normalizePortfolioSummary(record.summary, "portfolio.bootstrap.summary"),
      decisions: requireArray(record.decisions || [], "portfolio.bootstrap.decisions").map((decision, index) =>
        normalizeDecision(decision, `portfolio.bootstrap.decisions[${index}]`),
      ),
      connected: requireBoolean(record.connected, "portfolio.bootstrap.connected"),
      provider: requireString(record.provider, "portfolio.bootstrap.provider"),
      providerMode: requireString(record.providerMode, "portfolio.bootstrap.providerMode"),
      marketDataProvider: requireString(record.marketDataProvider || record.provider, "portfolio.bootstrap.marketDataProvider"),
      angelOverlayActive: overlayEnabled,
      user: isObject(record.user)
        ? {
            userId: record.user.userId ? requireString(record.user.userId, "portfolio.bootstrap.user.userId") : null,
            userName: record.user.userName ? requireString(record.user.userName, "portfolio.bootstrap.user.userName") : null,
          }
        : { userId: null, userName: null },
    };
  }

  function normalizePortfolioPollPayload(payload) {
    const record = requireObject(payload, "portfolio.poll");
    const updates = requireObject(record.updates || {}, "portfolio.poll.updates");
    const overlayRaw = record.angelOverlayActive;
    const overlayEnabled = overlayRaw === undefined ? false : requireBoolean(overlayRaw, "portfolio.poll.angelOverlayActive");

    return {
      asOf: requireString(record.asOf, "portfolio.poll.asOf"),
      cursor: requireString(record.cursor, "portfolio.poll.cursor"),
      updates: {
        rows: requireArray(updates.rows || [], "portfolio.poll.updates.rows").map((row, index) =>
          normalizePortfolioRow(row, `portfolio.poll.updates.rows[${index}]`),
        ),
        decisions: requireArray(updates.decisions || [], "portfolio.poll.updates.decisions").map((decision, index) =>
          normalizeDecision(decision, `portfolio.poll.updates.decisions[${index}]`),
        ),
        summary: updates.summary ? normalizePortfolioSummary(updates.summary, "portfolio.poll.updates.summary") : null,
      },
      connected: requireBoolean(record.connected, "portfolio.poll.connected"),
      provider: requireString(record.provider, "portfolio.poll.provider"),
      providerMode: requireString(record.providerMode, "portfolio.poll.providerMode"),
      marketDataProvider: requireString(record.marketDataProvider || record.provider, "portfolio.poll.marketDataProvider"),
      angelOverlayActive: overlayEnabled,
    };
  }

  function normalizePortfolioDecisionsPayload(payload) {
    const record = requireObject(payload, "portfolio.decisions");
    return {
      asOf: requireString(record.asOf, "portfolio.decisions.asOf"),
      decisions: requireArray(record.decisions || [], "portfolio.decisions.decisions").map((decision, index) =>
        normalizeDecision(decision, `portfolio.decisions.decisions[${index}]`),
      ),
    };
  }

  function normalizeMacroCluster(value, path) {
    const record = requireObject(value, path);
    return {
      cluster_id: requireString(record.cluster_id, `${path}.cluster_id`),
      cluster_name: requireString(record.cluster_name, `${path}.cluster_name`),
      head_name: requireString(record.head_name, `${path}.head_name`),
      impact_score: requireNumber(record.impact_score, `${path}.impact_score`),
    };
  }

  function normalizeMacroContextPayload(payload) {
    const record = requireObject(payload, "macro.context");
    return {
      asOf: requireString(record.asOf, "macro.context.asOf"),
      exchange: requireString(record.exchange || "all", "macro.context.exchange").toLowerCase(),
      symbol: record.symbol ? requireString(record.symbol, "macro.context.symbol").toUpperCase() : null,
      theme_hint: record.theme_hint ? requireString(record.theme_hint, "macro.context.theme_hint") : null,
      sentiment_score: requireNumber(record.sentiment_score, "macro.context.sentiment_score"),
      key_catalyst: requireString(record.key_catalyst, "macro.context.key_catalyst"),
      impacted_clusters: requireArray(record.impacted_clusters || [], "macro.context.impacted_clusters").map((cluster, index) =>
        normalizeMacroCluster(cluster, `macro.context.impacted_clusters[${index}]`),
      ),
      rationale_summary: requireString(record.rationale_summary, "macro.context.rationale_summary"),
      considered_events: requireNumber(record.considered_events || 0, "macro.context.considered_events"),
      processed_count: requireNumber(record.processed_count || 0, "macro.context.processed_count"),
      sources: requireArray(record.sources || [], "macro.context.sources").map((source, index) =>
        requireString(source, `macro.context.sources[${index}]`),
      ),
      source_events: requireArray(record.source_events || [], "macro.context.source_events").map((item, index) => {
        const itemPath = `macro.context.source_events[${index}]`;
        const sourceRecord = requireObject(item, itemPath);
        return {
          id: requireNumber(sourceRecord.id, `${itemPath}.id`),
          source_type: requireString(sourceRecord.source_type, `${itemPath}.source_type`),
          title: requireString(sourceRecord.title, `${itemPath}.title`),
          url: requireString(sourceRecord.url, `${itemPath}.url`),
          published_date: sourceRecord.published_date ? requireString(sourceRecord.published_date, `${itemPath}.published_date`) : "",
          priority_tags: requireArray(sourceRecord.priority_tags || [], `${itemPath}.priority_tags`).map((tag, tagIndex) =>
            requireString(tag, `${itemPath}.priority_tags[${tagIndex}]`),
          ),
          sentiment: requireNumber(sourceRecord.sentiment || 0, `${itemPath}.sentiment`),
          relevance_score: requireNumber(sourceRecord.relevance_score || 0, `${itemPath}.relevance_score`),
          impact_score: requireNumber(sourceRecord.impact_score || 0, `${itemPath}.impact_score`),
        };
      }),
      model: record.model ? requireString(record.model, "macro.context.model") : "unknown",
    };
  }

  function getIstParts(date) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const pick = (type) => parts.find((item) => item.type === type)?.value;
    const weekday = pick("weekday");
    const hour = Number.parseInt(pick("hour") || "0", 10);
    const minute = Number.parseInt(pick("minute") || "0", 10);

    return { weekday, hour, minute };
  }

  function isMarketHoursIst(date) {
    const { weekday, hour, minute } = getIstParts(date);
    if (!weekday || weekday === "Sat" || weekday === "Sun") return false;

    const minuteOfDay = hour * 60 + minute;
    const marketOpen = 9 * 60 + 15;
    const marketClose = 15 * 60 + 30;

    return minuteOfDay >= marketOpen && minuteOfDay <= marketClose;
  }

  function getAdaptivePollIntervalMs(options) {
    const params = options || {};
    const date = params.date || new Date();
    const hidden = Boolean(params.hidden);
    const base = isMarketHoursIst(date) ? 5000 : 60000;
    return hidden ? base * 2 : base;
  }

  function nextBackoffMs(failureCount, options) {
    const params = options || {};
    const baseMs = Number.isFinite(params.baseMs) ? params.baseMs : 5000;
    const maxMs = Number.isFinite(params.maxMs) ? params.maxMs : 60000;
    const normalizedFailures = Math.max(1, Math.floor(failureCount));
    const next = baseMs * Math.pow(2, normalizedFailures - 1);
    return Math.min(next, maxMs);
  }

  function shouldMarkStale(options) {
    const params = options || {};
    const consecutiveFailures = Number.isFinite(params.consecutiveFailures) ? params.consecutiveFailures : 0;
    const lastSuccessAtMs = Number.isFinite(params.lastSuccessAtMs) ? params.lastSuccessAtMs : 0;
    const nowMs = Number.isFinite(params.nowMs) ? params.nowMs : Date.now();
    const marketHours = Boolean(params.marketHours);

    if (consecutiveFailures >= 2) return true;
    if (marketHours && lastSuccessAtMs > 0 && nowMs - lastSuccessAtMs > 20000) return true;
    return false;
  }

  function mapComparisonSeries(payload) {
    const normalized = normalizeComparisonPayload(payload);
    const result = new Map();

    Object.keys(normalized.seriesByClusterId).forEach((clusterId) => {
      const points = normalized.seriesByClusterId[clusterId].map((point, index) => ({
        x: index,
        y: point.value,
        ts: point.ts,
      }));
      result.set(clusterId, points);
    });

    return result;
  }

  function mergeMarketState(currentState, pollPayload) {
    const stateRecord = requireObject(currentState, "state");
    const normalizedPoll = normalizePollPayload(pollPayload);

    const stockMap = new Map(
      requireArray(stateRecord.stocks || [], "state.stocks").map((stock) => {
        const normalized = normalizeStock(stock, `state.stocks.${stock.id || "unknown"}`);
        return [normalized.id, normalized];
      }),
    );

    const clusterMap = new Map(
      requireArray(stateRecord.clusters || [], "state.clusters").map((cluster) => {
        const normalized = normalizeCluster(cluster, `state.clusters.${cluster.id || "unknown"}`);
        return [normalized.id, normalized];
      }),
    );

    const headMap = new Map(
      requireArray(stateRecord.heads || [], "state.heads").map((head) => {
        const normalized = normalizeHead(head, `state.heads.${head.id || "unknown"}`);
        return [normalized.id, normalized];
      }),
    );

    normalizedPoll.updates.stocks.forEach((stock) => stockMap.set(stock.id, stock));
    normalizedPoll.updates.clusters.forEach((cluster) => clusterMap.set(cluster.id, cluster));
    normalizedPoll.updates.heads.forEach((head) => headMap.set(head.id, head));

    return {
      asOf: normalizedPoll.asOf,
      cursor: normalizedPoll.cursor,
      heads: [...headMap.values()],
      clusters: [...clusterMap.values()],
      stocks: [...stockMap.values()],
    };
  }

  function mergePortfolioState(currentState, pollPayload) {
    const stateRecord = requireObject(currentState, "portfolio.state");
    const normalizedPoll = normalizePortfolioPollPayload(pollPayload);
    const rowMap = new Map(
      requireArray(stateRecord.rows || [], "portfolio.state.rows").map((row) => {
        const normalized = normalizePortfolioRow(row, `portfolio.state.rows.${row.key || "unknown"}`);
        return [normalized.key, normalized];
      }),
    );

    normalizedPoll.updates.rows.forEach((row) => {
      rowMap.set(row.key, row);
    });

    const decisionMap = new Map();
    normalizedPoll.updates.decisions.forEach((decision) => {
      const key = `${decision.exchange}:${decision.symbol}`;
      decisionMap.set(key, decision);
    });

    const rows = [...rowMap.values()]
      .map((row) => {
        const key = `${row.exchange}:${row.symbol}`;
        if (!decisionMap.has(key)) return row;
        return {
          ...row,
          decision: decisionMap.get(key),
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);

    return {
      asOf: normalizedPoll.asOf,
      cursor: normalizedPoll.cursor,
      rows,
      decisions: rows.map((row) => row.decision),
      summary: normalizedPoll.updates.summary || normalizePortfolioSummary(stateRecord.summary, "portfolio.state.summary"),
      connected: normalizedPoll.connected,
      provider: normalizedPoll.provider,
      providerMode: normalizedPoll.providerMode,
      marketDataProvider: normalizedPoll.marketDataProvider || stateRecord.marketDataProvider || normalizedPoll.provider,
      angelOverlayActive: Boolean(normalizedPoll.angelOverlayActive),
      user: stateRecord.user || { userId: null, userName: null },
    };
  }

  function toQueryString(params) {
    const search = new URLSearchParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === "") return;
      search.set(key, String(value));
    });
    return search.toString();
  }

  function createBackendAdapter(config) {
    const options = config || {};
    const apiBaseUrl = (options.apiBaseUrl || "/api/v1").replace(/\/$/, "");
    const authToken = options.authToken || "";
    const fetchImpl = options.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);

    if (!fetchImpl) {
      throw new DataAdapterError("Fetch API is not available in this runtime");
    }

    if (!authToken || !authToken.trim()) {
      throw new DataAdapterError("Missing auth token for backend adapter");
    }

    async function request(pathname, query, options = {}) {
      const queryString = toQueryString(query);
      const url = `${apiBaseUrl}${pathname}${queryString ? `?${queryString}` : ""}`;

      const method = options.method || "GET";
      const response = await fetchImpl(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${authToken}`,
          ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });

      if (!response.ok) {
        throw new DataAdapterError(`Backend request failed: ${response.status}`, response.status);
      }

      return response.json();
    }

    return {
      mode: "backend",
      async bootstrap(params) {
        const payload = await request("/market/bootstrap", {
          exchange: params?.exchange || "all",
          window: params?.window || "1M",
          include: "taxonomy,stocks,momentum",
        });
        return normalizeBootstrapPayload(payload);
      },
      async poll(params) {
        const payload = await request("/market/poll", {
          cursor: params?.cursor || "",
          exchange: params?.exchange || "all",
        });
        return normalizePollPayload(payload);
      },
      async fetchComparisonSeries(params) {
        const payload = await request("/comparison/series", {
          clusterIds: (params?.clusterIds || []).join(","),
          window: params?.window || "1M",
          exchange: params?.exchange || "all",
          points: params?.points || 40,
        });
        return normalizeComparisonPayload(payload);
      },
      async fetchPortfolioBootstrap(params) {
        const payload = await request("/portfolio/bootstrap", {
          exchange: params?.exchange || "all",
          refresh: params?.refresh ? "true" : "",
        });
        return normalizePortfolioBootstrapPayload(payload);
      },
      async pollPortfolio(params) {
        const payload = await request("/portfolio/poll", {
          cursor: params?.cursor || "",
          exchange: params?.exchange || "all",
        });
        return normalizePortfolioPollPayload(payload);
      },
      async fetchPortfolioDecisions(params) {
        const payload = await request("/portfolio/decisions", {
          exchange: params?.exchange || "all",
          asOf: params?.asOf || "",
        });
        return normalizePortfolioDecisionsPayload(payload);
      },
      async createPortfolioEodSnapshot(params) {
        return request("/portfolio/snapshots/eod", {}, {
          method: "POST",
          body: {
            snapshotDate: params?.snapshotDate || "",
          },
        });
      },
      async previewOrder(payload) {
        return request("/orders/preview", {}, { method: "POST", body: payload || {} });
      },
      async submitOrder(payload) {
        return request("/orders/submit", {}, { method: "POST", body: payload || {} });
      },
      async fetchOrderStatus(params) {
        const orderId = requireString(params?.id || "", "order.id");
        return request(`/orders/${encodeURIComponent(orderId)}/status`, {});
      },
      async fetchMacroContext(params) {
        const payload = await request("/macro/context", {
          symbol: params?.symbol || "",
          theme: params?.theme || "",
          exchange: params?.exchange || "all",
          limit: params?.limit || 30,
          includeProcessed: params?.includeProcessed ? "true" : "",
        });
        return normalizeMacroContextPayload(payload);
      },
    };
  }

  return {
    WINDOWS,
    COMPARE_WINDOWS,
    EXCHANGES,
    DataValidationError,
    DataAdapterError,
    normalizeBootstrapPayload,
    normalizePollPayload,
    normalizeComparisonPayload,
    normalizePortfolioBootstrapPayload,
    normalizePortfolioPollPayload,
    normalizePortfolioDecisionsPayload,
    normalizeMacroContextPayload,
    mapComparisonSeries,
    mergeMarketState,
    mergePortfolioState,
    isMarketHoursIst,
    getAdaptivePollIntervalMs,
    nextBackoffMs,
    shouldMarkStale,
    createBackendAdapter,
  };
});
