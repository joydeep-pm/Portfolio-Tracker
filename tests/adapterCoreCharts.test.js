const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeChartReturnsPayload,
  normalizeDecisionMarkersPayload,
  normalizePeerRelativeStrengthPayload,
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

test("normalizeChartReturnsPayload accepts normalized comparison payload with source", () => {
  const payload = normalizeChartReturnsPayload({
    asOf: "2026-03-05T10:30:00.000Z",
    window: "1M",
    exchange: "all",
    source: "mock-market",
    seriesByClusterId: {
      "cluster-1": [
        { ts: "2026-03-05T10:00:00.000Z", value: 0.8 },
        { ts: "2026-03-05T10:05:00.000Z", value: 1.1 },
      ],
    },
  });

  assert.equal(payload.window, "1M");
  assert.equal(payload.source, "mock-market");
  assert.equal(payload.seriesByClusterId["cluster-1"].length, 2);
});

test("normalizeDecisionMarkersPayload validates marker schema", () => {
  const payload = normalizeDecisionMarkersPayload({
    asOf: "2026-03-05T10:30:00.000Z",
    symbol: "SBIN",
    exchange: "NSE",
    clusterId: "cluster-1",
    window: "1M",
    source: "mock-market",
    markers: [
      {
        time: 1761112200,
        action: "BUY",
        confidence: 76.4,
        text: "BUY 76.4%",
        color: "#1aa56f",
        shape: "arrowUp",
        position: "belowBar",
      },
    ],
  });

  assert.equal(payload.markers.length, 1);
  assert.equal(payload.markers[0].action, "BUY");
});

test("normalizeDecisionMarkersPayload rejects invalid marker shape", () => {
  assert.throws(
    () =>
      normalizeDecisionMarkersPayload({
        asOf: "2026-03-05T10:30:00.000Z",
        window: "1M",
        source: "mock-market",
        markers: [
          {
            time: 1761112200,
            action: "BUY",
            confidence: 76.4,
            text: "BUY 76.4%",
            color: "#1aa56f",
            shape: "triangle",
            position: "belowBar",
          },
        ],
      }),
    DataValidationError,
  );
});

test("normalizePeerRelativeStrengthPayload accepts anchor/peer series payload", () => {
  const payload = normalizePeerRelativeStrengthPayload({
    asOf: "2026-03-05T10:30:00.000Z",
    exchange: "all",
    window: "1M",
    source: "mock-market",
    cluster: {
      id: "cluster-1",
      name: "Banking Cluster",
      headId: "head-1",
      headName: "Banking & Financial Services",
    },
    anchor: {
      symbol: "SBIN",
      exchange: "NSE",
      name: "SBI",
      returns: makeReturns(1),
    },
    peers: [
      {
        symbol: "HDFCBANK",
        exchange: "NSE",
        name: "HDFC Bank",
        competitorScore: 3.4,
        returns: makeReturns(2),
      },
      {
        symbol: "ICICIBANK",
        exchange: "NSE",
        name: "ICICI Bank",
        competitorScore: 2.8,
        returns: makeReturns(3),
      },
    ],
    seriesBySymbol: {
      SBIN: [
        { ts: "2026-03-05T10:00:00.000Z", value: 0.8 },
        { ts: "2026-03-05T10:05:00.000Z", value: 1.1 },
      ],
      HDFCBANK: [
        { ts: "2026-03-05T10:00:00.000Z", value: 0.6 },
        { ts: "2026-03-05T10:05:00.000Z", value: 0.9 },
      ],
      ICICIBANK: [
        { ts: "2026-03-05T10:00:00.000Z", value: 0.5 },
        { ts: "2026-03-05T10:05:00.000Z", value: 0.85 },
      ],
    },
  });

  assert.equal(payload.anchor.symbol, "SBIN");
  assert.equal(payload.peers.length, 2);
  assert.equal(payload.seriesBySymbol.SBIN.length, 2);
});

test("normalizePeerRelativeStrengthPayload rejects invalid exchange", () => {
  assert.throws(
    () =>
      normalizePeerRelativeStrengthPayload({
        asOf: "2026-03-05T10:30:00.000Z",
        exchange: "all",
        window: "1M",
        source: "mock-market",
        cluster: {
          id: "cluster-1",
          name: "Banking Cluster",
          headId: "head-1",
          headName: "Banking & Financial Services",
        },
        anchor: {
          symbol: "SBIN",
          exchange: "NASDAQ",
          name: "SBI",
          returns: makeReturns(1),
        },
        peers: [],
        seriesBySymbol: {},
      }),
    DataValidationError,
  );
});
