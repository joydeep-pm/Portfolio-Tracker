#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const { inspectConfig } = require("../api/_lib/configHealth");

function parseSimpleEnv(content) {
  return String(content || "")
    .split(/\r?\n/g)
    .reduce((acc, line) => {
      const raw = String(line || "").trim();
      if (!raw || raw.startsWith("#")) return acc;
      const separator = raw.indexOf("=");
      if (separator <= 0) return acc;
      const key = raw.slice(0, separator).trim();
      const value = raw.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

function loadLocalEnvSnapshot() {
  const files = [".env", ".env.local"];
  const values = {};
  files.forEach((file) => {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) return;
    const parsed = parseSimpleEnv(fs.readFileSync(fullPath, "utf8"));
    Object.assign(values, parsed);
  });
  return values;
}

function parseArgs(argv) {
  const options = {
    format: "table",
    includeLocalFiles: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--help") options.help = true;
    else if (arg === "--no-local-files") options.includeLocalFiles = false;
    else if (arg === "--format") {
      const value = String(argv[i + 1] || "").toLowerCase();
      if (!value || value.startsWith("--")) throw new Error("Missing value for --format");
      if (value !== "table" && value !== "json") throw new Error(`Invalid format "${value}"`);
      options.format = value;
      i += 1;
    } else {
      throw new Error(`Unknown option "${arg}"`);
    }
  }
  return options;
}

const HELP_TEXT = `Usage:
  node scripts/config-health.js [options]

Options:
  --format <table|json>      Output mode (default: table)
  --no-local-files           Ignore .env/.env.local file values
  --help                     Show this help
`;

function fit(text, width) {
  const raw = String(text ?? "");
  if (raw.length === width) return raw;
  if (raw.length > width) return `${raw.slice(0, Math.max(0, width - 3))}...`;
  return `${raw}${" ".repeat(width - raw.length)}`;
}

function renderTable(payload) {
  const lines = [];
  lines.push(`Config Health @ ${payload.asOf}`);
  lines.push(`Provider: ${payload.provider}`);
  lines.push(
    `Profiles: zerodhaLive=${payload.profiles.zerodhaLiveReady ? "yes" : "no"} | ` +
      `pkscreenerLive=${payload.profiles.pkscreenerLiveReady ? "yes" : "no"} | ` +
      `supabase=${payload.profiles.supabaseReady ? "yes" : "no"} | ` +
      `liveTrading=${payload.profiles.liveTradingEnabled ? "enabled" : "disabled"}`,
  );
  lines.push("");

  const widths = [28, 14, 8, 6, 36];
  const header = ["Key", "Group", "Required", "Set", "Value"].map((entry, idx) => fit(entry, widths[idx])).join(" | ");
  lines.push(header);
  lines.push(widths.map((width) => "-".repeat(width)).join("-+-"));

  payload.checks.forEach((check) => {
    lines.push(
      [check.key, check.group, check.required ? "yes" : "no", check.present ? "yes" : "no", check.maskedValue || "-"]
        .map((entry, idx) => fit(entry, widths[idx]))
        .join(" | "),
    );
  });

  lines.push("");
  lines.push("Warnings");
  if (!payload.warnings.length) {
    lines.push("- none");
  } else {
    payload.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  return `${lines.join("\n")}\n`;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const mergedEnv = {
    ...(options.includeLocalFiles ? loadLocalEnvSnapshot() : {}),
    ...process.env,
  };
  const payload = inspectConfig(mergedEnv);
  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderTable(payload));
}

run().catch((error) => {
  process.stderr.write(`config-health failed: ${error.message || String(error)}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
