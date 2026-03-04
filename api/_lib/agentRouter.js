const STOPWORDS = new Set([
  "my",
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "your",
  "this",
  "that",
  "against",
  "current",
  "evaluate",
  "portfolio",
  "momentum",
  "thematic",
  "please",
  "show",
  "check",
  "risk",
  "entry",
  "exit",
]);

function extractSymbols(text) {
  const matches = String(text || "").match(/\b[A-Z]{2,15}\b/g) || [];
  return [...new Set(matches.filter((token) => token.length >= 3))];
}

function extractThemeHints(text) {
  const lowered = String(text || "").toLowerCase();
  const buckets = [
    "psu bank",
    "banking",
    "energy",
    "it",
    "pharma",
    "metal",
    "momentum",
    "defence",
    "auto",
    "fmcg",
  ];
  return buckets.filter((bucket) => lowered.includes(bucket));
}

function extractKeywords(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
  return [...new Set(words)].slice(0, 20);
}

function routePrompt(prompt = "") {
  const text = String(prompt || "").trim();
  const lowered = text.toLowerCase();

  let intent = "market_scan";
  if (lowered.includes("watchlist") || lowered.includes("suggest")) intent = "watchlist_suggestions";
  else if (lowered.includes("risk") || lowered.includes("exit") || lowered.includes("reduce")) intent = "risk_review";
  else if (lowered.includes("portfolio") && (lowered.includes("thematic") || lowered.includes("momentum") || lowered.includes("sector"))) {
    intent = "portfolio_thematic_momentum";
  } else if (lowered.includes("portfolio")) {
    intent = "portfolio_review";
  }

  const route = {
    market_scan: "market_data_agent -> news_analyst_agent -> recommendation_agent",
    portfolio_review: "portfolio_agent -> market_data_agent -> recommendation_agent",
    portfolio_thematic_momentum: "portfolio_agent -> market_data_agent -> news_analyst_agent -> recommendation_agent",
    risk_review: "portfolio_agent -> news_analyst_agent -> recommendation_agent",
    watchlist_suggestions: "market_data_agent -> news_analyst_agent -> recommendation_agent",
  }[intent];

  return {
    intent,
    route,
    prompt: text,
    symbols: extractSymbols(text.toUpperCase()),
    themeHints: extractThemeHints(text),
    keywords: extractKeywords(text),
  };
}

module.exports = {
  routePrompt,
  extractSymbols,
  extractThemeHints,
  extractKeywords,
};
