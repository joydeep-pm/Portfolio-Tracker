#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { SEED_CATALOG_PATH, normalizeCatalog, DEFAULT_CATALOG_PATH } = require("../api/_lib/thematicCatalog");

const TARGET_STOCKS = 2486;
const TARGET_CLUSTERS = 175;

const NSE_INDEX_LIST_URL = "https://www.nseindia.com/api/allIndices";
const NSE_INDEX_STOCKS_URL = "https://www.nseindia.com/api/equity-stockIndices";
const NSE_EQUITY_MASTER_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv";
const BSE_SCRIPS_URL = "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w";
const NETWORK_TIMEOUT_MS = 25_000;

const LIVE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Portfolio-Tracker-Ingest/1.0)",
  Accept: "application/json, text/plain, */*",
};

const NSE_HEADERS = {
  ...LIVE_HEADERS,
  Referer: "https://www.nseindia.com/market-data/live-market-indices",
};

const BSE_HEADERS = {
  ...LIVE_HEADERS,
  Accept: "application/json; charset=utf-8",
  Referer: "https://www.bseindia.com/corporates/List_Scrips.html",
  Origin: "https://www.bseindia.com",
};

function parseArgs(argv) {
  const options = {
    output: DEFAULT_CATALOG_PATH,
    forceSeed: false,
    requireLive: false,
    targetStocks: TARGET_STOCKS,
    targetClusters: TARGET_CLUSTERS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--force-seed") {
      options.forceSeed = true;
      continue;
    }
    if (arg === "--require-live") {
      options.requireLive = true;
      continue;
    }
    if (arg === "--target-stocks") {
      const value = argv[i + 1];
      if (!value || String(value).startsWith("--")) throw new Error("Missing value for --target-stocks");
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid --target-stocks value "${value}"`);
      options.targetStocks = parsed;
      i += 1;
      continue;
    }
    if (arg === "--target-clusters") {
      const value = argv[i + 1];
      if (!value || String(value).startsWith("--")) throw new Error("Missing value for --target-clusters");
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid --target-clusters value "${value}"`);
      options.targetClusters = parsed;
      i += 1;
      continue;
    }
    if (arg === "--output") {
      const value = argv[i + 1];
      if (!value || String(value).startsWith("--")) throw new Error("Missing value for --output");
      options.output = path.resolve(process.cwd(), String(value));
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument "${arg}"`);
  }

  if (options.forceSeed && options.requireLive) {
    throw new Error("--require-live cannot be used with --force-seed");
  }

  return options;
}

const HELP_TEXT = `Usage:
  node scripts/ingest-bharatfintrack.js [--output <path>] [--force-seed] [--require-live]

Notes:
  - Attempts live NSE/BSE ingest first.
  - Falls back to python BharatFinTrack if live endpoints are unavailable.
  - Falls back to repository seed data if BharatFinTrack is unavailable.
Options:
  --require-live          Fail if live NSE/BSE ingest cannot satisfy requested targets.
  --target-stocks <n>     Target stock universe size (default: 2486).
  --target-clusters <n>   Target micro-cluster count (default: 175).
`;

function toText(value, fallback = "") {
  return String(value || "").trim() || fallback;
}

function safeJsonParse(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function sanitizeError(error) {
  return toText(error?.message || error, "unknown");
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = Number.isFinite(options.timeoutMs) ? options.timeoutMs : NETWORK_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: options.headers || LIVE_HEADERS,
      method: options.method || "GET",
      body: options.body,
      signal: controller.signal,
    });
    const raw = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      raw: "",
      error: sanitizeError(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const output = await fetchText(url, options);
  if (!output.ok) return output;
  const payload = safeJsonParse(output.raw);
  if (!payload) return { ...output, ok: false, error: "invalid-json" };
  return { ...output, payload };
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quote = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quote && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quote = !quote;
      }
      continue;
    }
    if (char === "," && !quote) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function normalizeSectorTag(value, fallback = "Uncategorized") {
  return toText(value, fallback)
    .replace(/\s+/g, " ")
    .replace(/-/g, " ")
    .replace(/\bindia\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyIndexCategory(name) {
  const value = toText(name).toLowerCase();
  if (value.includes("nifty") || value.includes("nse")) return "broad";
  if (["momentum", "quality", "value", "alpha", "equal", "enhanced", "low-volatility", "low volatility", "strategy"].some((token) => value.includes(token))) return "strategy";
  if (value.includes("total market") || value.includes("equal weight") || value.includes("enhanced")) return "variant";
  return "sector";
}

function normalizeCategory(value) {
  const key = toText(value, "uncategorized").toLowerCase();
  if (["broad", "sector", "thematic", "strategy", "variant"].includes(key)) return key;
  return "uncategorized";
}

function normalizeNseCsvRows(content) {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const symbolIndex = headers.findIndex((header) => header.toUpperCase() === "SYMBOL");
  const seriesIndex = headers.findIndex((header) => header.toUpperCase() === "SERIES");
  const nameIndex = headers.findIndex((header) => header.toUpperCase() === "NAME OF COMPANY");
  if (symbolIndex === -1 || seriesIndex === -1) return [];

  const output = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const values = splitCsvLine(lines[rowIndex]);
    const symbol = toText(values[symbolIndex]).toUpperCase();
    if (!symbol) continue;
    if (toText(values[seriesIndex]).toUpperCase() !== "EQ") continue;
    output.push({
      exchange: "NSE",
      symbol,
      name: toText(values[nameIndex], symbol),
      source: "nse-master",
    });
  }
  return output;
}

async function fetchNseIndexList() {
  const response = await fetchJson(NSE_INDEX_LIST_URL, { headers: NSE_HEADERS });
  if (!response.ok || !response.payload) return [];
  const payload = response.payload;
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row) => toText(row?.index)).filter(Boolean);
}

async function fetchNseIndexConstituents(indexName) {
  if (!indexName) return [];
  const url = `${NSE_INDEX_STOCKS_URL}?index=${encodeURIComponent(indexName)}`;
  const response = await fetchJson(url, { headers: NSE_HEADERS });
  if (!response.ok || !response.payload) return [];

  const payload = response.payload;
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const indexUpper = indexName.toUpperCase();
  const seen = new Set();
  const out = [];
  for (const item of rows) {
    const symbol = toText(item?.symbol).toUpperCase();
    if (!symbol || symbol === indexUpper || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({
      exchange: "NSE",
      symbol,
      source: "nse-index",
      name: toText(item?.meta?.companyName, symbol),
    });
  }
  return out;
}

async function fetchNseMaster() {
  const response = await fetchJson(NSE_EQUITY_MASTER_URL, { headers: LIVE_HEADERS });
  if (!response.ok || !response.raw) return [];
  return normalizeNseCsvRows(response.raw);
}

async function fetchBseActiveScrips() {
  const query = new URLSearchParams({ flag: "0", segment: "EQ" }).toString();
  const response = await fetchJson(`${BSE_SCRIPS_URL}?${query}`, { headers: BSE_HEADERS });
  if (!response.ok || !Array.isArray(response.payload)) return [];

  const out = [];
  for (const row of response.payload) {
    if (String(row?.Status || "").trim().toLowerCase() !== "active") continue;
    const symbol = toText(row?.scrip_id || row?.symbol || row?.Scrip_Name || row?.symbol_name).toUpperCase();
    if (!symbol) continue;
    const mktcapText = toText(row?.Mktcap || row?.mkt_cap || row?.MARKET_CAP || "0").replace(/,/g, "");
    const mktcap = Number.parseFloat(mktcapText || "0");
    out.push({
      exchange: "BSE",
      symbol,
      name: toText(row?.Scrip_Name || row?.Issuer_Name || symbol),
      source: "bse-master",
      sector: toText(row?.INDUSTRY || row?.GROUP || row?.Industry),
      mktcap: Number.isFinite(mktcap) ? mktcap : 0,
    });
  }
  return out;
}

function dedupeByExchangeSymbol(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const exchange = toText(item.exchange, "NSE").toUpperCase();
    const symbol = toText(item.symbol).toUpperCase();
    if (!symbol || !exchange) continue;
    const key = `${exchange}:${symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, exchange, symbol });
  }
  return out;
}

