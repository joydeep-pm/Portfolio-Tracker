const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeBootstrapPayload,
  normalizePollPayload,
  mapComparisonSeries,
  getAdaptivePollIntervalMs,
  nextBackoffMs,
  shouldMarkStale,
  mergeMarketState,
  normalizeMacroContextPayload,
  DataValidationError,
} = require("../adapterCore.js");

function makeReturns(seed = 1) {
  return {
    "1D": seed,
    "1W": seed + 1,
    "1M": seed + 2,
    "6M": seed + 3,
    YTD: seed + 4,
  };
}

function makeBootstrap() {
  return {
    asOf: "2026-03-01T09:47:10+05:30",
    cursor: "abc_1",
    heads: [
      {
        id: "head-1",
        name: "Banking",
        momentum: makeReturns(1),
        clusterIds: ["cluster-1"],
      },
    ],
    clusters: [
      {
        id: "cluster-1",
        headId: "head-1",
        headName: "Banking",
        name: "Private Banks",
        momentum: makeReturns(2),
      },
    ],
    stocks: [
      {
        id: "stock-1",
        symbol: "HDFCB123",
        exchange: "NSE",
        name: "HDFC Bank",
        clusterId: "cluster-1",
        returns: makeReturns(3),
      },
    ],
  };
}

test("normalizeBootstrapPayload accepts valid payload", () => {
  const payload = normalizeBootstrapPayload(makeBootstrap());
  assert.equal(payload.heads.length, 1);
  assert.equal(payload.clusters.length, 1);
  assert.equal(payload.stocks.length, 1);
  assert.equal(payload.stocks[0].exchange, "NSE");
});

test("normalizeBootstrapPayload rejects unknown exchange", () => {
  const invalid = makeBootstrap();
  invalid.stocks[0].exchange = "NYSE";

  assert.throws(() => normalizeBootstrapPayload(invalid), DataValidationError);
});

test("normalizePollPayload rejects incomplete returns object", () => {
  assert.throws(
    () =>
      normalizePollPayload({
        asOf: "2026-03-01T09:47:15+05:30",
        cursor: "abc_2",
        updates: {
          stocks: [
            {
              id: "stock-1",
              symbol: "HDFCB123",
              exchange: "NSE",
              name: "HDFC Bank",
              clusterId: "cluster-1",
              returns: { "1D": 1 },
            },
          ],
          clusters: [],
          heads: [],
        },
      }),
    DataValidationError,
  );
});

test("adaptive poll interval follows market-hours policy", () => {
  const market = new Date("2026-03-02T10:00:00+05:30");
  const off = new Date("2026-03-02T21:00:00+05:30");

  assert.equal(getAdaptivePollIntervalMs({ date: market, hidden: false }), 5000);
  assert.equal(getAdaptivePollIntervalMs({ date: market, hidden: true }), 10000);
  assert.equal(getAdaptivePollIntervalMs({ date: off, hidden: false }), 60000);
});

test("nextBackoffMs caps exponential retry at 60s", () => {
  assert.equal(nextBackoffMs(1), 5000);
  assert.equal(nextBackoffMs(2), 10000);
  assert.equal(nextBackoffMs(3), 20000);
  assert.equal(nextBackoffMs(8), 60000);
});

test("shouldMarkStale triggers after repeated failures or stale market-hours gap", () => {
  const now = Date.now();
  assert.equal(
    shouldMarkStale({
      consecutiveFailures: 2,
      lastSuccessAtMs: now - 1000,
      nowMs: now,
      marketHours: true,
    }),
    true,
  );

  assert.equal(
    shouldMarkStale({
      consecutiveFailures: 0,
      lastSuccessAtMs: now - 25000,
      nowMs: now,
      marketHours: true,
    }),
    true,
  );

  assert.equal(
    shouldMarkStale({
      consecutiveFailures: 0,
      lastSuccessAtMs: now - 25000,
      nowMs: now,
      marketHours: false,
    }),
    false,
  );
});

test("mergeMarketState patches stocks by id and keeps safe when updates are empty", () => {
  const current = makeBootstrap();
  const merged = mergeMarketState(current, {
    asOf: "2026-03-01T09:47:20+05:30",
    cursor: "abc_3",
    updates: {
      stocks: [
        {
          ...current.stocks[0],
          returns: makeReturns(10),
        },
      ],
      clusters: [],
      heads: [],
    },
  });

  assert.equal(merged.cursor, "abc_3");
  assert.equal(merged.stocks[0].returns["1D"], 10);

  const unchanged = mergeMarketState(current, {
    asOf: "2026-03-01T09:47:21+05:30",
    cursor: "abc_4",
    updates: {
      stocks: [],
      clusters: [],
      heads: [],
    },
  });

  assert.equal(unchanged.stocks[0].returns["1D"], current.stocks[0].returns["1D"]);
});

test("mapComparisonSeries converts payload to chart points and tolerates empty cluster series", () => {
  const mapped = mapComparisonSeries({
    asOf: "2026-03-01T09:47:15+05:30",
    window: "1M",
    exchange: "all",
    seriesByClusterId: {
      "cluster-1": [
        { ts: "2026-03-01T09:40:15+05:30", value: 0.5 },
        { ts: "2026-03-01T09:41:15+05:30", value: 0.9 },
      ],
      "cluster-2": [],
    },
  });

  assert.equal(mapped.get("cluster-1").length, 2);
  assert.equal(mapped.get("cluster-1")[1].y, 0.9);
  assert.equal(mapped.get("cluster-2").length, 0);
});

test("normalizeMacroContextPayload validates macro context schema", () => {
  const payload = normalizeMacroContextPayload({
    asOf: "2026-03-04T10:20:00+05:30",
    exchange: "all",
    symbol: "SBIN",
    sentiment_score: -0.24,
    key_catalyst: "RBI tightens unsecured lending norms",
    impacted_clusters: [
      {
        cluster_id: "cluster-1",
        cluster_name: "Banking & Financial Services PSU Chain",
        head_name: "Banking & Financial Services",
        impact_score: 0.88,
      },
    ],
    rationale_summary: "Catalyst turned defensive. Banking clusters are most exposed.",
    considered_events: 5,
    processed_count: 5,
    sources: ["RBI_RSS", "SEBI_RSS"],
    source_events: [
      {
        id: 101,
        source_type: "RBI_RSS",
        title: "Circular",
        url: "https://www.rbi.org.in/test",
        published_date: "2026-03-04T10:00:00.000Z",
        priority_tags: ["RBI", "NBFC"],
        sentiment: -0.4,
        relevance_score: 1.2,
        impact_score: 1.1,
      },
    ],
    model: "heuristic-v1",
  });

  assert.equal(payload.symbol, "SBIN");
  assert.equal(payload.impacted_clusters.length, 1);
  assert.equal(payload.source_events.length, 1);
});
