const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, methodNotAllowed, parseJsonBody } = require("./_lib/http");

const ROUTE_CONFIG = {
  test: {
    methods: ["POST"],
    targetMethod: "POST",
    path: "/api/v1/alerts/test",
  },
  enqueue: {
    methods: ["POST"],
    targetMethod: "POST",
    path: "/api/v1/alerts/enqueue",
  },
  dispatch: {
    methods: ["POST", "GET"],
    targetMethod: "POST",
    path: "/api/v1/alerts/dispatch",
  },
  events: {
    methods: ["GET"],
    targetMethod: "GET",
    path: "/api/v1/alerts/events",
  },
  channels: {
    methods: ["GET"],
    targetMethod: "GET",
    path: "/api/v1/alerts/channels/status",
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

function withMeta(payload, traceId) {
  return {
    ...(payload || {}),
    meta: {
      contractVersion: CONTRACTS.alerts,
      traceId,
    },
  };
}

function isAuthorizedCronRequest(req) {
  const expected = String(process.env.CRON_SECRET || "").trim();
  if (!expected) return false;
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  if (!authHeader) return false;
  return authHeader === `Bearer ${expected}`;
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
  const configError = quantEngineConfigError();
  if (configError) {
    return json(
      res,
      503,
      withMeta(
        {
          error: "alerts-config-error",
          message: configError,
        },
        trace.traceId,
      ),
    );
  }

  const route = String(req.query?.route || "").toLowerCase();
  const routeConfig = ROUTE_CONFIG[route];
  if (!routeConfig) {
    return json(
      res,
      404,
      withMeta(
        {
          error: "not-found",
          message: "Supported routes: test, enqueue, dispatch, events, channels",
        },
        trace.traceId,
      ),
    );
  }

  if (!routeConfig.methods.includes(req.method)) {
    return methodNotAllowed(res);
  }

  try {
    const isCronDispatch = route === "dispatch" && req.method === "GET";
    if (isCronDispatch) {
      if (!process.env.CRON_SECRET) {
        return json(
          res,
          503,
          withMeta(
            {
              error: "alerts-cron-misconfigured",
              message: "CRON_SECRET is not set. Add CRON_SECRET in Vercel project settings.",
            },
            trace.traceId,
          ),
        );
      }
      if (!isAuthorizedCronRequest(req)) {
        return json(
          res,
          401,
          withMeta(
            {
              error: "alerts-cron-unauthorized",
              message: "Unauthorized cron request",
            },
            trace.traceId,
          ),
        );
      }
    }

    const body = routeConfig.targetMethod === "POST" ? await parseJsonBody(req) : null;
    const query = route === "events" ? { limit: req.query?.limit } : {};
    const forwarded = await forwardRequest({
      method: routeConfig.targetMethod,
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
    const message = timedOut
      ? "Alerts service request timed out"
      : error?.message === "fetch failed"
        ? `Unable to reach quant engine at ${quantEngineBaseUrl()}. Verify QUANT_ENGINE_URL and quant-engine uptime.`
        : error.message || "Alerts service unavailable";
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
