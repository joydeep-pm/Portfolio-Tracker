const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { exchangeKey, json, methodNotAllowed, parseJsonBody } = require("./_lib/http");
const { runHarvester, getLatestFromDb } = require("./_lib/macroHarvester");
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
  const trace = initTrace(req, res, "macro-api");
  const route = String(req.query?.route || "latest").toLowerCase();

  if (route === "context" || route === "analyze") {
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
      const message = String(error?.message || "macro context analysis failed");
      const storageError = /(unable to open database file|SQLITE|ENOENT|EACCES|EROFS)/i.test(message);

      traceLog(trace, storageError ? "warn" : "error", "macro.context.failed", {
        message,
        storageError,
      });

      if (storageError) {
        return json(res, 200, {
          asOf: new Date().toISOString(),
          exchange: exchangeKey(req.query?.exchange),
          symbol: String(req.query?.symbol || "").trim().toUpperCase() || null,
          theme_hint: String(req.query?.theme || req.query?.themeHint || "").trim() || null,
          sentiment_score: 0,
          key_catalyst: "No high-signal regulatory catalyst detected in current fetch window.",
          impacted_clusters: [],
          rationale_summary:
            "Macro/regulatory storage is currently unavailable, so context is returning a neutral view. Retry after backend harvest initializes writable storage.",
          considered_events: 0,
          sources: [],
          source_events: [],
          model: "heuristic-v1",
          processed_count: 0,
          reason: "storage-unavailable",
          meta: {
            contractVersion: CONTRACTS.macroContext,
            traceId: trace.traceId,
          },
        });
      }

      return json(res, 500, {
        error: "macro-context-analysis-failed",
        message,
        meta: {
          contractVersion: CONTRACTS.macroContext,
          traceId: trace.traceId,
        },
      });
    }
  }

  if (route === "harvest") {
    if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res);

    try {
      const payload = await runHarvester({
        maxItemsPerSource: toInt(req.query?.perSource, 40),
        latestLimit: toInt(req.query?.limit, 25),
      });

      traceLog(trace, "info", "macro.harvest.success", {
        fetchedCount: payload.fetchedCount,
        insertedCount: payload.insertedCount,
        duplicateCount: payload.duplicateCount,
      });

      return json(res, 200, {
        ...payload,
        meta: {
          contractVersion: CONTRACTS.macro,
          traceId: trace.traceId,
        },
      });
    } catch (error) {
      traceLog(trace, "error", "macro.harvest.failed", { message: error.message });
      return json(res, 500, {
        error: "macro-harvest-failed",
        message: error.message,
        meta: {
          contractVersion: CONTRACTS.macro,
          traceId: trace.traceId,
        },
      });
    }
  }

  if (route === "latest") {
    if (req.method !== "GET") return methodNotAllowed(res);

    try {
      const payload = getLatestFromDb({
        limit: toInt(req.query?.limit, 25),
      });

      traceLog(trace, "info", "macro.latest.success", {
        count: payload.count,
      });

      return json(res, 200, {
        ...payload,
        meta: {
          contractVersion: CONTRACTS.macro,
          traceId: trace.traceId,
        },
      });
    } catch (error) {
      traceLog(trace, "error", "macro.latest.failed", { message: error.message });
      return json(res, 500, {
        error: "macro-latest-failed",
        message: error.message,
        meta: {
          contractVersion: CONTRACTS.macro,
          traceId: trace.traceId,
        },
      });
    }
  }

  return json(res, 404, {
    error: "Not found",
    meta: {
      contractVersion: CONTRACTS.macro,
      traceId: trace.traceId,
    },
  });
};
