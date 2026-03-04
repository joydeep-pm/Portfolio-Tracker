#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONTRACTS } = require("../api/_lib/contracts");
const { runHarvester: runMacroHarvester } = require("../api/_lib/macroHarvester");

const HELP_TEXT = `Usage:
  node scripts/harvest-macro-news.js [options]

Options:
  --format <table|json>   Output format (default: table)
  --per-source <n>        Max items parsed per feed (default: 40)
  --limit <n>             Number of latest rows in output (default: 25)
  --db <path>             SQLite db path (default: ./data/macro_events.db)
  --export <path>         Export output payload to file
  --help
`;

function parseArgs(argv) {
  const options = {
    format: "table",
    perSource: 40,
    limit: 25,
    dbPath: "",
    exportPath: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help") {
      options.help = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || String(value).startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;

    if (arg === "--format") {
      const format = String(value).toLowerCase();
      if (!["table", "json"].includes(format)) throw new Error(`Invalid format "${value}"`);
      options.format = format;
      continue;
    }

    if (arg === "--per-source") {
      const parsed = Number.parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid --per-source "${value}"`);
      options.perSource = parsed;
      continue;
    }

    if (arg === "--limit") {
      const parsed = Number.parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid --limit "${value}"`);
      options.limit = parsed;
      continue;
    }

    if (arg === "--db") {
      options.dbPath = String(value);
      continue;
    }

    if (arg === "--export") {
      options.exportPath = String(value);
      continue;
    }

    throw new Error(`Unknown option "${arg}"`);
  }

  return options;
}

function fit(text, width) {
  const value = String(text ?? "");
  if (value.length === width) return value;
  if (value.length > width) return `${value.slice(0, Math.max(0, width - 3))}...`;
  return `${value}${" ".repeat(width - value.length)}`;
}

function tableLine(values, widths) {
  return values.map((value, index) => fit(value, widths[index])).join(" | ");
}

function renderTable(payload) {
  const lines = [];
  lines.push(`Macro Harvester (SQLite) @ ${payload.asOf}`);
  lines.push(
    `Fetched=${payload.fetchedCount} Inserted=${payload.insertedCount} Duplicates=${payload.duplicateCount} Stored=${payload.totalStored}`,
  );
  lines.push(`DB: ${payload.dbPath}`);
  lines.push("");

  const columns = [
    { name: "Date", width: 24 },
    { name: "Source", width: 10 },
    { name: "Title", width: 64 },
    { name: "Tags", width: 38 },
  ];
  const widths = columns.map((column) => column.width);

  lines.push(tableLine(columns.map((column) => column.name), widths));
  lines.push(widths.map((width) => "-".repeat(width)).join("-+-"));

  (payload.latest || []).forEach((item) => {
    lines.push(
      tableLine(
        [
          item.published_date || "--",
          item.source_type || "--",
          item.title || "--",
          Array.isArray(item.priority_tags) ? item.priority_tags.join(", ") : "",
        ],
        widths,
      ),
    );
  });

  return `${lines.join("\n")}\n`;
}

async function ensureParentDir(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  return resolved;
}

async function runHarvester() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const payload = await runMacroHarvester({
    dbPath: options.dbPath,
    maxItemsPerSource: options.perSource,
    latestLimit: options.limit,
  });

  const outputPayload = {
    ...payload,
    meta: {
      contractVersion: CONTRACTS.cliMacroHarvest,
      generatedAt: new Date().toISOString(),
    },
  };

  const output = options.format === "json" ? `${JSON.stringify(outputPayload, null, 2)}\n` : renderTable(outputPayload);
  process.stdout.write(output);

  if (options.exportPath) {
    const targetPath = await ensureParentDir(options.exportPath);
    await fs.writeFile(targetPath, output, "utf8");
    process.stdout.write(`Exported: ${targetPath}\n`);
  }
}

if (require.main === module) {
  runHarvester().catch((error) => {
    process.stderr.write(`harvest-macro-news failed: ${error.message || String(error)}\n`);
    process.stderr.write("Use --help for usage.\n");
    process.exitCode = 1;
  });
}

module.exports = {
  runHarvester,
};
