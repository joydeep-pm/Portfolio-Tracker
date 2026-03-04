const fs = require("node:fs");
const path = require("node:path");
const Parser = require("rss-parser");
const Database = require("better-sqlite3");

const RBI_RSS_INDEX_URL = "https://www.rbi.org.in/Scripts/rss.aspx";
const RBI_PRESS_FALLBACK_URL = "https://rbi.org.in/pressreleases_rss.xml";
const RBI_NOTIFICATIONS_FALLBACK_URL = "https://rbi.org.in/notifications_rss.xml";
const SEBI_RSS_URL = "https://www.sebi.gov.in/sebirss.xml";

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_REGION || process.env.LAMBDA_TASK_ROOT);
}

function resolveDbPath(dbPath = "") {
  const candidate = String(dbPath || process.env.MACRO_EVENTS_DB_PATH || "").trim();
  if (candidate) return path.resolve(candidate);
  if (isServerlessRuntime()) return path.resolve("/tmp", "macro_events.db");
  return path.resolve(process.cwd(), "data", "macro_events.db");
}

const DEFAULT_DB_PATH = resolveDbPath();

const PRIORITY_PATTERNS = [
  { tag: "RBI", regex: /\b(?:rbi|reserve\s+bank\s+of\s+india)\b/i },
  { tag: "SEBI", regex: /\bsebi\b/i },
  { tag: "NBFC", regex: /\bnbfc\b|non[-\s]*banking\s+financial\s+compan/i },
  { tag: "digital lending", regex: /digital[-\s]*lending/i },
  { tag: "KYC", regex: /\bkyc\b|know\s+your\s+customer/i },
  { tag: "payments", regex: /\bpayments?\b|upi|wallets?/i },
  { tag: "capital markets", regex: /capital\s+markets?|securities\s+markets?|stock\s+markets?/i },
];

const parser = new Parser({
  customFields: {
    item: ["guid", "description", "pubDate"],
  },
});

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  return normalizeWhitespace(String(value || "")).replace(/&amp;/g, "&");
}

function stripHtml(value) {
  return normalizeWhitespace(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " "),
  );
}

function normalizePublishedDate(raw) {
  const source = normalizeWhitespace(raw);
  const parsed = new Date(source);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  return source || null;
}

function extractPriorityTags(textParts) {
  const text = Array.isArray(textParts) ? textParts.join(" ") : String(textParts || "");
  const tags = [];
  PRIORITY_PATTERNS.forEach((pattern) => {
    if (pattern.regex.test(text)) tags.push(pattern.tag);
  });
  return tags;
}

function extractRbiFeedLinksFromHtml(html) {
  const hrefMatches = String(html || "").match(/href\s*=\s*"([^"]+)"/gi) || [];
  const links = hrefMatches
    .map((match) => match.replace(/^href\s*=\s*"/i, "").replace(/"$/i, ""))
    .map((href) => {
      try {
        return new URL(href, RBI_RSS_INDEX_URL).toString();
      } catch (_error) {
        return "";
      }
    })
    .filter(Boolean);

  return {
    press: links.find((url) => /pressreleases_rss\.xml/i.test(url)) || RBI_PRESS_FALLBACK_URL,
    notifications: links.find((url) => /notifications_rss\.xml/i.test(url)) || RBI_NOTIFICATIONS_FALLBACK_URL,
  };
}

async function fetchText(url, options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable in this runtime");
  }

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "user-agent": "portfolio-tracker-macro-harvester/1.0",
      accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }

  return response.text();
}

async function discoverRbiFeedUrls(options = {}) {
  const html = await fetchText(RBI_RSS_INDEX_URL, options);
  return extractRbiFeedLinksFromHtml(html);
}

function normalizeFeedItem(raw, sourceType) {
  const title = normalizeWhitespace(raw?.title);
  const url = normalizeUrl(raw?.link || raw?.guid || raw?.id);
  const contentText = stripHtml(raw?.description || raw?.contentSnippet || raw?.content || "");
  const publishedDate = normalizePublishedDate(raw?.pubDate || raw?.isoDate || "");
  const priorityTags = extractPriorityTags([sourceType, title, contentText, url]);

  return {
    source_type: sourceType,
    title,
    content_text: contentText,
    url,
    published_date: publishedDate,
    priority_tags: JSON.stringify(priorityTags),
    processed_by_llm: 0,
  };
}

async function fetchRssItems(sourceType, sourceUrl, options = {}) {
  const xml = await fetchText(sourceUrl, options);
  const feed = await parser.parseString(xml);
  const items = Array.isArray(feed?.items) ? feed.items : [];
  const maxItemsPerSource = Number.isFinite(options.maxItemsPerSource) ? Math.max(1, options.maxItemsPerSource) : 40;

  return items
    .slice(0, maxItemsPerSource)
    .map((item) => normalizeFeedItem(item, sourceType))
    .filter((item) => item.url && item.title);
}

