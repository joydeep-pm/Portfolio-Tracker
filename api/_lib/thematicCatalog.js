const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_CATALOG_PATH = path.resolve(process.cwd(), "data/thematic_index_catalog.json");
const SEED_CATALOG_PATH = path.resolve(process.cwd(), "data/bharatfintrack_seed.json");
const CACHE_TTL_MS = 15_000;

const cacheState = {
  loadedAtMs: 0,
  catalogPath: "",
  catalog: null,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeCategory(value) {
  const key = toText(value, "uncategorized").toLowerCase();
  if (["broad", "sector", "thematic", "strategy", "variant"].includes(key)) return key;
  return "uncategorized";
}

function normalizeConstituent(value) {
  const raw = toText(value);
  if (!raw) return "";
  if (raw.includes(":")) {
    const [exchange, symbol] = raw.split(":");
    return `${toText(exchange, "NSE").toUpperCase()}:${toText(symbol).toUpperCase()}`;
  }
  return `NSE:${raw.toUpperCase()}`;
}

function normalizeIndex(entry) {
  const id = toText(entry?.id, toText(entry?.name).toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  const name = toText(entry?.name, id);
  const category = normalizeCategory(entry?.category);
  const sectorTag = toText(entry?.sectorTag, name);
  const source = toText(entry?.source, "bharatfintrack");
  const constituents = asArray(entry?.constituents).map(normalizeConstituent).filter(Boolean);

  return {
    id,
    name,
    category,
    sectorTag,
    source,
    constituents,
  };
}

function buildSymbolToThemes(indices) {
  const output = {};
  indices.forEach((index) => {
    index.constituents.forEach((instrument) => {
      if (!output[instrument]) output[instrument] = [];
      output[instrument].push({
        indexId: index.id,
        indexName: index.name,
        indexCategory: index.category,
        sectorTag: index.sectorTag,
        source: index.source,
      });
    });
  });
  return output;
}

function normalizeCatalog(payload, pathUsed) {
  const categories = asArray(payload?.categories).map((item) => normalizeCategory(item));
  const indices = asArray(payload?.indices).map(normalizeIndex);

  const normalized = {
    generatedAt: toText(payload?.generatedAt, new Date().toISOString()),
    source: toText(payload?.source, "bharatfintrack"),
    categories: [...new Set(categories.length ? categories : indices.map((index) => index.category))],
    indices,
    symbolToThemes: buildSymbolToThemes(indices),
    pathUsed,
  };

  return normalized;
}

async function loadJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function loadThematicCatalog(options = {}) {
  const catalogPath = path.resolve(process.cwd(), options.path || DEFAULT_CATALOG_PATH);
  const nowMs = Date.now();

  if (
    cacheState.catalog &&
    cacheState.catalogPath === catalogPath &&
    nowMs - cacheState.loadedAtMs <= CACHE_TTL_MS &&
    !options.forceReload
  ) {
    return cacheState.catalog;
  }

  let payload;
  let pathUsed = catalogPath;

  try {
    payload = await loadJson(catalogPath);
  } catch (_error) {
    payload = await loadJson(SEED_CATALOG_PATH);
    pathUsed = SEED_CATALOG_PATH;
  }

  const catalog = normalizeCatalog(payload, pathUsed);
  cacheState.loadedAtMs = nowMs;
  cacheState.catalogPath = catalogPath;
  cacheState.catalog = catalog;
  return catalog;
}

module.exports = {
  loadThematicCatalog,
  normalizeCatalog,
  DEFAULT_CATALOG_PATH,
  SEED_CATALOG_PATH,
};
