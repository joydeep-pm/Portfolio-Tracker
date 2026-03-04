#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONTRACTS } = require("../api/_lib/contracts");
const { getHotspotSnapshot } = require("../api/_lib/hotspotService");

function parseArgs(argv) {
  const options = {
    mode: "summary",
    format: "table",
    exchange: "all",
    exportPath: "",
    refresh: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--refresh") {
      options.refresh = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || String(value).startsWith("--")) throw new Error(`Missing value for ${arg}`);
    index += 1;

    if (arg === "--mode") {
      const mode = String(value).toLowerCase();
      if (mode !== "summary" && mode !== "detailed") throw new Error(`Invalid mode "${value}"`);
      options.mode = mode;
    } else if (arg === "--format") {
      const format = String(value).toLowerCase();
      if (format !== "table" && format !== "json") throw new Error(`Invalid format "${value}"`);
      options.format = format;
    } else if (arg === "--exchange") {
      const exchange = String(value).toLowerCase();
      if (!["all", "nse", "bse"].includes(exchange)) throw new Error(`Invalid exchange "${value}"`);
      options.exchange = exchange;
    } else if (arg === "--export") {
      options.exportPath = String(value);
    } else {
      throw new Error(`Unknown option "${arg}"`);
    }
  }

  return options;
}

const HELP_TEXT = `Usage:
  node scripts/hotspots-snapshot.js [options]

Options:
  --mode <summary|detailed>
  --format <table|json>
  --exchange <all|nse|bse>
  --refresh
  --export <path>
`;

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(value) {
  return `${toNumber(value, 0).toFixed(2)}%`;
}

function fixed(value, digits = 2) {
  return toNumber(value, 0).toFixed(digits);
}

function fit(text, width) {
  const raw = String(text ?? "");
  if (raw.length === width) return raw;
  if (raw.length > width) return `${raw.slice(0, Math.max(0, width - 3))}...`;
  return `${raw}${" ".repeat(width - raw.length)}`;
}

function tableLine(parts, widths) {
  return parts.map((part, index) => fit(part, widths[index])).join(" | ");
}

function renderTable(payload, mode) {
  const lines = [];
  lines.push(`Hotspot Snapshot @ ${payload.asOf}`);
  lines.push(`Exchange: ${String(payload.exchange || "all").toUpperCase()} | Source: ${payload.source} | Cursor: ${payload.cursor}`);
  lines.push(`Scheduler: cadence=${payload.scheduler?.cadenceSec || 0}s stale=${payload.scheduler?.stale ? "yes" : "no"} failures=${payload.scheduler?.consecutiveFailures || 0}`);
  lines.push("");

  const hotspots = Array.isArray(payload.hotspots) ? payload.hotspots : [];
  if (!hotspots.length) {
    lines.push("No hotspot themes available.");
    return lines.join("\n");
  }

  const rows = mode === "summary" ? hotspots.slice(0, 10) : hotspots;
  const columns = [
    { label: "Theme", width: 30 },
    { label: "Cat", width: 11 },
    { label: "Score", width: 7 },
    { label: "Breadth", width: 8 },
    { label: "Momentum", width: 9 },
    { label: "Catalyst", width: 24 },
  ];
  const widths = columns.map((column) => column.width);
  lines.push(tableLine(columns.map((column) => column.label), widths));
  lines.push(widths.map((width) => "-".repeat(width)).join("-+-"));

  rows.forEach((row) => {
    lines.push(
      tableLine(
        [
          row.themeName,
          row.indexCategory,
          fixed(row.score, 2),
          pct(row.breadthPct),
          fixed(toNumber(row.momentumStrength, 0) * 100, 2),
          (row.catalystFlags || []).join(","),
        ],
        widths,
      ),
    );
  });

  return lines.join("\n");
}

function toCsv(payload) {
  const rows = Array.isArray(payload.hotspots) ? payload.hotspots : [];
  const headers = [
    "themeId",
    "themeName",
    "indexCategory",
    "sectorTag",
    "score",
    "breadthPct",
    "momentumStrength",
    "constituentCount",
    "flaggedConstituentCount",
    "catalystFlags",
  ];

  const escape = (value) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(
      headers
        .map((header) => {
          if (header === "catalystFlags") return escape((row.catalystFlags || []).join("|"));
          return escape(row[header]);
        })
        .join(","),
    );
  });
  return `${lines.join("\n")}\n`;
}

async function ensureParentDir(filePath) {
  const outputPath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  return outputPath;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const snapshot = await getHotspotSnapshot({
    exchange: options.exchange,
    forceRefresh: options.refresh,
  });
  const payload = {
    ...snapshot,
    meta: {
      contractVersion: CONTRACTS.cliHotspotsSnapshot,
      generatedAt: new Date().toISOString(),
    },
  };

  const output =
    options.format === "json" ? `${JSON.stringify(payload, null, 2)}\n` : `${renderTable(payload, options.mode)}\n`;
  process.stdout.write(output);

  if (options.exportPath) {
    const targetPath = await ensureParentDir(options.exportPath);
    const data = options.format === "json" ? output : toCsv(payload);
    await fs.writeFile(targetPath, data, "utf8");
    process.stdout.write(`Exported: ${targetPath}\n`);
  }
}

run().catch((error) => {
  process.stderr.write(`hotspots-snapshot failed: ${error.message || String(error)}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