function openDatabase(dbPath = DEFAULT_DB_PATH) {
  const resolved = resolveDbPath(dbPath);
  const folder = path.dirname(resolved);
  if (folder) {
    fs.mkdirSync(folder, { recursive: true });
  }
  return new Database(resolved);
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content_text TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      published_date TEXT,
      priority_tags TEXT,
      processed_by_llm INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_market_news_published_date
      ON market_news(published_date);

    CREATE INDEX IF NOT EXISTS idx_market_news_processed_by_llm
      ON market_news(processed_by_llm);
  `);
}

function insertNewsItems(db, items) {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO market_news (
      source_type,
      title,
      content_text,
      url,
      published_date,
      priority_tags,
      processed_by_llm
    ) VALUES (
      @source_type,
      @title,
      @content_text,
      @url,
      @published_date,
      @priority_tags,
      @processed_by_llm
    )
  `);

  let insertedCount = 0;
  let duplicateCount = 0;

  const insertMany = db.transaction((rows) => {
    rows.forEach((row) => {
      const result = insertStmt.run(row);
      if (result.changes > 0) insertedCount += 1;
      else duplicateCount += 1;
    });
  });

  insertMany(items);
  return {
    insertedCount,
    duplicateCount,
  };
}

function readLatestNews(db, limit = 25) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 25;
  const rows = db
    .prepare(
      `
      SELECT id, source_type, title, content_text, url, published_date, priority_tags, processed_by_llm
      FROM market_news
      ORDER BY COALESCE(published_date, '') DESC, id DESC
      LIMIT ?
    `,
    )
    .all(safeLimit)
    .map((row) => ({
      ...row,
      processed_by_llm: Boolean(row.processed_by_llm),
      priority_tags: (() => {
        try {
          return JSON.parse(row.priority_tags || "[]");
        } catch (_error) {
          return [];
        }
      })(),
    }));

  return rows;
}

function readTotalCount(db) {
  const row = db.prepare("SELECT COUNT(1) AS total FROM market_news").get();
  return Number(row?.total || 0);
}

async function runHarvester(options = {}) {
  const dbPath = resolveDbPath(options.dbPath);
  const maxItemsPerSource = Number.isFinite(options.maxItemsPerSource) ? Math.max(1, options.maxItemsPerSource) : 40;
  const latestLimit = Number.isFinite(options.latestLimit) ? Math.max(1, options.latestLimit) : 25;

  const rbiFeeds = await discoverRbiFeedUrls(options);
  const sources = [
    { sourceType: "RBI_RSS", sourceUrl: rbiFeeds.press, sourceLabel: "RBI Press Releases" },
    { sourceType: "RBI_RSS", sourceUrl: rbiFeeds.notifications, sourceLabel: "RBI Notifications" },
    { sourceType: "SEBI_RSS", sourceUrl: SEBI_RSS_URL, sourceLabel: "SEBI RSS" },
  ];

  const fetchedItems = [];
  for (const source of sources) {
    const items = await fetchRssItems(source.sourceType, source.sourceUrl, {
      ...options,
      maxItemsPerSource,
    });
    fetchedItems.push(...items);
  }

  const db = openDatabase(dbPath);
  ensureSchema(db);

  const insertStats = insertNewsItems(db, fetchedItems);
  const totalStored = readTotalCount(db);
  const latest = readLatestNews(db, latestLimit);
  db.close();

  return {
    asOf: new Date().toISOString(),
    dbPath,
    sources,
    fetchedCount: fetchedItems.length,
    insertedCount: insertStats.insertedCount,
    duplicateCount: insertStats.duplicateCount,
    totalStored,
    latest,
  };
}

function getLatestFromDb(options = {}) {
  const dbPath = resolveDbPath(options.dbPath);
  const db = openDatabase(dbPath);
  ensureSchema(db);
  const items = readLatestNews(db, options.limit);
  const total = readTotalCount(db);
  db.close();

  return {
    asOf: new Date().toISOString(),
    dbPath,
    count: total,
    items,
  };
}

module.exports = {
  RBI_RSS_INDEX_URL,
  RBI_PRESS_FALLBACK_URL,
  RBI_NOTIFICATIONS_FALLBACK_URL,
  SEBI_RSS_URL,
  DEFAULT_DB_PATH,
  resolveDbPath,
  PRIORITY_PATTERNS,
  normalizeWhitespace,
  stripHtml,
  normalizePublishedDate,
  normalizeFeedItem,
  extractPriorityTags,
  extractRbiFeedLinksFromHtml,
  discoverRbiFeedUrls,
  fetchRssItems,
  openDatabase,
  ensureSchema,
  insertNewsItems,
  readLatestNews,
  readTotalCount,
  runHarvester,
  getLatestFromDb,
};