async function mapWithConcurrency(items, limit, worker) {
  const list = Array.isArray(items) ? items : [];
  const max = Math.max(1, Math.min(8, Number.parseInt(String(limit || 1), 10)));
  const out = new Array(list.length);
  let cursor = 0;

  async function runOne() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(list[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(max, list.length) }, () => runOne()));
  return out;
}

function toConstituentKey(item) {
  const exchange = toText(item?.exchange, "NSE").toUpperCase();
  const symbol = toText(item?.symbol).toUpperCase();
  if (!symbol) return "";
  return `${exchange}:${symbol}`;
}

function splitLargestBucketForTarget(buckets, targetClusters) {
  const working = buckets.map((bucket) => ({ ...bucket, symbolRows: bucket.symbolRows.slice() }));
  let guard = 0;

  while (working.length < targetClusters && guard < 2000) {
    const candidate = working
      .map((bucket, index) => ({ index, size: bucket.symbolRows.length }))
      .filter((item) => item.size > 1)
      .sort((a, b) => b.size - a.size || a.index - b.index)[0];

    if (!candidate) break;

    const selected = working[candidate.index];
    const half = Math.floor(selected.symbolRows.length / 2);
    const left = selected.symbolRows.slice(0, half);
    const right = selected.symbolRows.slice(half);

    if (!left.length || !right.length) break;

    const tagBase = toText(selected.tag, selected.idSeed);

    working.splice(candidate.index, 1, {
      ...selected,
      tag: `${tagBase}-A`,
      name: `${selected.name} A`,
      source: selected.source,
      symbolRows: left,
    }, {
      ...selected,
      tag: `${tagBase}-B`,
      name: `${selected.name} B`,
      source: selected.source,
      symbolRows: right,
    });

    guard += 1;
  }

  return working;
}

