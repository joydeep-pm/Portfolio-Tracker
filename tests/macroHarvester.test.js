const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  extractRbiFeedLinksFromHtml,
  normalizeFeedItem,
  extractPriorityTags,
  openDatabase,
  ensureSchema,
  runHarvester,
} = require("../api/_lib/macroHarvester");

function xmlFeed(items = []) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${items
    .map(
      (item) =>
        `<item><title><![CDATA[${item.title}]]></title><description><![CDATA[${item.description}]]></description><link>${item.link}</link><guid>${
          item.guid || item.link
        }</guid><pubDate>${item.pubDate}</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
}

function createFetchStub(map) {
  return async function fetchStub(url) {
    const value = map.get(String(url));
    if (!value) {
      return {
        ok: false,
        status: 404,
        async text() {
          return "";
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async text() {
        return value;
      },
    };
  };
}

test("extractRbiFeedLinksFromHtml returns press and notification urls", () => {
  const html = `
    <a href="https://rbi.org.in/pressreleases_rss.xml">Press</a>
    <a href="https://rbi.org.in/notifications_rss.xml">Notifications</a>
  `;

  const result = extractRbiFeedLinksFromHtml(html);
  assert.equal(result.press, "https://rbi.org.in/pressreleases_rss.xml");
  assert.equal(result.notifications, "https://rbi.org.in/notifications_rss.xml");
});

test("normalizeFeedItem strips html and emits required fields", () => {
  const item = normalizeFeedItem(
    {
      title: "RBI updates digital lending framework",
      description: '<p>NBFC update with KYC changes for payments and capital markets.</p>',
      link: "https://rbi.org.in/scripts/NotificationUser.aspx?Id=999",
      pubDate: "Wed, 04 Mar 2026 12:00:00",
    },
    "RBI_RSS",
  );

  assert.equal(item.source_type, "RBI_RSS");
  assert.equal(item.url, "https://rbi.org.in/scripts/NotificationUser.aspx?Id=999");
  assert.equal(typeof item.content_text, "string");
  assert.equal(item.content_text.includes("<p>"), false);
  const tags = JSON.parse(item.priority_tags);
  ["RBI", "NBFC", "digital lending", "KYC", "payments", "capital markets"].forEach((tag) => {
    assert.equal(tags.includes(tag), true, `missing tag: ${tag}`);
  });
});

test("extractPriorityTags recognizes all required hard-priority tags", () => {
  const tags = extractPriorityTags(
    "RBI and SEBI update for NBFC digital lending with KYC, payments, and capital markets guidance",
  );

  ["RBI", "SEBI", "NBFC", "digital lending", "KYC", "payments", "capital markets"].forEach((tag) => {
    assert.equal(tags.includes(tag), true, `missing tag: ${tag}`);
  });
});

test("ensureSchema creates market_news table", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-schema-"));
  const dbPath = path.join(tempDir, "macro_events.db");
  const db = openDatabase(dbPath);
  ensureSchema(db);

  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='market_news'")
    .get();

  db.close();
  assert.equal(row.name, "market_news");
});

test("runHarvester inserts rows first run and dedupes second run", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-harvest-sqlite-"));
  const dbPath = path.join(tempDir, "macro_events.db");

  const feedMap = new Map();
  feedMap.set(
    "https://www.rbi.org.in/Scripts/rss.aspx",
    '<a href="https://rbi.org.in/pressreleases_rss.xml">Press</a><a href="https://rbi.org.in/notifications_rss.xml">Notifications</a>',
  );

  feedMap.set(
    "https://rbi.org.in/pressreleases_rss.xml",
    xmlFeed([
      {
        title: "RBI Press: capital markets update",
        description: "RBI press note",
        link: "https://rbi.org.in/press/1",
        pubDate: "Wed, 04 Mar 2026 10:00:00",
      },
    ]),
  );

  feedMap.set(
    "https://rbi.org.in/notifications_rss.xml",
    xmlFeed([
      {
        title: "RBI NBFC digital lending norms",
        description: "KYC and payments changes",
        link: "https://rbi.org.in/notif/1",
        pubDate: "Wed, 04 Mar 2026 11:00:00",
      },
    ]),
  );

  feedMap.set(
    "https://www.sebi.gov.in/sebirss.xml",
    xmlFeed([
      {
        title: "SEBI circular on capital markets",
        description: "SEBI release",
        link: "https://sebi.gov.in/circular/1",
        pubDate: "Wed, 04 Mar 2026 09:30:00",
      },
    ]),
  );

  const first = await runHarvester({
    fetchImpl: createFetchStub(feedMap),
    dbPath,
    maxItemsPerSource: 10,
    latestLimit: 10,
  });

  assert.equal(first.fetchedCount, 3);
  assert.equal(first.insertedCount, 3);
  assert.equal(first.duplicateCount, 0);
  assert.equal(first.totalStored, 3);

  const second = await runHarvester({
    fetchImpl: createFetchStub(feedMap),
    dbPath,
    maxItemsPerSource: 10,
    latestLimit: 10,
  });

  assert.equal(second.fetchedCount, 3);
  assert.equal(second.insertedCount, 0);
  assert.equal(second.duplicateCount, 3);
  assert.equal(second.totalStored, 3);
});
