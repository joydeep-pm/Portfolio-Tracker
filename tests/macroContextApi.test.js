const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const handler = require("../api/macro-context");
const { openDatabase, ensureSchema } = require("../api/_lib/macroHarvester");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader() {},
  };
}

function seedDb(dbPath) {
  const db = openDatabase(dbPath);
  ensureSchema(db);
  db.prepare(
    `
      INSERT OR IGNORE INTO market_news (
        source_type, title, content_text, url, published_date, priority_tags, processed_by_llm
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    "RBI_RSS",
    "RBI updates supervisory norms",
    "RBI tightening in unsecured lending and digital lending controls.",
    "https://rbi.org.in/test-api-1",
    "2026-03-04T09:30:00.000Z",
    JSON.stringify(["RBI", "digital lending"]),
    0,
  );
  db.close();
}

test("macro-context analyze GET returns contract payload", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-context-api-get-"));
  const dbPath = path.join(tempDir, "macro_events.db");
  seedDb(dbPath);

  const previous = process.env.MACRO_EVENTS_DB_PATH;
  const previousProvider = process.env.BROKER_PROVIDER;
  process.env.MACRO_EVENTS_DB_PATH = dbPath;
  process.env.BROKER_PROVIDER = "kite-mcp";

  try {
    const res = createRes();
    await handler(
      {
        method: "GET",
        query: {
          route: "analyze",
          symbol: "SBIN",
          exchange: "all",
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(typeof res.body.sentiment_score, "number");
    assert.equal(typeof res.body.key_catalyst, "string");
    assert.equal(Array.isArray(res.body.impacted_clusters), true);
    assert.equal(typeof res.body.rationale_summary, "string");
    assert.equal(typeof res.body.meta.contractVersion, "string");
    assert.equal(typeof res.body.meta.traceId, "string");
  } finally {
    if (typeof previous === "string") process.env.MACRO_EVENTS_DB_PATH = previous;
    else delete process.env.MACRO_EVENTS_DB_PATH;
    if (typeof previousProvider === "string") process.env.BROKER_PROVIDER = previousProvider;
    else delete process.env.BROKER_PROVIDER;
  }
});

test("macro-context analyze POST supports theme hint payload", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-context-api-post-"));
  const dbPath = path.join(tempDir, "macro_events.db");
  seedDb(dbPath);

  const previous = process.env.MACRO_EVENTS_DB_PATH;
  const previousProvider = process.env.BROKER_PROVIDER;
  process.env.MACRO_EVENTS_DB_PATH = dbPath;
  process.env.BROKER_PROVIDER = "kite-mcp";

  try {
    const res = createRes();
    await handler(
      {
        method: "POST",
        query: { route: "analyze" },
        body: {
          exchange: "all",
          symbol: "SBIN",
          themeHint: "Banking & Financial Services",
          limit: 15,
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.symbol, "SBIN");
    assert.equal(Array.isArray(res.body.source_events), true);
  } finally {
    if (typeof previous === "string") process.env.MACRO_EVENTS_DB_PATH = previous;
    else delete process.env.MACRO_EVENTS_DB_PATH;
    if (typeof previousProvider === "string") process.env.BROKER_PROVIDER = previousProvider;
    else delete process.env.BROKER_PROVIDER;
  }
});
