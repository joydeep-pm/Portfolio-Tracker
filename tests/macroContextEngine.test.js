const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { openDatabase, ensureSchema } = require("../api/_lib/macroHarvester");
const { analyzeMacroContext } = require("../api/_lib/macroContextEngine");

function insertSeed(db, rows) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO market_news (
      source_type,
      title,
      content_text,
      url,
      published_date,
      priority_tags,
      processed_by_llm
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    stmt.run(
      row.source_type,
      row.title,
      row.content_text,
      row.url,
      row.published_date,
      JSON.stringify(row.priority_tags || []),
      row.processed_by_llm ? 1 : 0,
    );
  });
}

test("analyzeMacroContext returns required payload and marks queue processed", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-context-engine-"));
  const dbPath = path.join(tempDir, "macro_events.db");

  const db = openDatabase(dbPath);
  ensureSchema(db);
  insertSeed(db, [
    {
      source_type: "RBI_RSS",
      title: "RBI tightens unsecured lending norms for NBFC oversight",
      content_text: "RBI issued guidance tightening digital lending compliance and provisioning norms for NBFC segments.",
      url: "https://rbi.org.in/test-1",
      published_date: "2026-03-04T09:00:00.000Z",
      priority_tags: ["RBI", "NBFC", "digital lending"],
      processed_by_llm: false,
    },
    {
      source_type: "SEBI_RSS",
      title: "SEBI updates risk disclosure framework for capital markets",
      content_text: "SEBI circular asks brokers and intermediaries to strengthen risk disclosure and KYC controls.",
      url: "https://sebi.gov.in/test-2",
      published_date: "2026-03-04T08:45:00.000Z",
      priority_tags: ["SEBI", "capital markets", "KYC"],
      processed_by_llm: false,
    },
  ]);
  db.close();

  const previousProvider = process.env.BROKER_PROVIDER;
  process.env.BROKER_PROVIDER = "kite-mcp";
  try {
    const payload = await analyzeMacroContext({
      dbPath,
      exchange: "all",
      symbol: "SBIN",
      limit: 20,
      includePromptDraft: true,
    });

    assert.equal(typeof payload.sentiment_score, "number");
    assert.equal(payload.sentiment_score >= -1 && payload.sentiment_score <= 1, true);
    assert.equal(typeof payload.key_catalyst, "string");
    assert.equal(Array.isArray(payload.impacted_clusters), true);
    assert.equal(payload.impacted_clusters.length > 0, true);
    assert.equal(typeof payload.rationale_summary, "string");
    assert.equal(payload.considered_events > 0, true);
    assert.equal(payload.processed_count > 0, true);
    assert.equal(typeof payload.promptDraft?.system, "string");
    assert.equal(typeof payload.promptDraft?.user, "string");

    const verifyDb = openDatabase(dbPath);
    const row = verifyDb.prepare("SELECT COUNT(1) AS pending FROM market_news WHERE processed_by_llm = 0").get();
    verifyDb.close();
    assert.equal(Number(row.pending || 0), 0);
  } finally {
    if (typeof previousProvider === "string") process.env.BROKER_PROVIDER = previousProvider;
    else delete process.env.BROKER_PROVIDER;
  }
});

test("analyzeMacroContext includeProcessed controls fallback behavior", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-context-include-"));
  const dbPath = path.join(tempDir, "macro_events.db");

  const db = openDatabase(dbPath);
  ensureSchema(db);
  insertSeed(db, [
    {
      source_type: "RBI_RSS",
      title: "RBI liquidity guidance",
      content_text: "RBI says liquidity remains adequate.",
      url: "https://rbi.org.in/test-3",
      published_date: "2026-03-04T07:10:00.000Z",
      priority_tags: ["RBI"],
      processed_by_llm: true,
    },
  ]);
  db.close();

  const previousProvider = process.env.BROKER_PROVIDER;
  process.env.BROKER_PROVIDER = "kite-mcp";
  try {
    const pendingOnly = await analyzeMacroContext({
      dbPath,
      includeProcessed: false,
      limit: 10,
    });
    assert.equal(pendingOnly.considered_events, 0);

    const includeAll = await analyzeMacroContext({
      dbPath,
      includeProcessed: true,
      limit: 10,
    });
    assert.equal(includeAll.considered_events > 0, true);
  } finally {
    if (typeof previousProvider === "string") process.env.BROKER_PROVIDER = previousProvider;
    else delete process.env.BROKER_PROVIDER;
  }
});
