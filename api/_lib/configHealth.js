const DEFAULT_PROVIDER = "kite-direct";

const CONFIG_KEYS = [
  { key: "BROKER_PROVIDER", group: "core", required: false },
  { key: "MAX_ORDER_VALUE_INR", group: "core", required: false },
  { key: "ENABLE_LIVE_TRADING", group: "core", required: false },
  { key: "KITE_API_KEY", group: "zerodha", required: true, secret: true },
  { key: "KITE_API_SECRET", group: "zerodha", required: true, secret: true },
  { key: "KITE_REDIRECT_URL", group: "zerodha", required: false },
  { key: "KITE_ACCESS_TOKEN", group: "zerodha", required: false, secret: true },
  { key: "SUPABASE_URL", group: "storage", required: false },
  { key: "SUPABASE_SERVICE_ROLE_KEY", group: "storage", required: false, secret: true },
  { key: "ENABLE_PKSCREENER_LIVE", group: "scanner", required: false },
  { key: "PKSCREENER_CMD", group: "scanner", required: false },
  { key: "ANGEL_API_KEY", group: "angel_optional", required: false, secret: true },
  { key: "ANGEL_HISTORICAL_API_KEY", group: "angel_optional", required: false, secret: true },
  { key: "ANGEL_CLIENT_CODE", group: "angel_optional", required: false },
  { key: "ANGEL_PIN", group: "angel_optional", required: false, secret: true },
  { key: "ANGEL_TOTP_SECRET", group: "angel_optional", required: false, secret: true },
  { key: "ENABLE_ANGEL_MARKET_DATA", group: "angel_optional", required: false },
];

function toBool(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function normalizeProvider(value) {
  const provider = String(value || DEFAULT_PROVIDER).trim().toLowerCase();
  if (provider === "kite-mcp" || provider === "kite-direct") return provider;
  return DEFAULT_PROVIDER;
}

function maskValue(value, isSecret) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!isSecret) return text;
  if (text.length <= 4) return "*".repeat(text.length);
  return `${text.slice(0, 2)}${"*".repeat(Math.max(1, text.length - 4))}${text.slice(-2)}`;
}

function inspectConfig(env = process.env) {
  const checks = CONFIG_KEYS.map((entry) => {
    const raw = env[entry.key];
    const present = typeof raw === "string" && String(raw).trim().length > 0;
    return {
      key: entry.key,
      group: entry.group,
      required: Boolean(entry.required),
      present,
      maskedValue: present ? maskValue(raw, Boolean(entry.secret)) : "",
    };
  });

  const byKey = Object.fromEntries(checks.map((check) => [check.key, check]));
  const provider = normalizeProvider(env.BROKER_PROVIDER);
  const liveTradingEnabled = toBool(env.ENABLE_LIVE_TRADING);
  const pkscreenerLive = toBool(env.ENABLE_PKSCREENER_LIVE);
  const angelMarketDataEnabledRaw = env.ENABLE_ANGEL_MARKET_DATA;
  const angelMarketDataEnabled =
    angelMarketDataEnabledRaw === undefined || String(angelMarketDataEnabledRaw).trim() === ""
      ? true
      : toBool(angelMarketDataEnabledRaw);
  const angelMarketDataReady = Boolean(
    byKey.ANGEL_API_KEY?.present && byKey.ANGEL_CLIENT_CODE?.present && byKey.ANGEL_PIN?.present && byKey.ANGEL_TOTP_SECRET?.present,
  );
  const angelHistoricalReady = Boolean(byKey.ANGEL_HISTORICAL_API_KEY?.present || byKey.ANGEL_API_KEY?.present);

  const zerodhaLiveReady = Boolean(byKey.KITE_API_KEY?.present && byKey.KITE_API_SECRET?.present);
  const pkscreenerLiveReady = !pkscreenerLive || Boolean(byKey.PKSCREENER_CMD?.present);
  const supabaseReady = Boolean(byKey.SUPABASE_URL?.present && byKey.SUPABASE_SERVICE_ROLE_KEY?.present);
  const liveTradingReady = !liveTradingEnabled || zerodhaLiveReady;

  const warnings = [
    !zerodhaLiveReady ? "Zerodha live mode is not fully configured (missing KITE_API_KEY/KITE_API_SECRET)." : null,
    pkscreenerLive && !pkscreenerLiveReady ? "ENABLE_PKSCREENER_LIVE=true requires PKSCREENER_CMD." : null,
    liveTradingEnabled && !liveTradingReady ? "ENABLE_LIVE_TRADING=true requires Zerodha live credentials." : null,
    !supabaseReady ? "Supabase snapshot persistence is disabled (memory fallback active)." : null,
    angelMarketDataEnabled && !angelMarketDataReady
      ? "Angel market-data overlay is enabled but ANGEL_* credentials are incomplete; quote feed falls back to Zerodha/demo."
      : null,
    angelMarketDataEnabled && angelMarketDataReady && !byKey.ANGEL_HISTORICAL_API_KEY?.present
      ? "ANGEL_HISTORICAL_API_KEY is not set; historical returns currently reuse ANGEL_API_KEY."
      : null,
  ].filter(Boolean);

  return {
    asOf: new Date().toISOString(),
    provider,
    checks,
    profiles: {
      zerodhaLiveReady,
      pkscreenerLiveReady,
      supabaseReady,
      liveTradingEnabled,
      liveTradingReady,
      angelMarketDataEnabled,
      angelMarketDataReady,
      angelHistoricalReady,
    },
    warnings,
  };
}

module.exports = {
  CONFIG_KEYS,
  inspectConfig,
  normalizeProvider,
  toBool,
};
