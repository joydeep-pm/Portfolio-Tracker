#!/usr/bin/env node

const { CONTRACTS } = require("../api/_lib/contracts");
const { runBackfillWindow } = require("../api/_lib/backfillService");

function parseArgs(argv) {
  const options = {
    fromDate: "",
    toDate: "",
    exchange: "all",
    hotspotDir: "data/backfill/hotspots",
    skipExisting: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--no-skip-existing") {
      options.skipExisting = false;
      continue;
    }

    const value = argv[i + 1];
    if (!value || String(value).startsWith("--")) throw new Error(`Missing value for ${arg}`);
    i += 1;

    if (arg === "--from") options.fromDate = String(value);
    else if (arg === "--to") options.toDate = String(value);
    else if (arg === "--exchange") options.exchange = String(value).toLowerCase();
    else if (arg === "--hotspot-dir") options.hotspotDir = String(value);
    else throw new Error(`Unknown option "${arg}"`);
  }

  return options;
}

const HELP_TEXT = `Usage:
  node scripts/replay-backfill.js --from YYYY-MM-DD [--to YYYY-MM-DD] [options]

Options:
  --exchange <all|nse|bse>       Exchange filter for snapshot source
  --hotspot-dir <path>           Hotspot archive output directory
  --no-skip-existing             Overwrite existing hotspot archive files
`;

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  if (!options.fromDate) {
    throw new Error("--from is required");
  }

  const result = await runBackfillWindow({
    fromDate: options.fromDate,
    toDate: options.toDate || options.fromDate,
    exchange: options.exchange,
    hotspotDir: options.hotspotDir,
    skipExisting: options.skipExisting,
  });
  const payload = {
    ...result,
    meta: {
      contractVersion: CONTRACTS.cliReplayBackfill,
      generatedAt: new Date().toISOString(),
    },
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

run().catch((error) => {
  process.stderr.write(`replay-backfill failed: ${error.message || String(error)}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
