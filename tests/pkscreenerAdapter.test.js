const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SUPPORTED_SCAN_TYPES,
  deterministicScanFlags,
  normalizeLiveScanPayload,
} = require("../api/_lib/pkscreenerAdapter");

test("deterministicScanFlags returns stable shape for instruments", () => {
  const rows = deterministicScanFlags(
    [
      { symbol: "RELIANCE", exchange: "NSE" },
      { symbol: "SBIN", exchange: "NSE" },
    ],
    "2026-03-04T10:00:00+05:30",
  );

  assert.equal(rows.length, 2);
  rows.forEach((row) => {
    assert.equal(typeof row.symbol, "string");
    assert.equal(typeof row.exchange, "string");
    assert.equal(Array.isArray(row.scanFlags), true);
    row.scanFlags.forEach((flag) => {
      assert.equal(SUPPORTED_SCAN_TYPES.includes(flag.type), true);
      assert.equal(typeof flag.score, "number");
    });
  });
});

test("normalizeLiveScanPayload normalizes mixed payload rows", () => {
  const rows = normalizeLiveScanPayload([
    {
      symbol: "reliance",
      exchange: "nse",
      scanFlags: [
        { type: "breakout", signal: "strong", score: 91.4 },
        { type: "unknown", signal: "x", score: 1 },
      ],
    },
    {
      tradingsymbol: "SBIN",
      exchange: "NSE",
      scanFlags: [{ scanType: "consolidation", label: "tight", score: 77 }],
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].symbol, "RELIANCE");
  assert.equal(rows[0].scanFlags.length, 1);
  assert.equal(rows[1].scanFlags[0].type, "consolidation");
});
