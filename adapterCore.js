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

  function normalizeChartReturnsPayload(payload) {
    const record = normalizeComparisonPayload(payload);
    return {
      ...record,
      source: requireString(payload.source || "unknown", "comparison.source"),
    };
  }

  function normalizeDecisionMarker(value, path) {
    const record = requireObject(value, path);
    const action = requireString(record.action, `${path}.action`).toUpperCase();
    if (!["BUY", "ACCUMULATE", "REDUCE", "SELL"].includes(action)) {
      throw new DataValidationError(`${path}.action must be one of BUY/ACCUMULATE/REDUCE/SELL`);
    }
    const shape = requireString(record.shape, `${path}.shape`);
    if (!["arrowUp", "arrowDown", "circle"].includes(shape)) {
      throw new DataValidationError(`${path}.shape must be one of arrowUp/arrowDown/circle`);
    }
    const position = requireString(record.position, `${path}.position`);
    if (!["aboveBar", "belowBar", "inBar"].includes(position)) {
      throw new DataValidationError(`${path}.position must be one of aboveBar/belowBar/inBar`);
    }
    return {
      time: requireNumber(record.time, `${path}.time`),
      action,
      confidence: requireNumber(record.confidence, `${path}.confidence`),
      text: requireString(record.text, `${path}.text`),
      color: requireString(record.color, `${path}.color`),
      shape,
      position,
      source: requireString(record.source || "unknown", `${path}.source`),
    };
  }

  function normalizeDecisionMarkersPayload(payload) {
    const record = requireObject(payload, "charts.markers");
    const markerExchange = record.exchange ? requireString(record.exchange, "charts.markers.exchange").toUpperCase() : null;
    if (markerExchange && !EXCHANGES.includes(markerExchange)) {
      throw new DataValidationError("charts.markers.exchange must be one of NSE/BSE");
    }

    const normalizedWindow = requireString(record.window || "1M", "charts.markers.window");
    if (!COMPARE_WINDOWS.includes(normalizedWindow)) {
      throw new DataValidationError("charts.markers.window must be one of 1D/5D/1M/6M/YTD");
    }

    return {
      asOf: requireString(record.asOf, "charts.markers.asOf"),
      symbol: record.symbol ? requireString(record.symbol, "charts.markers.symbol").toUpperCase() : null,
      exchange: markerExchange,
      clusterId: record.clusterId ? requireString(record.clusterId, "charts.markers.clusterId") : null,
      window: normalizedWindow,
      source: requireString(record.source || "unknown", "charts.markers.source"),
      fallbackUsed: typeof record.fallbackUsed === "boolean" ? record.fallbackUsed : false,
      markers: requireArray(record.markers || [], "charts.markers.markers").map((marker, index) =>
        normalizeDecisionMarker(marker, `charts.markers.markers[${index}]`),
      ),
    };
  }

  function normalizePeerStock(value, path) {
    const record = requireObject(value, path);
    const exchange = normalizeExchange(record.exchange, `${path}.exchange`);
    const returns = normalizeReturns(record.returns || makeZeroReturnsForPeer(), `${path}.returns`);
    return {
      symbol: requireString(record.symbol, `${path}.symbol`).toUpperCase(),
      exchange,
      name: requireString(record.name || record.symbol, `${path}.name`),
      returns,
      ...(record.competitorScore !== undefined
        ? { competitorScore: requireNumber(record.competitorScore, `${path}.competitorScore`) }
        : {}),
    };
  }

  function makeZeroReturnsForPeer() {
    return {
      "1D": 0,
      "1W": 0,
      "1M": 0,
      "6M": 0,
      YTD: 0,
    };
  }

  function normalizePeerRelativeStrengthPayload(payload) {
    const record = requireObject(payload, "peers.relativeStrength");
    const exchange = requireString(record.exchange || "all", "peers.relativeStrength.exchange").toLowerCase();
    if (!["all", "nse", "bse"].includes(exchange)) {
      throw new DataValidationError("peers.relativeStrength.exchange must be one of all/nse/bse");
    }
    const window = requireString(record.window || "1M", "peers.relativeStrength.window");
    if (!COMPARE_WINDOWS.includes(window)) {
      throw new DataValidationError("peers.relativeStrength.window must be one of 1D/5D/1M/6M/YTD");
    }
    const cluster = requireObject(record.cluster, "peers.relativeStrength.cluster");
    const seriesBySymbolRaw = requireObject(record.seriesBySymbol, "peers.relativeStrength.seriesBySymbol");
    const seriesBySymbol = {};
    Object.keys(seriesBySymbolRaw).forEach((symbol) => {
      seriesBySymbol[symbol] = requireArray(
        seriesBySymbolRaw[symbol],
        `peers.relativeStrength.seriesBySymbol.${symbol}`,
      ).map((point, index) => normalizeSeriesPoint(point, `peers.relativeStrength.seriesBySymbol.${symbol}[${index}]`));
    });

    return {
      asOf: requireString(record.asOf, "peers.relativeStrength.asOf"),
      exchange,
      window,
      source: requireString(record.source || "unknown", "peers.relativeStrength.source"),
      cluster: {
        id: requireString(cluster.id, "peers.relativeStrength.cluster.id"),
        name: requireString(cluster.name, "peers.relativeStrength.cluster.name"),
        headId: requireString(cluster.headId, "peers.relativeStrength.cluster.headId"),
        headName: requireString(cluster.headName, "peers.relativeStrength.cluster.headName"),
      },
      anchor: normalizePeerStock(record.anchor, "peers.relativeStrength.anchor"),
      peers: requireArray(record.peers || [], "peers.relativeStrength.peers").map((peer, index) =>
        normalizePeerStock(peer, `peers.relativeStrength.peers[${index}]`),
      ),
      seriesBySymbol,
    };
  }

  function normalizeOptimalAllocationPayload(payload) {
    const record = requireObject(payload, "quant.allocation");
    const weightsRaw = requireObject(record.weights, "quant.allocation.weights");
    const sharesRaw = requireObject(record.discrete_shares, "quant.allocation.discrete_shares");
    const perfRaw = requireObject(record.portfolio_performance, "quant.allocation.portfolio_performance");

    const weights = {};
    Object.keys(weightsRaw).forEach((ticker) => {
      const key = requireString(ticker, "quant.allocation.weights.key").toUpperCase();
      weights[key] = requireNumber(weightsRaw[ticker], `quant.allocation.weights.${ticker}`);
    });

    const discreteShares = {};
    Object.keys(sharesRaw).forEach((ticker) => {
      const key = requireString(ticker, "quant.allocation.discrete_shares.key").toUpperCase();
      const value = requireNumber(sharesRaw[ticker], `quant.allocation.discrete_shares.${ticker}`);
      discreteShares[key] = Math.max(0, Math.floor(value));
    });

    return {
      weights,
      discrete_shares: discreteShares,
      remaining_cash: requireNumber(record.remaining_cash, "quant.allocation.remaining_cash"),
      portfolio_performance: {
        expected_annual_return: requireNumber(
          perfRaw.expected_annual_return,
          "quant.allocation.portfolio_performance.expected_annual_return",
        ),
        annual_volatility: requireNumber(
          perfRaw.annual_volatility,
          "quant.allocation.portfolio_performance.annual_volatility",
        ),
        sharpe_ratio: requireNumber(perfRaw.sharpe_ratio, "quant.allocation.portfolio_performance.sharpe_ratio"),
      },
    };
  }

  function normalizeStrategyBacktestPayload(payload) {
    const record = requireObject(payload, "quant.backtest");
    const metrics = requireObject(record.metrics, "quant.backtest.metrics");
    const curve = requireArray(record.equity_curve || [], "quant.backtest.equity_curve");

    return {
      tickers: requireArray(record.tickers || [], "quant.backtest.tickers").map((ticker, index) =>
        requireString(ticker, `quant.backtest.tickers[${index}]`).toUpperCase(),
      ),
      lookback_years: requireNumber(record.lookback_years, "quant.backtest.lookback_years"),
      initial_capital: requireNumber(record.initial_capital, "quant.backtest.initial_capital"),
      metrics: {
        win_rate: requireNumber(metrics.win_rate, "quant.backtest.metrics.win_rate"),
        max_drawdown: requireNumber(metrics.max_drawdown, "quant.backtest.metrics.max_drawdown"),
        cagr: requireNumber(metrics.cagr, "quant.backtest.metrics.cagr"),
        sharpe_ratio: requireNumber(metrics.sharpe_ratio, "quant.backtest.metrics.sharpe_ratio"),
      },
      equity_curve: curve.map((point, index) => {
        const row = requireObject(point, `quant.backtest.equity_curve[${index}]`);
        return {
          timestamp: requireString(row.timestamp, `quant.backtest.equity_curve[${index}].timestamp`),
          value: requireNumber(row.value, `quant.backtest.equity_curve[${index}].value`),
        };
      }),
    };
  }

  function normalizeEarningsCitation(value, path) {
    const record = requireObject(value, path);
    return {
      rank: requireNumber(record.rank, `${path}.rank`),
      score: requireNumber(record.score, `${path}.score`),
      chunk_id: requireNumber(record.chunk_id, `${path}.chunk_id`),
      text: requireString(record.text, `${path}.text`),
    };
  }

  function normalizeEarningsChatPayload(payload) {
    const record = requireObject(payload, "research.earningsChat");
    return {
      symbol: requireString(record.symbol, "research.earningsChat.symbol").toUpperCase(),
      query: requireString(record.query, "research.earningsChat.query"),
      answer: requireString(record.answer, "research.earningsChat.answer"),
      model: requireString(record.model || "unknown", "research.earningsChat.model"),
      citations: requireArray(record.citations || [], "research.earningsChat.citations").map((citation, index) =>
        normalizeEarningsCitation(citation, `research.earningsChat.citations[${index}]`),
      ),
    };
  }

  function normalizeBasketLeg(value, path) {
    const record = requireObject(value, path);
    const action = requireString(record.action, `${path}.action`).toUpperCase();
    if (!["SELL", "BUY"].includes(action)) {
      throw new DataValidationError(`${path}.action must be BUY or SELL`);
    }
    return {
      symbol: requireString(record.symbol, `${path}.symbol`).toUpperCase(),
      action,
      allocation_pct: requireNumber(record.allocation_pct, `${path}.allocation_pct`),
    };
  }

  function normalizeNlpCommandPayload(payload) {
    const record = requireObject(payload, "commands.interpret");
    const intent = requireString(record.intent, "commands.interpret.intent").toLowerCase();
    if (intent !== "rotate") {
      throw new DataValidationError("commands.interpret.intent must be rotate");
    }
    const basket = requireObject(record.mock_basket, "commands.interpret.mock_basket");
    return {
      intent,
      source_entity: requireString(record.source_entity, "commands.interpret.source_entity"),
      target_entity: requireString(record.target_entity, "commands.interpret.target_entity"),
      capital_pct: requireNumber(record.capital_pct, "commands.interpret.capital_pct"),
      mock_basket: {
        sell: requireArray(basket.sell || [], "commands.interpret.mock_basket.sell").map((item, index) =>
          normalizeBasketLeg(item, `commands.interpret.mock_basket.sell[${index}]`),
        ),
        buy: requireArray(basket.buy || [], "commands.interpret.mock_basket.buy").map((item, index) =>
          normalizeBasketLeg(item, `commands.interpret.mock_basket.buy[${index}]`),
        ),
      },
    };
  }

  function normalizeTechnicalFlag(value, path) {
    const record = requireObject(value, path);
    const signal = requireString(record.signal, `${path}.signal`);
    if (!["Bullish", "Bearish", "Neutral"].includes(signal)) {
      throw new DataValidationError(`${path}.signal must be one of Bullish/Bearish/Neutral`);
    }
    return {
      symbol: requireString(record.symbol, `${path}.symbol`).toUpperCase(),
      pattern: requireString(record.pattern, `${path}.pattern`),
      signal,
      date: requireString(record.date, `${path}.date`),
    };
  }

  function normalizeTechnicalCandlesPayload(payload) {
    let flags = [];
    if (Array.isArray(payload)) {
      flags = payload;
    } else {
      const record = requireObject(payload, "technical.candles");
      if (Array.isArray(record.flags)) flags = record.flags;
      else if (Array.isArray(record.data)) flags = record.data;
      else if (Array.isArray(record.results)) flags = record.results;
      else throw new DataValidationError("technical.candles payload must include an array at flags/data/results");
    }
    return flags.map((item, index) => normalizeTechnicalFlag(item, `technical.candles[${index}]`));
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
      reason: record.reason ? requireString(record.reason, "macro.context.reason") : null,
      dbPath: record.dbPath ? requireString(record.dbPath, "macro.context.dbPath") : null,
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
      async fetchChartNormalizedReturns(params) {
        const payload = await request("/charts/normalized-returns", {
          clusterIds: (params?.clusterIds || []).join(","),
          window: params?.window || "1M",
          exchange: params?.exchange || "all",
          points: params?.points || 40,
        });
        return normalizeChartReturnsPayload(payload);
      },
      async fetchDecisionMarkers(params) {
        const payload = await request("/charts/decision-markers", {
          symbol: params?.symbol || "",
          symbolExchange: params?.symbolExchange || "",
          clusterId: params?.clusterId || "",
          window: params?.window || "1M",
          exchange: params?.exchange || "all",
          points: params?.points || 40,
          limit: params?.limit || 60,
        });
        return normalizeDecisionMarkersPayload(payload);
      },
      async fetchPeerRelativeStrength(params) {
        const payload = await request("/peers/relative-strength", {
          symbol: params?.symbol || "",
          exchange: params?.exchange || "all",
          window: params?.window || "1M",
          points: params?.points || 40,
        });
        return normalizePeerRelativeStrengthPayload(payload);
      },
      async fetchOptimalAllocation(tickersOrParams, capitalArg) {
        const params = isObject(tickersOrParams)
          ? tickersOrParams
          : {
              tickers: tickersOrParams,
              capital: capitalArg,
            };
        const tickers = requireArray(params?.tickers || [], "quant.fetchOptimalAllocation.tickers").map((ticker, index) =>
          requireString(ticker, `quant.fetchOptimalAllocation.tickers[${index}]`).toUpperCase(),
        );
        const totalCapital = requireNumber(params?.capital, "quant.fetchOptimalAllocation.capital");
        const payload = await request("/quant/optimize-allocation", {}, {
          method: "POST",
          body: {
            tickers,
            total_capital: totalCapital,
          },
        });
        return normalizeOptimalAllocationPayload(payload);
      },
      async fetchStrategyBacktest(tickersOrParams, optionsArg) {
        const params = isObject(tickersOrParams)
          ? tickersOrParams
          : {
              tickers: tickersOrParams,
              ...(isObject(optionsArg) ? optionsArg : {}),
            };
        const tickers = requireArray(params?.tickers || [], "quant.fetchStrategyBacktest.tickers").map((ticker, index) =>
          requireString(ticker, `quant.fetchStrategyBacktest.tickers[${index}]`).toUpperCase(),
        );
        const lookbackYears = params?.lookbackYears === undefined ? 5 : requireNumber(params.lookbackYears, "quant.fetchStrategyBacktest.lookbackYears");
        const initialCapital = params?.initialCapital === undefined ? 100000 : requireNumber(params.initialCapital, "quant.fetchStrategyBacktest.initialCapital");
        const payload = await request("/quant/backtests/thematic-rotation", {}, {
          method: "POST",
          body: {
            tickers,
            lookback_years: Math.max(1, Math.floor(lookbackYears)),
            initial_capital: initialCapital,
          },
        });
        return normalizeStrategyBacktestPayload(payload);
      },
      async sendEarningsQuery(symbol, query, optionsArg) {
        const symbolValue = requireString(symbol, "research.sendEarningsQuery.symbol").toUpperCase();
        const queryValue = requireString(query, "research.sendEarningsQuery.query");
        const options = isObject(optionsArg) ? optionsArg : {};
        const topK = options.topK === undefined ? 5 : requireNumber(options.topK, "research.sendEarningsQuery.topK");
        const payload = await request("/research/earnings/chat", {}, {
          method: "POST",
          body: {
            symbol: symbolValue,
            query: queryValue,
            top_k: Math.max(1, Math.floor(topK)),
          },
        });
        return normalizeEarningsChatPayload(payload);
      },
      async submitNlpCommand(commandText) {
        const command = requireString(commandText, "commands.submitNlpCommand.commandText");
        const payload = await request("/commands/interpret", {}, {
          method: "POST",
          body: {
            command,
          },
        });
        return normalizeNlpCommandPayload(payload);
      },
      async fetchTechnicalCandles(tickersOrParams) {
        const params = isObject(tickersOrParams)
          ? tickersOrParams
          : {
              tickers: tickersOrParams,
            };
        const rawTickers = Array.isArray(params?.tickers) ? params.tickers : [];
        const tickers = rawTickers
          .map((ticker, index) => requireString(ticker, `technical.fetchTechnicalCandles.tickers[${index}]`).toUpperCase())
          .filter(Boolean);
        const timeoutSeconds =
          params?.timeoutSeconds === undefined
            ? undefined
            : Math.max(3, Math.floor(requireNumber(params.timeoutSeconds, "technical.fetchTechnicalCandles.timeoutSeconds")));
        const payload = await request("/technical/candles/scan", {}, {
          method: "POST",
          body: {
            ...(tickers.length ? { tickers } : {}),
            ...(timeoutSeconds ? { timeout_seconds: timeoutSeconds } : {}),
          },
        });
        return normalizeTechnicalCandlesPayload(payload);
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
    normalizeChartReturnsPayload,
    normalizeDecisionMarkersPayload,
    normalizePeerRelativeStrengthPayload,
    normalizeOptimalAllocationPayload,
    normalizeStrategyBacktestPayload,
    normalizeEarningsChatPayload,
    normalizeNlpCommandPayload,
    normalizeTechnicalCandlesPayload,
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
