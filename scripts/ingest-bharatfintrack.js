#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { SEED_CATALOG_PATH, normalizeCatalog, DEFAULT_CATALOG_PATH } = require("../api/_lib/thematicCatalog");

function parseArgs(argv) {
  const options = {
    output: DEFAULT_CATALOG_PATH,
    forceSeed: false,
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
    if (arg === "--output") {
      const value = argv[i + 1];
      if (!value || String(value).startsWith("--")) throw new Error("Missing value for --output");
      options.output = path.resolve(process.cwd(), String(value));
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument "${arg}"`);
  }

  return options;
}

const HELP_TEXT = `Usage:
  node scripts/ingest-bharatfintrack.js [--output <path>] [--force-seed]

Notes:
  - Attempts live ingest via python BharatFinTrack package first.
  - Falls back to repository seed data if package is unavailable.
`;

async function readSeedPayload() {
  const content = await fs.readFile(SEED_CATALOG_PATH, "utf8");
  return JSON.parse(content);
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

# BharatFinTrack does not guarantee per-index constituents via public API.
# We still emit a normalized category-aware index list and leave constituents empty.
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

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  let payload = null;
  let mode = "seed-fallback";

  if (!options.forceSeed) {
    const extracted = runPythonExtract();
    if (extracted?.ok && Array.isArray(extracted.indices) && extracted.indices.length) {
      payload = extracted;
      mode = "bharatfintrack-live";
    }
  }

  if (!payload) {
    payload = await readSeedPayload();
    mode = "seed-fallback";
  }

  const normalized = normalizeCatalog(
    {
      ...payload,
      generatedAt: new Date().toISOString(),
    },
    options.output,
  );

  const output = {
    generatedAt: normalized.generatedAt,
    source: mode === "bharatfintrack-live" ? "bharatfintrack-python-package" : "bharatfintrack-seed",
    categories: normalized.categories,
    indices: normalized.indices,
  };

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
      },
      null,
      2,
    )}\n`,
  );
}

run().catch((error) => {
  process.stderr.write(`ingest-bharatfintrack failed: ${error.message || String(error)}\n`);
  process.exitCode = 1;
});
