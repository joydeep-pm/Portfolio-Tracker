const fs = require("node:fs/promises");
const path = require("node:path");

const { bootstrapPortfolio } = require("./portfolioService");
const { saveEodSnapshot } = require("./snapshots");
const { getHotspotSnapshot } = require("./hotspotService");

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value) {
  const key = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }
  const date = new Date(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid date "${value}".`);
  }
  return date;
}

function listDateKeys(fromDate, toDate) {
  const from = parseDateKey(fromDate);
  const to = parseDateKey(toDate);
  if (from.getTime() > to.getTime()) {
    throw new Error(`Invalid range: fromDate (${fromDate}) is after toDate (${toDate}).`);
  }

  const keys = [];
  const cursor = new Date(from.getTime());
  while (cursor.getTime() <= to.getTime()) {
    keys.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function writeHotspotArchive(filePath, payload, skipExisting) {
  if (skipExisting && (await fileExists(filePath))) {
    return { written: false, reason: "exists" };
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { written: true };
}

async function runBackfillWindow(options = {}) {
  const fromDate = String(options.fromDate || "");
  const toDate = String(options.toDate || fromDate);
  const exchange = String(options.exchange || "all");
  const hotspotDir = path.resolve(process.cwd(), options.hotspotDir || "data/backfill/hotspots");
  const skipExisting = options.skipExisting !== false;

  const dateKeys = listDateKeys(fromDate, toDate);
  const output = [];

  const fetchPortfolio = options.fetchPortfolio || (async () => bootstrapPortfolio({ exchange, forceRefresh: true }));
  const fetchHotspots = options.fetchHotspots || (async () => getHotspotSnapshot({ exchange, forceRefresh: true }));
  const storeEod = options.storeEod || (async ({ snapshotDate, snapshot }) => saveEodSnapshot({ snapshotDate, snapshot }));

  for (const snapshotDate of dateKeys) {
    const snapshot = await fetchPortfolio();
    const eod = await storeEod({
      snapshotDate,
      snapshot,
    });

    const hotspots = await fetchHotspots();
    const hotspotArchive = {
      replayMode: true,
      snapshotDate,
      capturedAt: new Date().toISOString(),
      exchange,
      source: hotspots.source || "unknown",
      data: hotspots,
    };
    const archivePath = path.join(hotspotDir, `${snapshotDate}.json`);
    const archiveWrite = await writeHotspotArchive(archivePath, hotspotArchive, skipExisting);

    output.push({
      snapshotDate,
      eod,
      hotspotArchivePath: archivePath,
      hotspotArchiveWritten: archiveWrite.written,
      hotspotArchiveReason: archiveWrite.reason || null,
    });
  }

  return {
    fromDate,
    toDate,
    exchange,
    totalDays: dateKeys.length,
    results: output,
  };
}

module.exports = {
  runBackfillWindow,
  listDateKeys,
  parseDateKey,
};