function mergeSmallestBucketsToTarget(buckets, targetClusters) {
  const working = buckets.map((bucket) => ({ ...bucket, symbolRows: bucket.symbolRows.slice() }));
  while (working.length > targetClusters) {
    const smallest = working
      .map((bucket, index) => ({ index, size: bucket.symbolRows.length }))
      .sort((a, b) => a.size - b.size || a.index - b.index)
      .slice(0, 2);

    if (smallest.length < 2) break;

    const first = smallest[0];
    const second = smallest[1];
    const mergedSymbolRows = working[first.index].symbolRows.concat(working[second.index].symbolRows);
    const mergedName = `${working[first.index].name} + ${working[second.index].name}`;
    const merged = {
      ...working[first.index],
      idSeed: `${working[first.index].idSeed}-${working[second.index].idSeed}`,
      name: mergedName,
      source: `${working[first.index].source},${working[second.index].source}`,
      category: classifyIndexCategory(mergedName),
      sectorTag: `${normalizeSectorTag(working[first.index].sectorTag)} + ${normalizeSectorTag(
        working[second.index].sectorTag,
      )}`,
      symbolRows: mergedSymbolRows,
      tag: `${toText(working[first.index].tag, "A")}-${toText(working[second.index].tag, "B")}`,
    };

    const firstIndex = Math.max(first.index, second.index);
    const secondIndex = Math.min(first.index, second.index);
    working.splice(firstIndex, 1);
    working.splice(secondIndex, 1, merged);
  }
  return working;
}

