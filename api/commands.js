const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, methodNotAllowed, parseJsonBody } = require("./_lib/http");

const ROUTE_PATHS = {
  interpret: "/api/v1/commands/interpret",
};

function quantEngineBaseUrl() {
  const raw = String(process.env.QUANT_ENGINE_URL || "http://localhost:8000").trim();
  return raw.replace(/\/$/, "");
}

function withMeta(payload, traceId) {
  return {
    ...(payload || {}),
    meta: {
      contractVersion: CONTRACTS.commands,
      traceId,
    },
  };
}

async function forwardRequest(pathname, body, traceId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${quantEngineBaseUrl()}${pathname}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-trace-id": traceId,
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      return {
        status: response.status,
        payload: await response.json(),
      };
    }

    const text = await response.text();
    return {
      status: response.status,
      payload: {
        error: "commands-non-json-response",
        message: text || "Command worker returned non-JSON payload",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "commands-proxy-api");
  const route = String(req.query?.route || "").toLowerCase();
  const targetPath = ROUTE_PATHS[route];

  if (!targetPath) {
    return json(
      res,
      404,
      withMeta(
        {
          error: "not-found",
          message: "Supported route: interpret",
        },
        trace.traceId,
      ),
    );
  }

  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const body = await parseJsonBody(req);
    const forwarded = await forwardRequest(targetPath, body, trace.traceId);
    traceLog(trace, "info", "commands.proxy.success", {
      route,
      status: forwarded.status,
    });
    return json(res, forwarded.status, withMeta(forwarded.payload, trace.traceId));
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    const statusCode = timedOut ? 504 : 502;
    const message = timedOut ? "Command worker request timed out" : error.message || "Command worker unavailable";
    traceLog(trace, "error", "commands.proxy.failed", { route, message });
    return json(
      res,
      statusCode,
      withMeta(
        {
          error: timedOut ? "commands-timeout" : "commands-proxy-failed",
          message,
        },
        trace.traceId,
      ),
    );
  }
};
