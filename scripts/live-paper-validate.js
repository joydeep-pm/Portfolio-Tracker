#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const { bootstrapPortfolio } = require("../api/_lib/portfolioService");

function parseArgs(argv) {
  const options = {
    exchange: "all",
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
    if (arg === "--exchange") options.exchange = String(value).toLowerCase();
    else if (arg === "--export") options.exportPath = String(value);
    else throw new Error(`Unknown option "${arg}"`);
  }
  if (!["all", "nse", "bse"].includes(options.exchange)) throw new Error(`Invalid exchange "${options.exchange}"`);
  return options;
}

const HELP_TEXT = `Usage:
  node scripts/live-paper-validate.js [options]

Options:
  --exchange <all|nse|bse>
  --export <path>            Optional JSON export path
`;

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

  const accessToken = String(process.env.KITE_ACCESS_TOKEN || "").trim();
  const apiKey = String(process.env.KITE_API_KEY || "").trim();
  if (!apiKey || !accessToken) {
    throw new Error("KITE_API_KEY and KITE_ACCESS_TOKEN are required for live-paper validation");
  }

  process.env.BROKER_PROVIDER = "kite-direct";
  const payload = await bootstrapPortfolio({
    exchange: options.exchange,
    forceRefresh: true,
    sessionOverride: {
      connected: true,
      accessToken,
      provider: "kite-direct",
    },
  });

  const result = {
    ok: true,
    asOf: payload.asOf,
    exchange: options.exchange,
    connected: payload.connected,
    provider: payload.provider,
    providerMode: payload.providerMode,
    summary: payload.summary,
    rowCount: Array.isArray(payload.rows) ? payload.rows.length : 0,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (options.exportPath) {
    const targetPath = await ensureParentDir(options.exportPath);
    await fs.writeFile(targetPath, `${JSON.stringify({ result, payload }, null, 2)}\n`, "utf8");
    process.stdout.write(`Exported: ${targetPath}\n`);
  }
}

run().catch((error) => {
  process.stderr.write(`live-paper-validate failed: ${error.message || String(error)}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