function trimBucketsToStockTarget(buckets, targetStocks) {
  const target = Number.parseInt(String(targetStocks), 10);
  if (!Number.isFinite(target) || target <= 0) return buckets;
  if (buckets.length > target) {
    throw new Error(`cannot satisfy stock target ${target} with ${buckets.length} clusters`);
  }

  let total = buckets.reduce((sum, bucket) => sum + bucket.constituents.length, 0);
  if (total <= target) return buckets;

  while (total > target) {
    let victim = -1;
    for (let i = 0; i < buckets.length; i += 1) {
      const len = buckets[i].constituents.length;
      if (len > 1 && (victim === -1 || len > buckets[victim].constituents.length)) {
        victim = i;
      }
    }
    if (victim === -1) break;
    buckets[victim].constituents.pop();
    total -= 1;
  }

  return buckets;
}

function normalizeToBucketCounts(clusters, targetStocks, targetClusters, masterPool) {
  const working = clusters.map((bucket) => ({ ...bucket, constituents: [] }));
  const assigned = new Set();
  const allKeys = new Set();

  const assignFromRows = (bucket, rows) => {
    for (const row of rows) {
      const key = toConstituentKey(row);
      if (!key || assigned.has(key)) continue;
      assigned.add(key);
      bucket.constituents.push(key);
      allKeys.add(key);
    }
  };

  for (const bucket of working) {
    assignFromRows(bucket, bucket.symbolRows);
  }

  const masterRemaining = [];
  const masterSet = new Set();
  const orderedMaster = masterPool.slice().map((item) => toConstituentKey(item)).filter(Boolean);
  for (const key of orderedMaster) {
    if (!assigned.has(key) && !masterSet.has(key)) {
      masterSet.add(key);
      masterRemaining.push(key);
    }
  }

  let fallbackCursor = 0;
  while (working.length < targetClusters && fallbackCursor < masterRemaining.length) {
    const key = masterRemaining[fallbackCursor];
    fallbackCursor += 1;
    const source = masterPool.find((item) => toConstituentKey(item) === key);
    working.push({
      idSeed: `fallback-${working.length + 1}`,
      name: `Live Universe ${working.length + 1}`,
      source: source?.source || "live-universe",
      category: "variant",
      sectorTag: "Live Universe",
      symbolRows: [],
      tag: `fallback-${working.length + 1}`,
      constituents: [key],
    });
    assigned.add(key);
    allKeys.add(key);
  }

  for (let i = 0; i < working.length; i += 1) {
    if (!working[i].constituents.length && masterRemaining.length) {
      const key = masterRemaining.shift();
      if (!key) continue;
      working[i].constituents.push(key);
      assigned.add(key);
      allKeys.add(key);
    }
  }

  let cursor = 0;
  while (allKeys.size < targetStocks && masterRemaining.length) {
    const key = masterRemaining.shift();
    if (!key || assigned.has(key)) continue;
    const bucket = working[cursor % working.length];
    bucket.constituents.push(key);
    assigned.add(key);
    allKeys.add(key);
    cursor += 1;
  }

  const dedupeCandidates = working.map((bucket) => ({
    ...bucket,
    constituents: Array.from(new Set(bucket.constituents)),
  }));
  const trimmed = trimBucketsToStockTarget(dedupeCandidates, targetStocks);

  const normalized = trimmed.map((bucket, index) => {
    const seen = new Set();
    const constituents = [];
    for (const key of bucket.constituents) {
      if (!key || seen.has(key)) continue;
      seen.add(key);
      constituents.push(key);
    }
    return {
      id: `cluster-${String(index + 1).padStart(3, "0")}`,
      name: bucket.name,
      category: normalizeCategory(bucket.category),
      sectorTag: bucket.sectorTag || "Live Universe",
      source: bucket.source || "nse-bse-live",
      constituents,
    };
  });

  const categories = Array.from(new Set(normalized.map((bucket) => bucket.category))).filter(Boolean);
  const stockTotal = normalized.reduce((count, bucket) => count + bucket.constituents.length, 0);

  return {
    categories,
    indices: normalized,
    stockTotal,
    uniqueTotal: allKeys.size,
  };
}

