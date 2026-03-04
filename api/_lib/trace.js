const crypto = require("node:crypto");

function generateTraceId() {
  const rand = crypto.randomBytes(4).toString("hex");
  return `pt-${Date.now()}-${rand}`;
}

function getIncomingTraceId(req) {
  const headers = req?.headers || {};
  const value = headers["x-trace-id"] || headers["X-Trace-Id"] || headers["x-traceid"] || headers["trace-id"];
  const id = String(value || "").trim();
  return id || "";
}

function initTrace(req, res, component) {
  const traceId = getIncomingTraceId(req) || generateTraceId();
  if (typeof res?.setHeader === "function") {
    res.setHeader("x-trace-id", traceId);
  }
  return {
    traceId,
    component: String(component || "unknown"),
    startedAtMs: Date.now(),
  };
}

function traceLog(context, level, event, details = {}) {
  const payload = {
    level: String(level || "info"),
    event: String(event || "event"),
    traceId: context?.traceId || "",
    component: context?.component || "",
    elapsedMs: Math.max(0, Date.now() - Number(context?.startedAtMs || Date.now())),
    details,
  };

  const line = JSON.stringify(payload);
  if (payload.level === "error") console.error(line);
  else console.log(line);
}

module.exports = {
  initTrace,
  traceLog,
};
