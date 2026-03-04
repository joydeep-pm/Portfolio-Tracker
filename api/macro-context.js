const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { exchangeKey, json, methodNotAllowed, parseJsonBody } = require("./_lib/http");
const { analyzeMacroContext } = require("./_lib/macroContextEngine");

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const key = String(value).toLowerCase();
  if (["1", "true", "yes", "y"].includes(key)) return true;
  if (["0", "false", "no", "n"].includes(key)) return false;
  return fallback;
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "macro-context-api");
  const route = String(req.query?.route || "analyze").toLowerCase();

  if (route !== "analyze") {
    return json(res, 404, {
      error: "Not found",
      meta: {
        contractVersion: CONTRACTS.macroContext,
        traceId: trace.traceId,
      },
    });
  }

  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res);

  try {
    const body = req.method === "POST" ? await parseJsonBody(req) : {};
    const symbol = String(body.symbol || req.query?.symbol || "").trim();
    const themeHint = String(body.theme || body.themeHint || req.query?.theme || req.query?.themeHint || "").trim();
    const payload = await analyzeMacroContext({
      symbol,
      themeHint,
      exchange: exchangeKey(body.exchange || req.query?.exchange),
      limit: toInt(body.limit ?? req.query?.limit, 30),
      includeProcessed: toBool(body.includeProcessed ?? req.query?.includeProcessed, false),
      includePromptDraft: toBool(body.includePromptDraft ?? req.query?.includePromptDraft, false),
    });

    traceLog(trace, "info", "macro.context.success", {
      symbol: payload.symbol,
      sentiment: payload.sentiment_score,
      consideredEvents: payload.considered_events,
      impactedClusters: payload.impacted_clusters.length,
    });

    return json(res, 200, {
      ...payload,
      meta: {
        contractVersion: CONTRACTS.macroContext,
        traceId: trace.traceId,
      },
    });
  } catch (error) {
    traceLog(trace, "error", "macro.context.failed", {
      message: error.message,
    });

    return json(res, 500, {
      error: "macro-context-analysis-failed",
      message: error.message,
      meta: {
        contractVersion: CONTRACTS.macroContext,
        traceId: trace.traceId,
      },
    });
  }
};
