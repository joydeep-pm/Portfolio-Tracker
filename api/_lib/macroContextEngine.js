const path = require("node:path");

const { buildView } = require("./mockMarket");
const { bootstrapPortfolio } = require("./portfolioService");
const { DEFAULT_DB_PATH, openDatabase, ensureSchema } = require("./macroHarvester");

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 120;

const POSITIVE_PATTERNS = [
  /\b(?:ease|easing|relax|relief|approval|approves|growth|expansion|incentive|liquidity|stable|recovery)\b/i,
  /\b(?:surplus|strong|improve|improves|improved|upgrade|tailwind|supportive)\b/i,
  /\b(?:compliance window extended|norms? eased|capital infusion)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(?:tighten|tightening|restrict|restriction|ban|penalty|penal|crackdown|warning)\b/i,
  /\b(?:stress|default|fraud|violation|non-?compliance|risk|volatile|downturn|slowdown)\b/i,
  /\b(?:higher provisioning|capital requirement hike|adverse action)\b/i,
];

const HEAD_KEYWORD_MAP = {
  "Banking & Financial Services": [
    /\bbank(?:ing)?\b/i,
    /\bcredit\b/i,
    /\blending\b/i,
    /\bnbfc\b/i,
    /\bloan\b/i,
    /\bnpa\b/i,
    /\bprovision(?:ing)?\b/i,
  ],
  "Fintech & Payments India": [
    /\bupi\b/i,
    /\bpayments?\b/i,
    /\bwallet\b/i,
    /\bfintech\b/i,
    /\bdigital\s+lending\b/i,
    /\bpayment\s+aggregator\b/i,
    /\bppi\b/i,
  ],
  "PSU & Disinvestment": [/\bpsu\b/i, /\bstate-?owned\b/i, /\bdisinvestment\b/i],
  "IT Services & Digital Tech": [/\bit\b/i, /\bsoftware\b/i, /\bdigital\b/i, /\bcyber\b/i],
  "Data Centers & Cloud India": [/\bdata\s+center/i, /\bcloud\b/i, /\bserver\b/i],
  "Power Utilities & Grid": [/\bpower\b/i, /\butilities?\b/i, /\bgrid\b/i, /\belectricity\b/i],
  "Renewable Energy": [/\brenewable\b/i, /\bsolar\b/i, /\bwind\b/i, /\bgreen\s+energy\b/i],
  "Oil, Gas & Petrochemicals": [/\boil\b/i, /\bgas\b/i, /\bpetro(?:chemicals?)?\b/i, /\bcrude\b/i],
  "Capital Goods & Engineering": [/\bcapital\s+goods\b/i, /\bengineering\b/i, /\bmanufacturing\b/i, /\bcapex\b/i],
  "Realty & Urban Infra": [/\brealty\b/i, /\binfra(?:structure)?\b/i, /\bconstruction\b/i],
  "Telecom & Digital Infra": [/\btelecom\b/i, /\b5g\b/i, /\bspectrum\b/i],
  "Healthcare Services": [/\bhealth(?:care)?\b/i, /\bhospital\b/i, /\binsurance\b/i],
  "Pharma & Biotech": [/\bpharma\b/i, /\bbiotech\b/i, /\bdrug\b/i],
  "Consumer Staples": [/\bfmcg\b/i, /\bstaples\b/i, /\bconsumer\b/i],
  "Automobiles & EV": [/\bauto(?:mobile)?\b/i, /\bev\b/i, /\bvehicle\b/i],
};

const TAG_TO_HEADS = {
  RBI: ["Banking & Financial Services", "Fintech & Payments India", "PSU & Disinvestment"],
  SEBI: ["Banking & Financial Services", "Fintech & Payments India", "PSU & Disinvestment"],
  NBFC: ["Banking & Financial Services"],
  "digital lending": ["Fintech & Payments India", "Banking & Financial Services"],
  KYC: ["Fintech & Payments India", "Banking & Financial Services"],
  payments: ["Fintech & Payments India"],
  "capital markets": ["Banking & Financial Services", "PSU & Disinvestment"],
};

