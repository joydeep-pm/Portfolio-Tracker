#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const { createBrokerProvider, normalizeProvider } = require("../api/_lib/brokers/providerFactory");
const { CONTRACTS } = require("../api/_lib/contracts");
const { bootstrapPortfolio } = require("../api/_lib/portfolioService");
const { saveEodSnapshot } = require("../api/_lib/snapshots");

const HELP_TEXT = `Usage:
  node scripts/portfolio-snapshot.js [options]

Options:
  --mode <summary|detailed>    Output detail level (default: summary)
  --exchange <all|nse|bse>     Exchange filter (default: all)
  --format <table|json>        Output format (default: table)
  --provider <kite-direct|kite-mcp>
                               Broker provider override (default: env BROKER_PROVIDER or kite-direct)
  --export <path>              Export output to file (JSON for json mode, CSV for table mode)
  --eod                        Persist EOD snapshot through existing snapshot service
  --snapshot-date <YYYY-MM-DD> Snapshot date for --eod (default: today in IST-ish system date)
  --help                       Show this help
`;

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value, 0));
}

function pct(value) {
  return `${toNumber(value, 0).toFixed(2)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeExchange(value) {
  const key = String(value || "all").toLowerCase();
  if (key === "nse" || key === "bse" || key === "all") return key;
  throw new Error(`Invalid exchange "${value}". Expected one of: all, nse, bse`);
}

function normalizeMode(value) {
  const key = String(value || "summary").toLowerCase();
  if (key === "summary" || key === "detailed") return key;
  throw new Error(`Invalid mode "${value}". Expected one of: summary, detailed`);
}

function normalizeFormat(value) {
  const key = String(value || "table").toLowerCase();
  if (key === "table" || key === "json") return key;
  throw new Error(`Invalid format "${value}". Expected one of: table, json`);
}

function parseArgs(argv) {
  const options = {
    mode: "summary",
    exchange: "all",
    format: "table",
    provider: "",
    exportPath: "",
    saveEod: false,
    snapshotDate: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (!arg.startsWith("--")) {
      throw new Error(`Unknown argument "${arg}"`);
    }

    if (arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--eod") {
      options.saveEod = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || String(value).startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;

    if (arg === "--mode") options.mode = normalizeMode(value);
    else if (arg === "--exchange") options.exchange = normalizeExchange(value);
    else if (arg === "--format") options.format = normalizeFormat(value);
    else if (arg === "--provider") options.provider = normalizeProvider(value);
    else if (arg === "--export") options.exportPath = String(value);
    else if (arg === "--snapshot-date") options.snapshotDate = String(value);
    else throw new Error(`Unknown option "${arg}"`);
  }

  return options;
}

function dayChangeAmount(row) {
  const returns1d = toNumber(row?.returns?.["1D"], 0);
  const currentValue = toNumber(row?.currentValue, 0);
  if (currentValue === 0) return 0;
  if (returns1d <= -99.95) return -currentValue;
  const previousValue = currentValue / (1 + returns1d / 100);
  return currentValue - previousValue;
}

function topMovers(rows) {
  const sorted = [...rows].sort((a, b) => toNumber(b.unrealizedPnl, 0) - toNumber(a.unrealizedPnl, 0));
  const gainers = sorted.filter((row) => toNumber(row.unrealizedPnl, 0) > 0).slice(0, 3);
  const losers = [...sorted]
    .reverse()
    .filter((row) => toNumber(row.unrealizedPnl, 0) < 0)
    .slice(0, 3);
  return { gainers, losers };
}

function buildPayload(snapshot, options, eodResult) {
  const rows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
  const summary = snapshot.summary || {};
  const holdingsDayChange = rows.reduce((acc, row) => acc + dayChangeAmount(row), 0);
  const movers = topMovers(rows);

  const base = {
    asOf: snapshot.asOf,
    provider: snapshot.provider,
    providerMode: snapshot.providerMode,
    connected: Boolean(snapshot.connected),
    exchange: options.exchange,
    mode: options.mode,
    summary: {
      totalSymbols: toNumber(summary.totalSymbols, rows.length),
      totalInvested: toNumber(summary.totalInvested, 0),
      totalCurrent: toNumber(summary.totalCurrent, 0),
      totalPnl: toNumber(summary.totalPnl, 0),
      totalPnlPct: toNumber(summary.totalPnlPct, 0),
      cashAvailable: toNumber(summary.cashAvailable, 0),
      holdingsDayChange: Number.parseFloat(holdingsDayChange.toFixed(2)),
      gainers: toNumber(summary.gainers, movers.gainers.length),
      losers: toNumber(summary.losers, movers.losers.length),
    },
    topMovers: {
      gainers: movers.gainers.map((row) => ({
        symbol: row.symbol,
        exchange: row.exchange,
        pnl: toNumber(row.unrealizedPnl, 0),
        pnlPct: toNumber(row.unrealizedPnlPct, 0),
      })),
      losers: movers.losers.map((row) => ({
        symbol: row.symbol,
        exchange: row.exchange,
        pnl: toNumber(row.unrealizedPnl, 0),
        pnlPct: toNumber(row.unrealizedPnlPct, 0),
      })),
    },
    eod: eodResult || null,
    meta: {
      contractVersion: CONTRACTS.cliPortfolioSnapshot,
      generatedAt: new Date().toISOString(),
    },
  };

  if (options.mode === "detailed") {
    base.rows = rows.map((row) => ({
      symbol: row.symbol,
      exchange: row.exchange,
      quantity: toNumber(row.quantity, 0),
      averagePrice: toNumber(row.averagePrice, 0),
      lastPrice: toNumber(row.lastPrice, 0),
      investedValue: toNumber(row.investedValue, 0),
      currentValue: toNumber(row.currentValue, 0),
      unrealizedPnl: toNumber(row.unrealizedPnl, 0),
      unrealizedPnlPct: toNumber(row.unrealizedPnlPct, 0),
      dayChange: Number.parseFloat(dayChangeAmount(row).toFixed(2)),
      weightPct: toNumber(row.weightPct, 0),
      action: row?.decision?.action || "HOLD",
      confidence: toNumber(row?.decision?.confidence, 0),
    }));
  }

  return base;
}

function fixed(value, digits = 2) {
  return toNumber(value, 0).toFixed(digits);
}

function renderSummaryTable(payload) {
  const lines = [];
  lines.push(`Portfolio Snapshot @ ${payload.asOf}`);
  lines.push(`Provider: ${payload.provider} (${payload.providerMode}) | Connected: ${payload.connected ? "yes" : "no"}`);
  lines.push(`Exchange: ${payload.exchange.toUpperCase()} | Mode: ${payload.mode}`);
  lines.push("");
  lines.push("TODAY");
  lines.push(`- Portfolio Value: ${money(payload.summary.totalCurrent)}`);
  lines.push(`- Invested Value: ${money(payload.summary.totalInvested)}`);
  lines.push(`- Unrealized P&L: ${money(payload.summary.totalPnl)} (${pct(payload.summary.totalPnlPct)})`);
  lines.push(`- Holdings Day Change: ${money(payload.summary.holdingsDayChange)}`);
  lines.push(`- Cash Available: ${money(payload.summary.cashAvailable)}`);
  lines.push("");
  lines.push("TOP GAINERS");
  if (payload.topMovers.gainers.length === 0) {
    lines.push("- none");
  } else {
    payload.topMovers.gainers.forEach((item) => {
      lines.push(`- ${item.exchange}:${item.symbol} ${money(item.pnl)} (${pct(item.pnlPct)})`);
    });
  }
  lines.push("");
  lines.push("TOP LOSERS");
  if (payload.topMovers.losers.length === 0) {
    lines.push("- none");
  } else {
    payload.topMovers.losers.forEach((item) => {
      lines.push(`- ${item.exchange}:${item.symbol} ${money(item.pnl)} (${pct(item.pnlPct)})`);
    });
  }

  if (payload.eod) {
    lines.push("");
    lines.push("EOD SNAPSHOT");
    lines.push(`- stored: ${payload.eod.stored ? "yes" : "no"} (${payload.eod.mode || "n/a"})`);
    if (payload.eod.reason) lines.push(`- reason: ${payload.eod.reason}`);
    if (payload.eod.snapshotDate) lines.push(`- snapshotDate: ${payload.eod.snapshotDate}`);
  }

  return lines.join("\n");
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

function renderDetailedTable(payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) {
    return `${renderSummaryTable(payload)}\n\nNo holdings rows available for the selected exchange.`;
  }

  const columns = [
    { key: "symbol", label: "Symbol", width: 12 },
    { key: "exchange", label: "Exch", width: 4 },
    { key: "quantity", label: "Qty", width: 6 },
    { key: "lastPrice", label: "LTP", width: 11 },
    { key: "currentValue", label: "Value", width: 12 },
    { key: "unrealizedPnl", label: "PnL", width: 12 },
    { key: "unrealizedPnlPct", label: "PnL%", width: 8 },
    { key: "dayChange", label: "DayChg", width: 11 },
    { key: "action", label: "Action", width: 10 },
    { key: "confidence", label: "Conf", width: 6 },
  ];
  const widths = columns.map((column) => column.width);
  const header = tableLine(columns.map((column) => column.label), widths);
  const separator = widths.map((width) => "-".repeat(width)).join("-+-");

  const body = rows
    .map((row) =>
      tableLine(
        [
          row.symbol,
          row.exchange,
          fixed(row.quantity, 0),
          fixed(row.lastPrice, 2),
          fixed(row.currentValue, 2),
          fixed(row.unrealizedPnl, 2),
          fixed(row.unrealizedPnlPct, 2),
          fixed(row.dayChange, 2),
          row.action,
          fixed(row.confidence, 1),
        ],
        widths,
      ),
    )
    .join("\n");

  return `${renderSummaryTable(payload)}\n\n${header}\n${separator}\n${body}`;
}

function toCsv(payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const headers = [
    "symbol",
    "exchange",
    "quantity",
    "averagePrice",
    "lastPrice",
    "investedValue",
    "currentValue",
    "unrealizedPnl",
    "unrealizedPnlPct",
    "dayChange",
    "weightPct",
    "action",
    "confidence",
  ];

  const escapeCsv = (value) => {
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
        .map((key) => {
          if (key === "quantity") return escapeCsv(fixed(row[key], 0));
          if (["averagePrice", "lastPrice", "investedValue", "currentValue", "unrealizedPnl", "unrealizedPnlPct", "dayChange", "weightPct", "confidence"].includes(key)) {
            return escapeCsv(fixed(row[key], 2));
          }
          return escapeCsv(row[key]);
        })
        .join(","),
    );
  });

  return `${lines.join("\n")}\n`;
}

async function ensureParentDir(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  return fullPath;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  if (options.provider) {
    process.env.BROKER_PROVIDER = options.provider;
  }

  // Warm provider creation early so contract violations fail fast in CLI execution.
  createBrokerProvider();

  const snapshot = await bootstrapPortfolio({
    exchange: options.exchange,
    forceRefresh: true,
  });

  let eodResult = null;
  if (options.saveEod) {
    eodResult = await saveEodSnapshot({
      snapshotDate: options.snapshotDate || undefined,
      snapshot,
    });
  }

  const payload = buildPayload(snapshot, options, eodResult);
  let output;

  if (options.format === "json") {
    output = `${JSON.stringify(payload, null, 2)}\n`;
  } else if (options.mode === "detailed") {
    if (!Array.isArray(payload.rows)) {
      payload.rows = [];
    }
    output = `${renderDetailedTable(payload)}\n`;
  } else {
    output = `${renderSummaryTable(payload)}\n`;
  }

  process.stdout.write(output);

  if (options.exportPath) {
    const targetPath = await ensureParentDir(options.exportPath);
    const exportData = options.format === "json" ? output : toCsv({ ...payload, rows: payload.rows || [] });
    await fs.writeFile(targetPath, exportData, "utf8");
    process.stdout.write(`Exported: ${targetPath}\n`);
  }
}

run().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`portfolio-snapshot failed: ${message}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
