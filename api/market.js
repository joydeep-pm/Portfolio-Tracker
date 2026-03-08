const mockMarket = require("./_lib/mockMarket");
const { buildLiveMarketView } = require("./_lib/angelLiveMarket");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { json, parseCookies } = require("./_lib/http");

function toBool(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "1" || key === "true" || key === "yes" || key === "y";
}

function angelSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const accessToken = String(cookies.pt_angel_jwt || "").trim();
  const clientCode = String(cookies.pt_angel_client || "").trim();
  const expiresAt = String(cookies.pt_angel_expires || "").trim();
  const expiresMs = new Date(expiresAt).getTime();
  const connected = Boolean(accessToken && clientCode && Number.isFinite(expiresMs) && Date.now() < expiresMs);

  return {
    connected,
    accessToken,
    clientCode,
    expiresAt: expiresAt || null,
  };
}

function liveMarketEnabled() {
  const value = process.env.ENABLE_ANGEL_MARKET_DATA;
  if (value === undefined || value === null || String(value).trim() === "") return true;
  return toBool(value);
}

function debugEnabled(req) {
  const value = String(req?.query?.debug || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "market-api");
  const respond = (statusCode, payload) =>
    json(res, statusCode, {
      ...(payload || {}),
      meta: {
        contractVersion: CONTRACTS.market,
        traceId: trace.traceId,
      },
    });
  const route = String(req.query?.route || "").toLowerCase();
  const exchange = mockMarket.getExchange(req.query?.exchange);
  const angelSession = angelSessionFromRequest(req);
  const debug = debugEnabled(req);

  if (route === "bootstrap") {
    if (req.method !== "GET") {
      return respond(405, { error: "Method not allowed" });
    }

    let liveAttempted = false;
    let liveFallbackReason = "";
    if (liveMarketEnabled() && angelSession.connected) {
      liveAttempted = true;
      try {
        const liveResult = await buildLiveMarketView({
          exchange,
          session: angelSession,
          withDiagnostics: debug,
        });
        const livePayload = debug ? liveResult?.view : liveResult;
        const liveDiagnostics = debug ? liveResult?.diagnostics : null;
        if (livePayload?.stocks?.length) {
          traceLog(trace, "info", "market.bootstrap.live.success", {
            exchange,
            stocks: Array.isArray(livePayload.stocks) ? livePayload.stocks.length : 0,
            clusters: Array.isArray(livePayload.clusters) ? livePayload.clusters.length : 0,
          });
          return respond(
            200,
            debug
              ? {
                  ...livePayload,
                  source: livePayload.source || "angel-live",
                  debug: {
                    liveAttempted: true,
                    liveFallbackReason: "",
                    angelSessionConnected: true,
                    liveDiagnostics: liveDiagnostics || null,
                  },
                }
              : { ...livePayload, source: livePayload.source || "angel-live" },
          );
        }
        liveFallbackReason = "live-empty-payload";
        if (debug && liveDiagnostics) {
          liveFallbackReason = `${liveFallbackReason}:${JSON.stringify(liveDiagnostics)}`;
        }
      } catch (error) {
        traceLog(trace, "warn", "market.bootstrap.live.fallback", {
          exchange,
          message: error.message,
        });
        liveFallbackReason = error.message;
      }
    } else {
      liveFallbackReason = !liveMarketEnabled() ? "live-market-disabled" : "angel-session-not-connected";
    }

    const payload = mockMarket.buildView(exchange);
    traceLog(trace, "info", "market.bootstrap.success", {
      exchange,
      stocks: Array.isArray(payload.stocks) ? payload.stocks.length : 0,
    });
    return respond(
      200,
      debug
        ? {
            ...payload,
            source: "mock-fallback",
            debug: {
              liveAttempted,
              liveFallbackReason,
              angelSessionConnected: angelSession.connected,
            },
          }
        : { ...payload, source: "mock-fallback" },
    );
  }

  if (route === "poll") {
    if (req.method !== "GET") {
      return respond(405, { error: "Method not allowed" });
    }

    if (liveMarketEnabled() && angelSession.connected) {
      try {
        const liveView = await buildLiveMarketView({
          exchange,
          session: angelSession,
        });
        if (liveView?.stocks?.length) {
          traceLog(trace, "info", "market.poll.live.success", {
            exchange,
            stocks: Array.isArray(liveView.stocks) ? liveView.stocks.length : 0,
            clusters: Array.isArray(liveView.clusters) ? liveView.clusters.length : 0,
          });
          return respond(200, {
            asOf: liveView.asOf,
            cursor: liveView.cursor,
            source: liveView.source || "angel-live",
            updates: {
              stocks: liveView.stocks,
              clusters: liveView.clusters,
              heads: liveView.heads,
            },
          });
        }
      } catch (error) {
        traceLog(trace, "warn", "market.poll.live.fallback", {
          exchange,
          message: error.message,
        });
      }
    }

    mockMarket.tickMarket();
    const view = mockMarket.buildView(exchange);

    traceLog(trace, "info", "market.poll.success", {
      exchange,
      stocks: Array.isArray(view.stocks) ? view.stocks.length : 0,
    });
    return respond(200, {
      asOf: view.asOf,
      cursor: view.cursor,
      source: "mock-fallback",
      updates: {
        stocks: view.stocks,
        clusters: view.clusters,
        heads: view.heads,
      },
    });
  }

  return respond(404, { error: "Not found" });
};
