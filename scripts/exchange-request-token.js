#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function parseEnv(content) {
  return String(content || "")
    .split(/\r?\n/g)
    .reduce((acc, line) => {
      const raw = String(line || "").trim();
      if (!raw || raw.startsWith("#")) return acc;
      const idx = raw.indexOf("=");
      if (idx <= 0) return acc;
      const key = raw.slice(0, idx).trim();
      const value = raw.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

function loadLocalEnv() {
  const out = {};
  [".env.local", ".env"].forEach((file) => {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) return;
    Object.assign(out, parseEnv(fs.readFileSync(fullPath, "utf8")));
  });
  return out;
}

function parseArgs(argv) {
  const options = {
    requestToken: "",
    writeEnv: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--no-write-env") {
      options.writeEnv = false;
      continue;
    }
    const value = argv[i + 1];
    if (!value || String(value).startsWith("--")) throw new Error(`Missing value for ${arg}`);
    i += 1;
    if (arg === "--request-token") options.requestToken = String(value).trim();
    else throw new Error(`Unknown option "${arg}"`);
  }

  return options;
}

const HELP_TEXT = `Usage:
  node scripts/exchange-request-token.js --request-token <token> [options]

Options:
  --no-write-env     Do not write KITE_ACCESS_TOKEN to .env.local
`;

function mask(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 8) return "*".repeat(text.length);
  return `${text.slice(0, 4)}${"*".repeat(text.length - 8)}${text.slice(-4)}`;
}

function upsertEnvValue(filePath, key, value) {
  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split(/\r?\n/g) : [];
  let replaced = false;
  const next = lines.map((line) => {
    if (String(line).startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!replaced) next.push(`${key}=${value}`);
  fs.writeFileSync(filePath, `${next.join("\n").replace(/\n+$/g, "")}\n`, "utf8");
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }
  if (!options.requestToken) {
    throw new Error("--request-token is required");
  }

  const local = loadLocalEnv();
  const apiKey = String(process.env.KITE_API_KEY || local.KITE_API_KEY || "").trim();
  const apiSecret = String(process.env.KITE_API_SECRET || local.KITE_API_SECRET || "").trim();
  if (!apiKey || !apiSecret) {
    throw new Error("KITE_API_KEY and KITE_API_SECRET are required in env or .env.local");
  }

  const checksum = crypto
    .createHash("sha256")
    .update(`${apiKey}${options.requestToken}${apiSecret}`)
    .digest("hex");
  const body = new URLSearchParams({
    api_key: apiKey,
    request_token: options.requestToken,
    checksum,
  });

  const response = await fetch("https://api.kite.trade/session/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Kite-Version": "3",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === "error") {
    throw new Error(payload?.message || `Kite token exchange failed (${response.status})`);
  }

  const accessToken = String(payload?.data?.access_token || "").trim();
  if (!accessToken) throw new Error("Kite response missing access_token");

  let envLocalUpdated = false;
  if (options.writeEnv) {
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    upsertEnvValue(envLocalPath, "KITE_ACCESS_TOKEN", accessToken);
    envLocalUpdated = true;
  }

  const artifactPath = path.resolve(process.cwd(), "artifacts", "kite-token-exchange.json");
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    `${JSON.stringify(
      {
        exchangedAt: new Date().toISOString(),
        userId: payload?.data?.user_id || null,
        userName: payload?.data?.user_name || payload?.data?.user_shortname || null,
        accessTokenMasked: mask(accessToken),
        envLocalUpdated,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        userId: payload?.data?.user_id || null,
        userName: payload?.data?.user_name || payload?.data?.user_shortname || null,
        accessTokenMasked: mask(accessToken),
        envLocalUpdated,
        artifactPath,
      },
      null,
      2,
    )}\n`,
  );
}

run().catch((error) => {
  process.stderr.write(`exchange-request-token failed: ${error.message || String(error)}\n`);
  process.stderr.write("Use --help for usage.\n");
  process.exitCode = 1;
});
