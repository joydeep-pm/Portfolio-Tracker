const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_NEWS_PATH = path.resolve(process.cwd(), "data/news_corpus.json");
const SEED_NEWS_PATH = path.resolve(process.cwd(), "data/news_corpus_seed.json");
const CACHE_TTL_MS = 15_000;

const cache = {
  loadedAtMs: 0,
  corpusPath: "",
  corpus: null,
};

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function scoreDocument(doc, terms) {
  const titleTokens = tokenize(doc.title);
  const contentTokens = tokenize(doc.content);
  const tagTokens = (Array.isArray(doc.tags) ? doc.tags : []).flatMap((tag) => tokenize(tag));
  const bag = new Set([...titleTokens, ...contentTokens, ...tagTokens]);
  let score = 0;
  terms.forEach((term) => {
    if (bag.has(term)) score += 1;
  });
  return score;
}

function normalizeDoc(doc, index = 0) {
  return {
    id: String(doc.id || `doc-${index + 1}`),
    title: String(doc.title || "Untitled"),
    content: String(doc.content || ""),
    tags: Array.isArray(doc.tags) ? doc.tags.map((tag) => String(tag)) : [],
    sentiment: ["positive", "negative", "neutral"].includes(String(doc.sentiment || "").toLowerCase())
      ? String(doc.sentiment || "").toLowerCase()
      : "neutral",
    publishedAt: String(doc.publishedAt || new Date().toISOString()),
  };
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function loadNewsCorpus(options = {}) {
  const corpusPath = path.resolve(process.cwd(), options.path || DEFAULT_NEWS_PATH);
  const nowMs = Date.now();

  if (
    cache.corpus &&
    cache.corpusPath === corpusPath &&
    nowMs - cache.loadedAtMs <= CACHE_TTL_MS &&
    !options.forceReload
  ) {
    return cache.corpus;
  }

  let payload;
  let pathUsed = corpusPath;
  try {
    payload = await readJson(corpusPath);
  } catch (_error) {
    payload = await readJson(SEED_NEWS_PATH);
    pathUsed = SEED_NEWS_PATH;
  }

  const corpus = {
    generatedAt: String(payload.generatedAt || new Date().toISOString()),
    source: String(payload.source || "seed-news-corpus"),
    pathUsed,
    documents: (Array.isArray(payload.documents) ? payload.documents : []).map(normalizeDoc),
  };

  cache.loadedAtMs = nowMs;
  cache.corpusPath = corpusPath;
  cache.corpus = corpus;
  return corpus;
}

async function retrieveNewsContext(query, options = {}) {
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 5;
  const hints = Array.isArray(options.hints) ? options.hints : [];
  const corpus = await loadNewsCorpus(options);
  const terms = [...tokenize(query), ...hints.flatMap((item) => tokenize(item))];
  const uniqueTerms = [...new Set(terms)];

  const ranked = corpus.documents
    .map((doc) => ({
      ...doc,
      _score: scoreDocument(doc, uniqueTerms),
    }))
    .filter((doc) => doc._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return String(b.publishedAt).localeCompare(String(a.publishedAt));
    })
    .slice(0, limit);

  return {
    source: corpus.source,
    totalDocuments: corpus.documents.length,
    queryTerms: uniqueTerms,
    documents: ranked.map(({ _score, ...doc }) => ({
      ...doc,
      score: _score,
    })),
  };
}

function aggregateSentiment(docs = []) {
  const sentiment = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  docs.forEach((doc) => {
    const key = String(doc.sentiment || "neutral").toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(sentiment, key)) return;
    sentiment[key] += 1;
  });
  const total = sentiment.positive + sentiment.neutral + sentiment.negative;
  const sentimentScore = total > 0 ? (sentiment.positive - sentiment.negative) / total : 0;
  return {
    ...sentiment,
    total,
    sentimentScore: Number.parseFloat(sentimentScore.toFixed(4)),
  };
}

module.exports = {
  loadNewsCorpus,
  retrieveNewsContext,
  aggregateSentiment,
  DEFAULT_NEWS_PATH,
  SEED_NEWS_PATH,
};
