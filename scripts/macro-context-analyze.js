#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONTRACTS } = require("../api/_lib/contracts");
const { analyzeMacroContext } = require("../api/_lib/macroContextEngine");

const HELP_TEXT = `Usage:
  node scripts/macro-context-analyze.js [options]

Options:
  --symbol <symbol>       Focus symbol (optional)
  --theme <text>          Theme hint (optional)
  --exchange <all|nse|bse>
  --limit <n>             Candidate events to analyze (default: 30)
  --include-processed     Include already processed queue items
  --include-prompt-draft  Include full LLM prompt draft in output payload
  --format <table|json>   Output format (default: table)
  --export <path>         Export output payload to file
  --help
`;

function parseArgs(argv) {
  const options = {
    symbol: "",
    theme: "",
    exchange: "all",
    limit: 30,
    includeProcessed: false,
    includePromptDraft: false,
    format: "table",
    exportPath: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--include-processed") {
      options.includeProcessed = true;
      continue;
    }

    if (arg === "--include-prompt-draft") {
      options.includePromptDraft = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || String(value).startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;

    if (arg === "--symbol") {
      options.symbol = String(value).trim().toUpperCase();
      continue;
    }

    if (arg === "--theme") {
      options.theme = String(value).trim();
      continue;
    }

    if (arg === "--exchange") {
      const exchange = String(value).toLowerCase();
      if (!["all", "nse", "bse"].includes(exchange)) {
        throw new Error(`Invalid --exchange \"${value}\"`);
      }
      options.exchange = exchange;
      continue;
    }

    if (arg === "--limit") {
      const parsed = Number.parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid --limit \"${value}\"`);
      options.limit = parsed;
      continue;
    }

    if (arg === "--format") {
      const format = String(value).toLowerCase();
      if (!["table", "json"].includes(format)) throw new Error(`Invalid --format \"${value}\"`);
      options.format = format;
      continue;
    }

    if (arg === "--export") {
      options.exportPath = String(value);
      continue;
    }

    throw new Error(`Unknown option \"${arg}\"`);
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
  lines.push(`Macro Context @ ${payload.asOf}`);
  lines.push(`Symbol=${payload.symbol || "ALL"} Exchange=${payload.exchange.toUpperCase()} Sentiment=${payload.sentiment_score}`);
  lines.push(`Catalyst: ${payload.key_catalyst}`);
  lines.push(`Events=${payload.considered_events} Processed=${payload.processed_count} Sources=${payload.sources.join(", ") || "--"}`);
  lines.push("");
  lines.push("Impacted Clusters:");

  const columns = [
    { name: "Head", width: 32 },
    { name: "Cluster", width: 44 },
    { name: "Impact", width: 8 },
  ];
  const widths = columns.map((column) => column.width);
  lines.push(tableLine(columns.map((column) => column.name), widths));
  lines.push(widths.map((width) => "-".repeat(width)).join("-+-"));

  (payload.impacted_clusters || []).forEach((cluster) => {
    lines.push(tableLine([cluster.head_name, cluster.cluster_name, cluster.impact_score], widths));
  });

  lines.push("");
  lines.push("Rationale:");
  lines.push(payload.rationale_summary || "--");
  return `${lines.join("\n")}\n`;
}

async function ensureParentDir(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  return resolved;
}

async function runMacroContextAnalysis() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const payload = await analyzeMacroContext({
    symbol: options.symbol,
    themeHint: options.theme,
    exchange: options.exchange,
    limit: options.limit,
    includeProcessed: options.includeProcessed,
    includePromptDraft: options.includePromptDraft,
  });

  const outputPayload = {
    ...payload,
    meta: {
      contractVersion: CONTRACTS.cliMacroContextAnalyze,
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
  runMacroContextAnalysis().catch((error) => {
    process.stderr.write(`macro-context-analyze failed: ${error.message || String(error)}\n`);
    process.stderr.write("Use --help for usage.\n");
    process.exitCode = 1;
  });
}

module.exports = {
  runMacroContextAnalysis,
};