function normalizeExchange(raw) {
  const value = String(raw || "all").toLowerCase();
  if (value === "nse" || value === "bse") return value;
  return "all";
}

function normalizeLimit(raw) {
  const parsed = Number.parseInt(String(raw ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriorityTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } catch (_error) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function instrumentKey(exchange, symbol) {
  return `${String(exchange || "NSE").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function scoreSentiment(text) {
  const source = normalizeText(text);
  if (!source) return 0;

  let positive = 0;
  let negative = 0;

  POSITIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(source)) positive += 1;
  });

  NEGATIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(source)) negative += 1;
  });

  if (/tighten(?:ing)?\s+(?:norms?|rules?)/i.test(source) && /(digital\s+lending|unsecured\s+loan)/i.test(source)) {
    negative += 1;
  }

  if (/relax(?:es|ed|ing)?\s+(?:norms?|rules?)/i.test(source) && /(capital|lending|liquidity|compliance)/i.test(source)) {
    positive += 1;
  }

  const total = positive + negative;
  if (!total) return 0;
  return Number.parseFloat(clamp((positive - negative) / total, -1, 1).toFixed(4));
}

function buildHeadClusterMap() {
  const marketView = buildView("all");
  const map = new Map();
  (marketView.clusters || []).forEach((cluster) => {
    const headName = String(cluster.headName || "");
    if (!headName) return;
    if (!map.has(headName)) map.set(headName, []);
    map.get(headName).push({
      clusterId: cluster.id,
      clusterName: cluster.name,
      headName,
      momentum1M: Number.parseFloat(cluster.momentum?.["1M"] || 0),
    });
  });

  map.forEach((clusters, headName) => {
    map.set(
      headName,
      [...clusters].sort((a, b) => b.momentum1M - a.momentum1M || a.clusterName.localeCompare(b.clusterName)),
    );
  });

  return map;
}

function scoreHeadImpacts(text, tags, focusTheme) {
  const source = normalizeText(text);
  const headScores = new Map();

  Object.entries(HEAD_KEYWORD_MAP).forEach(([headName, patterns]) => {
    const matches = patterns.reduce((acc, pattern) => (pattern.test(source) ? acc + 1 : acc), 0);
    if (matches > 0) {
      headScores.set(headName, matches);
    }
  });

  tags.forEach((tag) => {
    const mappedHeads = TAG_TO_HEADS[String(tag)] || [];
    mappedHeads.forEach((headName) => {
      headScores.set(headName, (headScores.get(headName) || 0) + 1.5);
    });
  });

  const focusThemeText = normalizeText(focusTheme).toLowerCase();
  if (focusThemeText) {
    headScores.forEach((score, headName) => {
      if (headName.toLowerCase().includes(focusThemeText) || focusThemeText.includes(headName.toLowerCase())) {
        headScores.set(headName, score + 2);
      }
    });
  }

  return headScores;
}

function scoreHoldingRelevance(itemText, symbols, selectedSymbol) {
  const source = normalizeText(itemText).toUpperCase();
  if (!source) return 0;

  let score = 0;
  const symbolMatches = [];

  if (selectedSymbol && source.includes(selectedSymbol)) {
    score += 1.4;
    symbolMatches.push(selectedSymbol);
  }

  symbols.forEach((symbol) => {
    if (!symbol || symbol === selectedSymbol) return;
    if (source.includes(symbol)) {
      score += 0.22;
      symbolMatches.push(symbol);
    }
  });

  return {
    relevance: clamp(score, 0, 2.5),
    symbolMatches,
  };
}

function selectCandidateNews(db, options = {}) {
  const limit = normalizeLimit(options.limit);
  const includeProcessed = Boolean(options.includeProcessed);

  const selectPending = db
    .prepare(
      `
      SELECT id, source_type, title, content_text, url, published_date, priority_tags, processed_by_llm
      FROM market_news
      WHERE processed_by_llm = 0
      ORDER BY COALESCE(published_date, '') DESC, id DESC
      LIMIT ?
    `,
    )
    .all(limit);

  if (selectPending.length || !includeProcessed) {
    return selectPending;
  }

  return db
    .prepare(
      `
      SELECT id, source_type, title, content_text, url, published_date, priority_tags, processed_by_llm
      FROM market_news
      ORDER BY COALESCE(published_date, '') DESC, id DESC
      LIMIT ?
    `,
    )
    .all(limit);
}

function markNewsProcessed(db, ids = []) {
  const cleanIds = [...new Set(ids.map((value) => Number.parseInt(String(value), 10)).filter(Number.isFinite))];
  if (!cleanIds.length) return 0;

  const update = db.prepare(`UPDATE market_news SET processed_by_llm = 1 WHERE id = ?`);
  const apply = db.transaction((items) => {
    let changed = 0;
    items.forEach((id) => {
      const result = update.run(id);
      changed += Number(result.changes || 0);
    });
    return changed;
  });

  return apply(cleanIds);
}

function pickCatalyst(scoredItems) {
  if (!scoredItems.length) return "No high-signal regulatory catalyst detected in current fetch window.";
  const best = [...scoredItems].sort((a, b) => b.impactScore - a.impactScore || b.relevanceScore - a.relevanceScore)[0];
  const source = String(best.source_type || "source").replace(/_/g, " ");
  return `${best.title} (${source})`;
}

function summarizeRationale(result) {
  const descriptor =
    result.sentiment_score >= 0.2
      ? "constructive"
      : result.sentiment_score <= -0.2
        ? "defensive"
        : "mixed";

  const topClusters = result.impacted_clusters.slice(0, 3).map((item) => item.cluster_name).join(", ");
  const clusterLine = topClusters || "broad financial and policy-sensitive clusters";

  return `${result.key_catalyst} sets a ${descriptor} macro tone for the currently selected holdings. Most exposed micro-clusters are ${clusterLine}, based on regulatory-tag and holdings relevance overlap.`;
}

function buildPrompt({ holdings = [], symbol = "", themeHint = "", events = [] } = {}) {
  const holdingList = holdings.slice(0, 25).map((row) => `${row.exchange}:${row.symbol}`).join(", ");
  const eventList = events
    .slice(0, 12)
    .map((event, index) => `${index + 1}. ${event.title} | tags=${event.priority_tags?.join("|") || "none"} | ${event.content_text}`)
    .join("\n");

  return {
    system:
      "You are the Macro & Regulatory Analyst Agent for Indian equities. Produce strict JSON only with keys sentiment_score, key_catalyst, impacted_clusters, rationale_summary.",
    user: [
      `Focus symbol: ${symbol || "N/A"}`,
      `Theme hint: ${themeHint || "N/A"}`,
      `Portfolio holdings: ${holdingList || "N/A"}`,
      "Regulatory/news events:",
      eventList || "No events available.",
      "Return sentiment_score in [-1,1]. rationale_summary must be exactly 2 sentences.",
    ].join("\n"),
  };
}

async function analyzeMacroContext(options = {}) {
  const exchange = normalizeExchange(options.exchange);
  const selectedSymbol = String(options.symbol || "").toUpperCase().trim();
  const themeHint = String(options.themeHint || options.theme || "").trim();
  const limit = normalizeLimit(options.limit);
  const includeProcessed = Boolean(options.includeProcessed);
  const includePromptDraft = Boolean(options.includePromptDraft);

  const portfolio = await bootstrapPortfolio({ exchange, forceRefresh: false });
  const holdings = Array.isArray(portfolio.rows) ? portfolio.rows : [];
  const holdingsBySymbol = new Map(holdings.map((row) => [String(row.symbol || "").toUpperCase(), row]));
  const symbols = [...holdingsBySymbol.keys()];

  const dbPath = path.resolve(options.dbPath || process.env.MACRO_EVENTS_DB_PATH || DEFAULT_DB_PATH);
  const db = openDatabase(dbPath);
  ensureSchema(db);

  const rows = selectCandidateNews(db, {
    limit,
    includeProcessed,
  });

  const headClusterMap = buildHeadClusterMap();
  const aggregateHeadImpact = new Map();
  const scoredItems = rows.map((row) => {
    const tags = parsePriorityTags(row.priority_tags);
    const title = normalizeText(row.title);
    const content = normalizeText(row.content_text);
    const combined = `${title} ${content}`.trim();

    const sentiment = scoreSentiment(combined);
    const holdingRelevance = scoreHoldingRelevance(combined, symbols, selectedSymbol);
    const headScores = scoreHeadImpacts(combined, tags, themeHint);

    headScores.forEach((score, headName) => {
      const base = aggregateHeadImpact.get(headName) || 0;
      const weighted = score * (1 + holdingRelevance.relevance * 0.4) * (1 + Math.abs(sentiment) * 0.3);
      aggregateHeadImpact.set(headName, base + weighted);
    });

    const relevanceScore = clamp(
      holdingRelevance.relevance + (selectedSymbol && combined.includes(selectedSymbol) ? 0.5 : 0) + (tags.length ? 0.2 : 0),
      0,
      3.2,
    );

    const impactScore = Number.parseFloat((Math.abs(sentiment) * 0.45 + relevanceScore * 0.55).toFixed(4));

    return {
      id: row.id,
      source_type: row.source_type,
      title,
      content_text: content,
      url: row.url,
      published_date: row.published_date,
      priority_tags: tags,
      sentiment,
      relevanceScore,
      impactScore,
      symbolMatches: holdingRelevance.symbolMatches,
    };
  });

  const weightedSentiment = scoredItems.reduce((acc, item) => acc + item.sentiment * (1 + item.relevanceScore), 0);
  const weightSum = scoredItems.reduce((acc, item) => acc + (1 + item.relevanceScore), 0);
  const sentimentScore = Number.parseFloat(clamp(weightSum > 0 ? weightedSentiment / weightSum : 0, -1, 1).toFixed(4));

  const impactedClusters = [];
  const headRanking = [...aggregateHeadImpact.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxHeadScore = headRanking.length ? headRanking[0][1] : 0;

  headRanking.forEach(([headName, headScore]) => {
    const clusters = headClusterMap.get(headName) || [];
    clusters.slice(0, 3).forEach((cluster) => {
      impactedClusters.push({
        cluster_id: cluster.clusterId,
        cluster_name: cluster.clusterName,
        head_name: cluster.headName,
        impact_score: Number.parseFloat(clamp(maxHeadScore > 0 ? headScore / maxHeadScore : 0, 0, 1).toFixed(4)),
      });
    });
  });

  const keyCatalyst = pickCatalyst(scoredItems);
  const result = {
    asOf: new Date().toISOString(),
    exchange,
    symbol: selectedSymbol || null,
    theme_hint: themeHint || null,
    sentiment_score: sentimentScore,
    key_catalyst: keyCatalyst,
    impacted_clusters: impactedClusters.slice(0, 12),
    rationale_summary: "",
    considered_events: scoredItems.length,
    sources: [...new Set(scoredItems.map((item) => item.source_type))],
    source_events: scoredItems.slice(0, 12).map((item) => ({
      id: item.id,
      source_type: item.source_type,
      title: item.title,
      url: item.url,
      published_date: item.published_date,
      priority_tags: item.priority_tags,
      sentiment: item.sentiment,
      relevance_score: item.relevanceScore,
      impact_score: item.impactScore,
    })),
    model: "heuristic-v1",
  };

  result.rationale_summary = summarizeRationale(result);
  const processedCount = markNewsProcessed(
    db,
    scoredItems.map((item) => item.id),
  );

  db.close();

  const output = {
    ...result,
    processed_count: processedCount,
    dbPath,
  };

  if (includePromptDraft) {
    output.promptDraft = buildPrompt({
      holdings,
      symbol: selectedSymbol,
      themeHint,
      events: scoredItems,
    });
  }

  return output;
}

module.exports = {
  analyzeMacroContext,
  buildPrompt,
  scoreSentiment,
  scoreHeadImpacts,
  selectCandidateNews,
  markNewsProcessed,
  normalizeExchange,
  normalizeLimit,
};
