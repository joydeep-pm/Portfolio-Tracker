const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { listDateKeys, parseDateKey, runBackfillWindow } = require("../api/_lib/backfillService");

test("listDateKeys returns inclusive date range", () => {
  const keys = listDateKeys("2026-03-01", "2026-03-03");
  assert.deepEqual(keys, ["2026-03-01", "2026-03-02", "2026-03-03"]);
});

test("parseDateKey and listDateKeys reject invalid ranges", () => {
  assert.throws(() => parseDateKey("2026/03/01"), /Invalid date/);
  assert.throws(() => listDateKeys("2026-03-04", "2026-03-01"), /Invalid range/);
});

test("runBackfillWindow writes hotspot archives and reports results", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "backfill-test-"));

  const payload = await runBackfillWindow({
    fromDate: "2026-03-01",
    toDate: "2026-03-02",
    exchange: "all",
    hotspotDir: dir,
    fetchPortfolio: async () => ({
      asOf: "2026-03-04T00:00:00Z",
      rows: [],
      summary: {},
    }),
    fetchHotspots: async () => ({
      asOf: "2026-03-04T00:00:00Z",
      source: "test",
      hotspots: [],
      coverage: {},
    }),
    storeEod: async ({ snapshotDate }) => ({ stored: true, snapshotDate, mode: "memory" }),
  });

  assert.equal(payload.totalDays, 2);
  assert.equal(payload.results.length, 2);
  const firstPath = payload.results[0].hotspotArchivePath;
  assert.equal(fs.existsSync(firstPath), true);
});

test("runBackfillWindow honors skipExisting for hotspot archives", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "backfill-existing-test-"));
  const archivePath = path.join(dir, "2026-03-01.json");
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(archivePath, "{}\n", "utf8");

  const payload = await runBackfillWindow({
    fromDate: "2026-03-01",
    exchange: "all",
    hotspotDir: dir,
    fetchPortfolio: async () => ({ asOf: "2026-03-04T00:00:00Z", rows: [], summary: {} }),
    fetchHotspots: async () => ({ asOf: "2026-03-04T00:00:00Z", source: "test", hotspots: [] }),
    storeEod: async ({ snapshotDate }) => ({ stored: true, snapshotDate }),
    skipExisting: true,
  });

  assert.equal(payload.results[0].hotspotArchiveWritten, false);
  assert.equal(payload.results[0].hotspotArchiveReason, "exists");
});
