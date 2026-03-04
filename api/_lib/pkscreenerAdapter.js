const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const SUPPORTED_SCAN_TYPES = ["breakout", "consolidation", "momentum_anomaly"];

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeExchange(value) {
  const key = toText(value, "NSE").toUpperCase();
  if (key === "NSE" || key === "BSE") return key;
  return "NSE";
}

function normalizeScanType(value) {
  const key = toText(value).toLowerCase();
  return SUPPORTED_SCAN_TYPES.includes(key) ? key : "";
}

function hashUnit(text) {
  const hex = crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
  const num = Number.parseInt(hex, 16);
  return (num % 10001) / 10000;
}

function deterministicScanFlags(instruments = [], asOf = new Date().toISOString()) {
  return instruments.map((item) => {
    const symbol = toText(item.symbol).toUpperCase();
    const exchange = normalizeExchange(item.exchange);
    const key = `${exchange}:${symbol}`;

    const breakoutScore = hashUnit(`${key}|breakout|${asOf}`);
    const consolidationScore = hashUnit(`${key}|consolidation|${asOf}`);
    const momentumScore = hashUnit(`${key}|momentum|${asOf}`);

    const scanFlags = [];
    if (breakoutScore >= 0.64) {
      scanFlags.push({
        type: "breakout",
        signal: breakoutScore >= 0.82 ? "strong" : "moderate",
        score: Number.parseFloat((breakoutScore * 100).toFixed(2)),
      });
    }
    if (consolidationScore >= 0.68) {
      scanFlags.push({
        type: "consolidation",
        signal: consolidationScore >= 0.84 ? "tight-range" : "range-bound",
        score: Number.parseFloat((consolidationScore * 100).toFixed(2)),
      });
    }
    if (momentumScore <= 0.26 || momentumScore >= 0.74) {
      scanFlags.push({
        type: "momentum_anomaly",
        signal: momentumScore >= 0.74 ? "upside-acceleration" : "downside-acceleration",
        score: Number.parseFloat((Math.abs(momentumScore - 0.5) * 200).toFixed(2)),
      });
    }

    return {
      symbol,
      exchange,
      instrument: key,
      scanFlags,
      source: "synthetic-pkscreener",
    };
  });
}

function normalizeLiveScanPayload(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => {
      const symbol = toText(row.symbol || row.tradingsymbol).toUpperCase();
      if (!symbol) return null;

      const exchange = normalizeExchange(row.exchange);
      const rawFlags = Array.isArray(row.scanFlags) ? row.scanFlags : [];
      const scanFlags = rawFlags
        .map((flag) => {
          const type = normalizeScanType(flag.type || flag.scanType || flag.name);
          if (!type) return null;
          return {
            type,
            signal: toText(flag.signal || flag.label || "detected"),
            score: Number.parseFloat(Number(flag.score || 0).toFixed(2)),
          };
        })
        .filter(Boolean);

      return {
        symbol,
        exchange,
        instrument: `${exchange}:${symbol}`,
        scanFlags,
        source: "live-pkscreener",
      };
    })
    .filter(Boolean);
}

function runLiveCommand(command, timeoutMs = 25_000) {
  if (!command) return null;
  const result = spawnSync(command, {
    shell: true,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) return null;
  if (result.status !== 0) return null;
  const output = String(result.stdout || "").trim();
  if (!output) return null;
  try {
    return JSON.parse(output);
  } catch (_error) {
    return null;
  }
}

async function runPkScreenerScans(options = {}) {
  const instruments = Array.isArray(options.instruments) ? options.instruments : [];
  const asOf = toText(options.asOf, new Date().toISOString());
  const liveEnabled = String(process.env.ENABLE_PKSCREENER_LIVE || "false").toLowerCase() === "true";
  const command = toText(process.env.PKSCREENER_CMD);

  if (liveEnabled && command) {
    const payload = runLiveCommand(command);
    const liveRows = payload ? normalizeLiveScanPayload(payload) : [];
    if (liveRows.length) {
      return {
        asOf,
        source: "live-pkscreener",
        rows: liveRows,
      };
    }
  }

  return {
    asOf,
    source: "synthetic-pkscreener",
    rows: deterministicScanFlags(instruments, asOf),
  };
}

module.exports = {
  SUPPORTED_SCAN_TYPES,
  deterministicScanFlags,
  normalizeLiveScanPayload,
  runPkScreenerScans,
};