function buildLiveThematicPayload(targetStocks, targetClusters) {
  return (async () => {
    const [indexNames, nseMasterRows, bseRows] = await Promise.all([
      fetchNseIndexList(),
      fetchNseMaster(),
      fetchBseActiveScrips(),
    ]);

    const indexConstituents = await mapWithConcurrency(indexNames, 6, (name) => fetchNseIndexConstituents(name));

    const indexBuckets = [];
    for (let i = 0; i < indexNames.length; i += 1) {
      const name = toText(indexNames[i]);
      if (!name) continue;
      const constituents = dedupeByExchangeSymbol(indexConstituents[i] || []);
      if (!constituents.length) continue;
      indexBuckets.push({
        idSeed: `idx-${i + 1}`,
        tag: `idx-${i + 1}`,
        name,
        source: "nse-index",
        category: classifyIndexCategory(name),
        sectorTag: normalizeSectorTag(name, "NSE"),
        symbolRows: constituents,
      });
    }

    if (!indexBuckets.length) {
      throw new Error("live index ingestion returned no index constituents");
    }

    const masterPool = dedupeByExchangeSymbol(nseMasterRows.concat(bseRows));
    if (!masterPool.length) {
      throw new Error("live master pool returned no symbols");
    }

    const splitBuckets = splitLargestBucketForTarget(indexBuckets, targetClusters);
    const mergedBuckets = mergeSmallestBucketsToTarget(splitBuckets, targetClusters);
    const normalizedBuckets = mergedBuckets.filter((bucket) => bucket.symbolRows && bucket.symbolRows.length);

    if (normalizedBuckets.length < targetClusters) {
      throw new Error(`cluster build ended at ${normalizedBuckets.length}, expected ${targetClusters}`);
    }

    const built = normalizeToBucketCounts(normalizedBuckets, targetStocks, targetClusters, masterPool);
    if (built.indices.length !== targetClusters) {
      throw new Error(`cluster build ended at ${built.indices.length}, expected ${targetClusters}`);
    }
    if (built.stockTotal !== targetStocks) {
      throw new Error(`stock build ended at ${built.stockTotal}, expected ${targetStocks}`);
    }
    if (built.uniqueTotal !== targetStocks) {
      throw new Error(`stock unique build ended at ${built.uniqueTotal}, expected ${targetStocks}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      source: "nse-bse-live",
      categories: built.categories,
      indices: built.indices,
    };
  })();
}

function runPythonExtract() {
  const pythonCode = `
import json
try:
    import BharatFinTrack
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"import-failed:{exc}"}))
    raise SystemExit(0)

try:
    nse = BharatFinTrack.NSEProduct()
    categories = list(getattr(nse, "equity_index_category", []))
    all_indices = list(getattr(nse, "all_equity_indices", []))
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"runtime-failed:{exc}"}))
    raise SystemExit(0)

indices = []
for name in all_indices:
    upper = str(name).upper()
    category = "thematic"
    if "NIFTY 50" in upper or "NIFTY 100" in upper or "NIFTY 200" in upper:
        category = "broad"
    elif any(x in upper for x in ["BANK", "IT", "PHARMA", "METAL", "ENERGY", "AUTO", "REALTY", "FMCG"]):
        category = "sector"
    elif any(x in upper for x in ["MOMENTUM", "ALPHA", "LOW VOLATILITY", "QUALITY", "VALUE"]):
        category = "strategy"
    elif any(x in upper for x in ["TRI", "TOTAL MARKET", "EQUAL WEIGHT", "ENHANCED"]):
        category = "variant"
    indices.append({
        "id": str(name).lower().replace("&", "and").replace(" ", "-"),
        "name": str(name),
        "category": category,
        "sectorTag": str(name),
        "source": "bharatfintrack",
        "constituents": []
    })

