const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const macroHandler = require("../api/macro");

function createRes() {
  const headers = new Map();
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
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

function xmlFeed(item) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><item><title><![CDATA[${item.title}]]></title><description><![CDATA[${item.description}]]></description><link>${item.link}</link><pubDate>${item.pubDate}</pubDate></item></channel></rss>`;
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

test("macro latest returns stable contract payload", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-api-latest-"));
  const dbPath = path.join(tempDir, "macro_events.db");
  const previousDbPath = process.env.MACRO_EVENTS_DB_PATH;
  process.env.MACRO_EVENTS_DB_PATH = dbPath;

  try {
    const res = createRes();
    await macroHandler(
      {
        method: "GET",
        query: { route: "latest", limit: "10" },
        headers: {},
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body.items), true);
    assert.equal(typeof res.body.meta.contractVersion, "string");
    assert.equal(typeof res.body.meta.traceId, "string");
    assert.equal(typeof res.getHeader("x-trace-id"), "string");
  } finally {
    if (typeof previousDbPath === "string") process.env.MACRO_EVENTS_DB_PATH = previousDbPath;
    else delete process.env.MACRO_EVENTS_DB_PATH;
  }
});

test("macro harvest route performs fetch + dedupe and returns counts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "macro-api-harvest-"));
  const dbPath = path.join(tempDir, "macro_events.db");

  const previousDbPath = process.env.MACRO_EVENTS_DB_PATH;
  process.env.MACRO_EVENTS_DB_PATH = dbPath;

  const originalFetch = global.fetch;

  const fetchMap = new Map();
  fetchMap.set(
    "https://www.rbi.org.in/Scripts/rss.aspx",
    '<a href="https://rbi.org.in/pressreleases_rss.xml">Press</a><a href="https://rbi.org.in/notifications_rss.xml">Notifications</a>',
  );
  fetchMap.set(
    "https://rbi.org.in/pressreleases_rss.xml",
    xmlFeed({
      title: "RBI press update",
      description: "Reserve Bank of India update",
      link: "https://rbi.org.in/press/x1",
      pubDate: "Wed, 04 Mar 2026 10:00:00",
    }),
  );
  fetchMap.set(
    "https://rbi.org.in/notifications_rss.xml",
    xmlFeed({
      title: "NBFC digital lending update",
      description: "RBI KYC payments circular",
      link: "https://rbi.org.in/notif/x2",
      pubDate: "Wed, 04 Mar 2026 11:00:00",
    }),
  );
  fetchMap.set(
    "https://www.sebi.gov.in/sebirss.xml",
    xmlFeed({
      title: "SEBI capital markets circular",
      description: "SEBI order",
      link: "https://sebi.gov.in/x3",
      pubDate: "Wed, 04 Mar 2026 09:00:00",
    }),
  );

  global.fetch = createFetchStub(fetchMap);

  try {
    const res = createRes();
    await macroHandler(
      {
        method: "GET",
        query: {
          route: "harvest",
          perSource: "10",
          limit: "10",
        },
        headers: {},
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.insertedCount, 3);
    assert.equal(res.body.duplicateCount, 0);
    assert.equal(Array.isArray(res.body.latest), true);
    assert.equal(typeof res.body.meta.contractVersion, "string");
    assert.equal(typeof res.body.meta.traceId, "string");
  } finally {
    global.fetch = originalFetch;
    if (typeof previousDbPath === "string") process.env.MACRO_EVENTS_DB_PATH = previousDbPath;
    else delete process.env.MACRO_EVENTS_DB_PATH;
  }
});
