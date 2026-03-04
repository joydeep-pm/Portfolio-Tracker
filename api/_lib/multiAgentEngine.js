const { bootstrapPortfolio } = require("./portfolioService");
const { getHotspotSnapshot } = require("./hotspotService");
const { retrieveNewsContext, aggregateSentiment } = require("./newsRagStore");
const { routePrompt } = require("./agentRouter");
const { RECOMMENDATION_DISCLAIMER, applyDecisionGuardrails } = require("./safety");

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function instrumentKey(exchange, symbol) {
  return `${String(exchange || "NSE").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function normalizeExchange(value) {
  const key = String(value || "all").toLowerCase();
  if (key === "nse" || key === "bse") return key;
  return "all";
}

function workflowNodes(intent) {
  const workflows = {
    market_scan: ["market_data_agent", "news_analyst_agent", "recommendation_agent"],
    portfolio_review: ["portfolio_agent", "market_data_agent", "recommendation_agent"],
    portfolio_thematic_momentum: ["portfolio_agent", "market_data_agent", "news_analyst_agent", "recommendation_agent"],
    risk_review: ["portfolio_agent", "news_analyst_agent", "recommendation_agent"],
    watchlist_suggestions: ["market_data_agent", "news_analyst_agent", "recommendation_agent"],
  };
  return workflows[intent] || workflows.market_scan;
}

async function portfolioAgent(state) {
  const snapshot = await bootstrapPortfolio({
    exchange: state.exchange,
    forceRefresh: false,
  });
  const filterSymbols = new Set((state.route?.symbols || []).map((symbol) => String(symbol || "").toUpperCase()));
  const candidateRows = filterSymbols.size
    ? snapshot.rows.filter((row) => filterSymbols.has(String(row.symbol || "").toUpperCase()))
    : snapshot.rows;
  const rows = candidateRows.length ? candidateRows : snapshot.rows;
  return {
    ...state,
    portfolio: {
      asOf: snapshot.asOf,
      rows,
      thematicMappings: snapshot.thematicMappings || [],
      summary: snapshot.summary || {},
    },
  };
}

async function marketDataAgent(state) {
  const hotspot = await getHotspotSnapshot({
    exchange: state.exchange,
    forceRefresh: false,
  });
  const topHotspots = (hotspot.hotspots || []).slice(0, 8);
  return {
    ...state,
    market: {
      asOf: hotspot.asOf,
      hotspots: topHotspots,
      coverage: hotspot.coverage || {},
      scheduler: hotspot.scheduler || {},
      source: hotspot.source || "unknown",
    },
  };
}

async function newsAnalystAgent(state) {
  const topThemeHints = (state.market?.hotspots || []).slice(0, 5).map((item) => item.themeName);
  const query = [state.prompt, ...topThemeHints, ...(state.route?.themeHints || []), ...(state.route?.symbols || [])].join(" ");
  const context = await retrieveNewsContext(query, {
    limit: 6,
    hints: [...(state.route?.symbols || []), ...(state.route?.themeHints || []), ...topThemeHints],
  });
  const sentiment = aggregateSentiment(context.documents || []);

  return {
    ...state,
    news: {
      context,
      sentiment,
    },
  };
}

function computeThemeBoostByInstrument(state) {
  const hotspots = Array.isArray(state.market?.hotspots) ? state.market.hotspots : [];
  const hotspotByTheme = new Map(hotspots.map((item) => [String(item.themeId || "").toLowerCase(), item]));
  const mappings = Array.isArray(state.portfolio?.thematicMappings) ? state.portfolio.thematicMappings : [];
  const output = new Map();

  mappings.forEach((mapping) => {
    const key = instrumentKey(mapping.exchange, mapping.symbol);
    const themeId = String(mapping.index_id || "").toLowerCase();
    const hotspot = hotspotByTheme.get(themeId);
    if (!hotspot) return;
    const current = toNumber(output.get(key), 0);
    const next = Math.max(current, toNumber(hotspot.score, 0));
    output.set(key, next);
  });

  return output;
}

function sentimentImpactForRow(row, newsContext = {}) {
  const docs = Array.isArray(newsContext.documents) ? newsContext.documents : [];
  if (!docs.length) return 0;

  const symbol = String(row.symbol || "").toUpperCase();
  const matched = docs.filter((doc) => {
    const tags = Array.isArray(doc.tags) ? doc.tags.map((tag) => String(tag).toUpperCase()) : [];
    return tags.some((tag) => tag.includes(symbol));
  });
  const pool = matched.length ? matched : docs;
  const sentiment = aggregateSentiment(pool);
  return sentiment.sentimentScore * 100;
}

function toAction(score) {
  if (score >= 30) return "BUY";
  if (score >= 12) return "ACCUMULATE";
  if (score <= -35) return "SELL";
  if (score <= -15) return "REDUCE";
  return "HOLD";
}

function buildAgentDecision(row, state, themeBoostByInstrument) {
  const technicalScore = toNumber(row?.decision?.score, 0);
  const themeBoost = toNumber(themeBoostByInstrument.get(instrumentKey(row.exchange, row.symbol)), 0);
  const newsImpact = sentimentImpactForRow(row, state.news?.context || {});
  const drawdown = toNumber(row.unrealizedPnlPct, 0);
  const riskPenalty = drawdown < -15 ? 18 : drawdown < -8 ? 10 : drawdown < -3 ? 4 : 0;

  const weightedScoreRaw = technicalScore * 0.5 + (themeBoost - 50) * 0.3 + newsImpact * 0.2 - riskPenalty;
  const weightedScore = Number.parseFloat(clamp(weightedScoreRaw, -100, 100).toFixed(2));
  const action = toAction(weightedScore);
  const confidence = Number.parseFloat(clamp(35 + Math.abs(weightedScore) * 0.82, 35, 98).toFixed(1));

  const riskFlags = [...new Set([...(row?.decision?.riskFlags || []), ...(riskPenalty > 0 ? ["Drawdown pressure"] : [])])];
  const rationale = [
    `Technical contribution: ${technicalScore.toFixed(2)}`,
    `Thematic momentum contribution: ${(themeBoost - 50).toFixed(2)}`,
    `News sentiment contribution: ${newsImpact.toFixed(2)}`,
    `Risk penalty: -${riskPenalty.toFixed(2)}`,
  ];
  const invalidation = [
    "Weighted score drops below -15",
    "Hotspot breadth contracts below 25%",
    "Adverse news sentiment persists across top context docs",
  ];

  return {
    symbol: row.symbol,
    exchange: row.exchange,
    action,
    confidence,
    weightedScore,
    riskFlags,
    rationale,
    invalidation,
    asOf: state.asOf,
  };
}

async function recommendationAgent(state) {
  const rows = Array.isArray(state.portfolio?.rows) ? state.portfolio.rows : [];
  const themeBoostByInstrument = computeThemeBoostByInstrument(state);
  const decisions = rows
    .map((row) => buildAgentDecision(row, state, themeBoostByInstrument))
    .map((decision) =>
      applyDecisionGuardrails(decision, {
        liveTradingEnabled: false,
        maxConfidence: 95,
        minDecisionConfidence: 40,
      }),
    );
  const summary = {
    totalDecisions: decisions.length,
    buyLike: decisions.filter((item) => item.action === "BUY" || item.action === "ACCUMULATE").length,
    sellLike: decisions.filter((item) => item.action === "SELL" || item.action === "REDUCE").length,
    averageConfidence:
      decisions.length > 0
        ? Number.parseFloat((decisions.reduce((acc, item) => acc + toNumber(item.confidence, 0), 0) / decisions.length).toFixed(2))
        : 0,
  };

  return {
    ...state,
    recommendation: {
      decisions,
      summary,
      disclaimer: RECOMMENDATION_DISCLAIMER,
    },
  };
}

const NODE_HANDLERS = {
  portfolio_agent: portfolioAgent,
  market_data_agent: marketDataAgent,
  news_analyst_agent: newsAnalystAgent,
  recommendation_agent: recommendationAgent,
};

async function runAgentWorkflow(options = {}) {
  const prompt = String(options.prompt || "").trim();
  const route = routePrompt(prompt);
  const nodes = workflowNodes(route.intent);

  let state = {
    prompt,
    route,
    exchange: normalizeExchange(options.exchange),
    asOf: new Date().toISOString(),
    portfolio: null,
    market: null,
    news: null,
    recommendation: null,
    trace: [],
  };

  for (const node of nodes) {
    const handler = NODE_HANDLERS[node];
    if (!handler) continue;
    const startedAt = Date.now();
    state = await handler(state);
    state.trace.push({
      node,
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString(),
    });
  }

  return {
    asOf: state.asOf,
    intent: route.intent,
    route: route.route,
    exchange: state.exchange,
    summary: state.recommendation?.summary || { totalDecisions: 0, buyLike: 0, sellLike: 0, averageConfidence: 0 },
    decisions: state.recommendation?.decisions || [],
    context: {
      portfolioAsOf: state.portfolio?.asOf || null,
      marketAsOf: state.market?.asOf || null,
      hotspotCount: (state.market?.hotspots || []).length,
      newsDocs: (state.news?.context?.documents || []).length,
      newsSentiment: state.news?.sentiment || null,
    },
    disclaimer: state.recommendation?.disclaimer || RECOMMENDATION_DISCLAIMER,
    graphTrace: state.trace,
  };
}

module.exports = {
  runAgentWorkflow,
  buildAgentDecision,
  workflowNodes,
};
