const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, methodNotAllowed } = require("./_lib/http");
const { runHarvester, getLatestFromDb } = require("./_lib/macroHarvester");

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "macro-api");
  const route = String(req.query?.route || "latest").toLowerCase();

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
