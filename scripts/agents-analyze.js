#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const { CONTRACTS } = require("../api/_lib/contracts");
const { runAgentWorkflow } = require("../api/_lib/multiAgentEngine");

function parseArgs(argv) {
  const options = {
    prompt: "",
    exchange: "all",
    format: "table",
    exportPath: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || String(value).startsWith("--")) throw new Error(`Missing value for ${arg}`);
    i += 1;

    if (arg === "--prompt") options.prompt = String(value);
    else if (arg === "--exchange") options.exchange = String(value).toLowerCase();
    else if (arg === "--format") {
      const format = String(value).toLowerCase();
      if (format !== "table" && format !== "json") throw new Error(`Invalid format "${value}"`);
      options.format = format;
    } else if (arg === "--export") options.exportPath = String(value);
    else throw new Error(`Unknown option "${arg}"`);
  }

  return options;
}

const HELP_TEXT = `Usage:
  node scripts/agents-analyze.js --prompt "<natural language query>" [options]

Options:
  --exchange <all|nse|bse>
  --format <table|json>
  --export <path>
`;

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function renderTable(payload) {
  const lines = [];
  lines.push(`Agent Analysis @ ${payload.asOf}`);
  lines.push(`Intent: ${payload.intent} | Route: ${payload.route}`);
  lines.push(`Exchange: ${String(payload.exchange || "all").toUpperCase()} | Decisions: ${payload.summary.totalDecisions}`);
  lines.push(`Buy-like: ${payload.summary.buyLike} | Sell-like: ${payload.summary.sellLike} | Avg confidence: ${fixed(payload.summary.averageConfidence, 1)}`);
  lines.push("");

  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  if (!decisions.length) {
    lines.push("No agent decisions returned.");
    return lines.join("\n");
  }

  const rows = decisions.slice(0, 15);
  const columns = [
    { label: "Symbol", width: 12 },
    { label: "Exch", width: 4 },
    { label: "Action", width: 10 },
    { label: "Score", width: 8 },
    { label: "Conf", width: 6 },
    { label: "Risk Flags", width: 34 },
  ];
  const widths = columns.map((column) => column.width);
  lines.push(tableLine(columns.map((column) => column.label), widths));
  lines.push(widths.map((width) => "-".repeat(width)).join("-+-"));
  rows.forEach((row) => {
    lines.push(
      tableLine(
        [
          row.symbol,
          row.exchange,
          row.action,
          fixed(row.weightedScore, 2),
          fixed(row.confidence, 1),
          (row.riskFlags || []).join(","),
        ],
        widths,
      ),
    );
  });

  return lines.join("\n");
}

function toCsv(payload) {
  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  const headers = ["symbol", "exchange", "action", "confidence", "weightedScore", "riskFlags", "rationale", "invalidation"];
  const escape = (value) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const lines = [headers.join(",")];
  decisions.forEach((row) => {
    lines.push(
      headers
        .map((key) => {
          if (key === "riskFlags" || key === "rationale" || key === "invalidation") {
            return escape((row[key] || []).join(" | "));
          }
          return escape(row[key]);
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
  if (!String(options.prompt || "").trim()) {
    throw new Error("prompt is required. Use --prompt \"...\"");
  }

  const result = await runAgentWorkflow({
    prompt: options.prompt,
    exchange: options.exchange,
  });
  const payload = {
    ...result,
    meta: {
      contractVersion: CONTRACTS.cliAgentsAnalyze,
      generatedAt: new Date().toISOString(),
    },
  };

  const output = options.format === "json" ? `${JSON.stringify(payload, null, 2)}\n` : `${renderTable(payload)}\n`;
  process.stdout.write(output);

  if (options.exportPath) {
    const targetPath = await ensureParentDir(options.exportPath);
    const data = options.format === "json" ? output : toCsv(payload);
    await fs.writeFile(targetPath, data, "utf8");
    process.stdout.write(`Exported: ${targetPath}\n`);
  }
}

run().catch((error) => {
  process.stderr.write(`agents-analyze failed: ${error.message || String(error)}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
