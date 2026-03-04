const { getHotspotSnapshot, pollHotspots } = require("./_lib/hotspotService");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { exchangeKey, json, methodNotAllowed } = require("./_lib/http");

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "hotspots-api");
  const route = String(req.query?.route || "").toLowerCase();

  if (route === "snapshot") {
    if (req.method !== "GET") return methodNotAllowed(res);

    try {
      const payload = await getHotspotSnapshot({
        exchange: exchangeKey(req.query?.exchange),
        forceRefresh: String(req.query?.refresh || "").toLowerCase() === "true",
      });
      traceLog(trace, "info", "hotspots.snapshot.success", {
        hotspots: Array.isArray(payload.hotspots) ? payload.hotspots.length : 0,
      });
      return json(res, 200, {
        ...payload,
        meta: {
          contractVersion: CONTRACTS.hotspots,
          traceId: trace.traceId,
        },
      });
    } catch (error) {
      traceLog(trace, "error", "hotspots.snapshot.failed", { message: error.message });
      return json(res, 500, {
        error: "hotspot-snapshot-failed",
        message: error.message,
        meta: {
          contractVersion: CONTRACTS.hotspots,
          traceId: trace.traceId,
        },
      });
    }
  }

  if (route === "poll") {
    if (req.method !== "GET") return methodNotAllowed(res);

    try {
      const payload = await pollHotspots({
        exchange: exchangeKey(req.query?.exchange),
        cursor: req.query?.cursor || "",
      });
      traceLog(trace, "info", "hotspots.poll.success", {
        updates: Array.isArray(payload?.updates?.hotspots) ? payload.updates.hotspots.length : 0,
      });
      return json(res, 200, {
        ...payload,
        meta: {
          contractVersion: CONTRACTS.hotspots,
          traceId: trace.traceId,
        },
      });
    } catch (error) {
      traceLog(trace, "error", "hotspots.poll.failed", { message: error.message });
      return json(res, 500, {
        error: "hotspot-poll-failed",
        message: error.message,
        meta: {
          contractVersion: CONTRACTS.hotspots,
          traceId: trace.traceId,
        },
      });
    }
  }

  return json(res, 404, {
    error: "Not found",
    meta: {
      contractVersion: CONTRACTS.hotspots,
      traceId: trace.traceId,
    },
  });
};
