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
  "technical-candles": {
    path: "/api/v1/technical/candles/scan",
    contractVersion: CONTRACTS.technical,
  },
};

function quantEngineBaseUrl() {
  const raw = String(process.env.QUANT_ENGINE_URL || "http://localhost:8000").trim();
  return raw.replace(/\/$/, "");
}

function quantEngineConfigError() {
  const base = quantEngineBaseUrl();
  const isLocal = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(?::\d+)?$/i.test(base);
  if (process.env.VERCEL && isLocal) {
    return "QUANT_ENGINE_URL points to localhost in Vercel runtime. Set QUANT_ENGINE_URL to your public quant-engine URL.";
  }
  return "";
}

function withMeta(payload, traceId, contractVersion) {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      meta: {
        contractVersion: contractVersion || CONTRACTS.quant,
        traceId,
      },
    };
  }
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
    const hasRawBody = Boolean(body && body.rawBody);
    const requestHeaders = {
      Accept: "application/json",
      "x-trace-id": traceId,
    };
    if (hasRawBody) {
      requestHeaders["Content-Type"] = String(body.contentType || "application/octet-stream");
    } else {
      requestHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(`${quantEngineBaseUrl()}${pathname}`, {
      method: "POST",
      headers: requestHeaders,
      body: hasRawBody ? body.rawBody : JSON.stringify((body && body.jsonBody) || {}),
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

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);

  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "quant-proxy-api");
  const configError = quantEngineConfigError();
  if (configError) {
    return json(
      res,
      503,
      withMeta(
        {
          error: "quant-config-error",
          message: configError,
        },
        trace.traceId,
        CONTRACTS.quant,
      ),
    );
  }

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
          message: "Supported routes: optimize-allocation, thematic-rotation, earnings-chat, earnings-sync, interpret, technical-candles",
        },
        trace.traceId,
        contractVersion,
      ),
    );
  }

  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const contentType = String(req.headers?.["content-type"] || "").toLowerCase();
    const isMultipartSync = route === "earnings-sync" && contentType.includes("multipart/form-data");
    const body = isMultipartSync
      ? {
          rawBody: await readRawBody(req),
          contentType: req.headers?.["content-type"] || "application/octet-stream",
        }
      : {
          jsonBody: await parseJsonBody(req),
        };

    const forwarded = await forwardQuantRequest(targetPath, body, trace.traceId);
    traceLog(trace, "info", "quant.proxy.success", {
      route,
      status: forwarded.status,
    });
    return json(res, forwarded.status, withMeta(forwarded.payload, trace.traceId, contractVersion));
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    const statusCode = timedOut ? 504 : 502;
    const message = timedOut
      ? "Quant engine request timed out"
      : error?.message === "fetch failed"
        ? `Unable to reach quant engine at ${quantEngineBaseUrl()}. Verify QUANT_ENGINE_URL and quant-engine uptime.`
        : error.message || "Quant engine unavailable";
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
