const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, methodNotAllowed, parseJsonBody } = require("./_lib/http");

const ROUTE_CONFIG = {
  "optimize-allocation": {
    path: "/api/v1/quant/optimize-allocation",
    contractVersion: CONTRACTS.quant,
  },
  "thematic-rotation": {
    path: "/api/v1/quant/backtests/thematic-rotation",
    contractVersion: CONTRACTS.quant,
  },
  "earnings-chat": {
    path: "/api/v1/research/earnings/chat",
    contractVersion: CONTRACTS.research,
  },
  "earnings-sync": {
    path: "/api/v1/research/earnings/sync",
    contractVersion: CONTRACTS.research,
  },
  interpret: {
    path: "/api/v1/commands/interpret",
    contractVersion: CONTRACTS.commands,
  },
};

function quantEngineBaseUrl() {
  const raw = String(process.env.QUANT_ENGINE_URL || "http://localhost:8000").trim();
  return raw.replace(/\/$/, "");
}

function withMeta(payload, traceId, contractVersion) {
  return {
    ...(payload || {}),
    meta: {
      contractVersion: contractVersion || CONTRACTS.quant,
      traceId,
    },
  };
}

async function forwardQuantRequest(pathname, body, traceId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

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
      const payload = await response.json();
      return {
        status: response.status,
        payload,
      };
    }

    const text = await response.text();
    return {
      status: response.status,
      payload: {
        error: "quant-non-json-response",
        message: text || "Quant engine returned non-JSON payload",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "quant-proxy-api");
  const route = String(req.query?.route || "").toLowerCase();
  const routeConfig = ROUTE_CONFIG[route];
  const targetPath = routeConfig?.path;
  const contractVersion = routeConfig?.contractVersion || CONTRACTS.quant;

  if (!targetPath) {
    return json(
      res,
      404,
      withMeta(
        {
          error: "not-found",
          message: "Supported routes: optimize-allocation, thematic-rotation, earnings-chat, earnings-sync, interpret",
        },
        trace.traceId,
        contractVersion,
      ),
    );
  }

  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const body = await parseJsonBody(req);
    const forwarded = await forwardQuantRequest(targetPath, body, trace.traceId);
    traceLog(trace, "info", "quant.proxy.success", {
      route,
      status: forwarded.status,
    });
    return json(res, forwarded.status, withMeta(forwarded.payload, trace.traceId, contractVersion));
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    const statusCode = timedOut ? 504 : 502;
    const message = timedOut ? "Quant engine request timed out" : error.message || "Quant engine unavailable";
    traceLog(trace, "error", "quant.proxy.failed", { route, message });
    return json(
      res,
      statusCode,
      withMeta(
        {
          error: timedOut ? "quant-timeout" : "quant-proxy-failed",
          message,
        },
        trace.traceId,
        contractVersion,
      ),
    );
  }
};