print(json.dumps({
    "ok": True,
    "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "source": "bharatfintrack-python-package",
    "categories": categories or ["broad", "sector", "thematic", "strategy", "variant"],
    "indices": indices
}))
`;

  const result = spawnSync("python3", ["-c", pythonCode], { encoding: "utf8" });
  if (result.error) return null;
  const stdout = String(result.stdout || "").trim();
  if (!stdout) return null;
  try {
    return JSON.parse(stdout);
  } catch (_error) {
    return null;
  }
}

function normalizeCatalogLike(payload) {
  const output = normalizeCatalog(
    {
      ...payload,
      generatedAt: new Date().toISOString(),
    },
    payload.sourcePath || DEFAULT_CATALOG_PATH,
  );
  return {
    generatedAt: output.generatedAt,
    source: payload.source,
    categories: output.categories,
    indices: output.indices,
  };
}

function ensureTargetMet(payload, targetStocks, targetClusters) {
  const totalStocks = payload.indices.reduce((sum, index) => sum + (Array.isArray(index.constituents) ? index.constituents.length : 0), 0);
  if (payload.indices.length !== targetClusters) return false;
  if (totalStocks !== targetStocks) return false;
  return true;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const targetStocks = Number.parseInt(options.targetStocks, 10);
  const targetClusters = Number.parseInt(options.targetClusters, 10);
  let payload = null;
  let mode = "seed-fallback";

  if (!options.forceSeed) {
    try {
      const livePayload = await buildLiveThematicPayload(targetStocks, targetClusters);
      if (livePayload && ensureTargetMet(livePayload, targetStocks, targetClusters)) {
        payload = livePayload;
        mode = "nse-bse-live";
      }
    } catch (_error) {
      // intentional fallback to lower-priority sources
    }
  }

  if (!payload && !options.forceSeed) {
    const extracted = runPythonExtract();
    if (extracted?.ok && Array.isArray(extracted.indices) && extracted.indices.length) {
      const mapped = {
        ...extracted,
        source: extracted.source || "bharatfintrack-python-package",
      };
      const normalized = normalizeCatalogLike(mapped);
      const candidate = {
        generatedAt: normalized.generatedAt,
        source: normalized.source || "bharatfintrack-python-package",
        categories: normalized.categories,
        indices: normalized.indices,
      };
      if (ensureTargetMet(candidate, targetStocks, targetClusters)) {
        payload = candidate;
        mode = "bharatfintrack-python";
      }
    }
  }

  if (!payload) {
    const fallback = await fs.readFile(SEED_CATALOG_PATH, "utf8").then(safeJsonParse).catch(() => null);
    if (!fallback || !Array.isArray(fallback?.indices)) {
      throw new Error("No viable live or seed catalog available");
    }
    payload = {
      generatedAt: fallback.generatedAt || new Date().toISOString(),
      source: "bharatfintrack-seed",
      categories: Array.isArray(fallback.categories) ? fallback.categories : ["broad", "sector", "thematic", "strategy", "variant"],
      indices: fallback.indices.map((index) => ({
        ...index,
        id: index.id || toText(index.name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      })),
    };
    mode = "seed-fallback";
  }

  if (options.requireLive && mode !== "nse-bse-live") {
    throw new Error(`Live ingest required but unavailable (resolved mode: ${mode})`);
  }

  const normalized = normalizeCatalog({
    generatedAt: payload.generatedAt,
    source: payload.source,
    categories: payload.categories,
    indices: payload.indices,
  }, options.output);

  const output = {
    generatedAt: normalized.generatedAt,
    source: payload.source,
    categories: normalized.categories,
    indices: normalized.indices,
  };

  const stockCount = output.indices.reduce((sum, item) => sum + (Array.isArray(item.constituents) ? item.constituents.length : 0), 0);

  if (mode === "nse-bse-live" && (!output.indices.length || output.indices.length !== targetClusters || stockCount !== targetStocks)) {
    throw new Error(`Live ingest did not meet target: clusters=${output.indices.length}/${targetClusters}, stocks=${stockCount}/${targetStocks}`);
  }

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        mode,
        output: options.output,
        categories: output.categories.length,
        indices: output.indices.length,
        stocks: stockCount,
        targetStocks,
        targetClusters,
      },
      null,
      2,
    )}\n`,
  );
}

run().catch((error) => {
  process.stderr.write(`ingest-bharatfintrack failed: ${sanitizeError(error)}\n`);
  process.exitCode = 1;
});
