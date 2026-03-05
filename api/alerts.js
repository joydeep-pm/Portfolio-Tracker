const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, methodNotAllowed, parseJsonBody } = require("./_lib/http");

const ROUTE_CONFIG = {
  test: {
    method: "POST",
    path: "/api/v1/alerts/test",
  },
  dispatch: {
    method: "POST",
    path: "/api/v1/alerts/dispatch",
  },
  events: {
    method: "GET",
    path: "/api/v1/alerts/events",
  },
};

function quantEngineBaseUrl() {
  const raw = String(process.env.QUANT_ENGINE_URL || "http://localhost:8000").trim();
  return raw.replace(/\/$/, "");
}

function withMeta(payload, traceId) {
  return {
    ...(payload || {}),
    meta: {
      contractVersion: CONTRACTS.alerts,
      traceId,
    },
  };
}

async function forwardRequest({ method, pathname, body, traceId, query = {} }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  try {
    const targetUrl = new URL(`${quantEngineBaseUrl()}${pathname}`);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      targetUrl.searchParams.set(key, String(value));
    });

    const response = await fetch(targetUrl.toString(), {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-trace-id": traceId,
      },
      ...(method === "POST" ? { body: JSON.stringify(body || {}) } : {}),
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
        error: "alerts-non-json-response",
        message: text || "Alerts service returned non-JSON payload",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "alerts-proxy-api");
  const route = String(req.query?.route || "").toLowerCase();
  const routeConfig = ROUTE_CONFIG[route];
  if (!routeConfig) {
    return json(
      res,
      404,
      withMeta(
        {
          error: "not-found",
          message: "Supported routes: test, dispatch, events",
        },
        trace.traceId,
      ),
    );
  }

  if (req.method !== routeConfig.method) {
    if (routeConfig.method === "GET") {
      return methodNotAllowed(res);
    }
    return methodNotAllowed(res);
  }

  try {
    const body = routeConfig.method === "POST" ? await parseJsonBody(req) : null;
    const query = route === "events" ? { limit: req.query?.limit } : {};
    const forwarded = await forwardRequest({
      method: routeConfig.method,
      pathname: routeConfig.path,
      body,
      traceId: trace.traceId,
      query,
    });
    traceLog(trace, "info", "alerts.proxy.success", {
      route,
      status: forwarded.status,
    });
    return json(res, forwarded.status, withMeta(forwarded.payload, trace.traceId));
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    const statusCode = timedOut ? 504 : 502;
    const message = timedOut ? "Alerts service request timed out" : error.message || "Alerts service unavailable";
    traceLog(trace, "error", "alerts.proxy.failed", { route, message });
    return json(
      res,
      statusCode,
      withMeta(
        {
          error: timedOut ? "alerts-timeout" : "alerts-proxy-failed",
          message,
        },
        trace.traceId,
      ),
    );
  }
};
