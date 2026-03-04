#!/usr/bin/env node

const { CONTRACTS } = require("../api/_lib/contracts");
const { normalizeProvider } = require("../api/_lib/brokers/providerFactory");
const { bootstrapPortfolio } = require("../api/_lib/portfolioService");
const { saveEodSnapshot } = require("../api/_lib/snapshots");

const HELP_TEXT = `Usage:
  node scripts/run-eod-snapshot.js [options]

Options:
  --snapshot-date <YYYY-MM-DD>  Snapshot date (default: today)
  --exchange <all|nse|bse>      Exchange filter for snapshot source (default: all)
  --provider <kite-direct|kite-mcp>
                                Provider override (default: env BROKER_PROVIDER or kite-direct)
  --help                        Show this help
`;

function normalizeExchange(value) {
  const key = String(value || "all").toLowerCase();
  if (key === "all" || key === "nse" || key === "bse") return key;
  throw new Error(`Invalid exchange "${value}". Expected all, nse, or bse.`);
}

function parseArgs(argv) {
  const options = {
    snapshotDate: "",
    exchange: "all",
    provider: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (!arg.startsWith("--")) throw new Error(`Unknown argument "${arg}"`);
    if (arg === "--help") {
      options.help = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || String(value).startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;

    if (arg === "--snapshot-date") options.snapshotDate = String(value);
    else if (arg === "--exchange") options.exchange = normalizeExchange(value);
    else if (arg === "--provider") options.provider = normalizeProvider(value);
    else throw new Error(`Unknown option "${arg}"`);
  }

  return options;
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

  const snapshot = await bootstrapPortfolio({
    exchange: options.exchange,
    forceRefresh: true,
  });

  const result = await saveEodSnapshot({
    snapshotDate: options.snapshotDate || undefined,
    snapshot,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        snapshotDate: options.snapshotDate || null,
        exchange: options.exchange,
        provider: snapshot.provider,
        providerMode: snapshot.providerMode,
        connected: snapshot.connected,
        result,
        meta: {
          contractVersion: CONTRACTS.cliEodSnapshot,
          generatedAt: new Date().toISOString(),
        },
      },
      null,
      2,
    )}\n`,
  );
}

run().catch((error) => {
  process.stderr.write(`run-eod-snapshot failed: ${error.message || String(error)}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
