const crypto = require("node:crypto");

const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { getSession, setSession, clearSession, isSessionExpired, computeNextKiteExpiryIso } = require("./_lib/zerodhaSession");
const { getQuery, json, parseCookies, setCookie } = require("./_lib/http");

const KITE_API_BASE = "https://api.kite.trade";
const COOKIE_NAMES = ["kite_access_token", "kite_user_id", "kite_user_name", "kite_expires_at"];

function checksum(apiKey, requestToken, apiSecret) {
  return crypto.createHash("sha256").update(`${apiKey}${requestToken}${apiSecret}`).digest("hex");
}

function buildRedirectUrl(req) {
  if (process.env.KITE_REDIRECT_URL) return process.env.KITE_REDIRECT_URL;
  const host = req?.headers?.host || "127.0.0.1:4173";
  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/api/zerodha/callback`;
}

function parseExpiryIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString();
}

function secondsUntil(isoTimestamp) {
  const expiryMs = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(expiryMs)) return 0;
  return Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
}

function clearAuthCookies(req, res) {
  const secureCookie = !String(req?.headers?.host || "").includes("localhost");
  COOKIE_NAMES.forEach((cookieName) => {
    setCookie(res, cookieName, "", {
      maxAge: 0,
      secure: secureCookie,
      sameSite: "Lax",
      httpOnly: cookieName === "kite_access_token",
    });
  });
}

function send(res, statusCode, payload, meta) {
  return json(res, statusCode, {
    ...(payload || {}),
    meta,
  });
}

async function handleAuthUrl(req, res, meta) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" }, meta);

  const cookies = parseCookies(req);
  const cookieToken = String(cookies.kite_access_token || "").trim();
  const cookieExpiry = parseExpiryIso(cookies.kite_expires_at);
  const cookieExpired = cookieExpiry ? Date.now() >= new Date(cookieExpiry).getTime() : false;
  const connectedByCookie = Boolean(cookieToken && !cookieExpired);
  const session = getSession();
  const sessionExpired = isSessionExpired(session);
  if (sessionExpired) clearSession();
  const apiKey = process.env.KITE_API_KEY || "";
  const redirectUrl = buildRedirectUrl(req);

  if (!apiKey) {
    return send(
      res,
      200,
      {
        ready: false,
        connected: connectedByCookie || (Boolean(session.connected) && !sessionExpired),
        authUrl: "",
        message: "Set KITE_API_KEY to generate Zerodha auth URL",
        redirectUrl,
      },
      meta,
    );
  }

  const query = new URLSearchParams({
    v: "3",
    api_key: apiKey,
    redirect_url: redirectUrl,
  });

  return send(
    res,
    200,
    {
      ready: true,
      connected: connectedByCookie || (Boolean(session.connected) && !sessionExpired),
      authUrl: `https://kite.zerodha.com/connect/login?${query.toString()}`,
      redirectUrl,
    },
    meta,
  );
}

async function handleCallback(req, res, meta) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" }, meta);

  const apiKey = process.env.KITE_API_KEY || "";
  const apiSecret = process.env.KITE_API_SECRET || "";
  const requestToken = getQuery(req, "request_token", "");
  const status = getQuery(req, "status", "");
  const action = getQuery(req, "action", "");

  if (status && status.toLowerCase() === "error") {
    return send(
      res,
      400,
      {
        connected: false,
        error: "Zerodha login returned error status",
        status,
        action,
      },
      meta,
    );
  }

  if (!requestToken) {
    return send(
      res,
      400,
      {
        connected: false,
        error: "Missing request_token in callback",
      },
      meta,
    );
  }

  if (!apiKey || !apiSecret) {
    const session = setSession({
      requestToken,
      connected: false,
      accessToken: "",
      provider: "kite-direct",
    });

    return send(
      res,
      200,
      {
        connected: false,
        warning: "KITE_API_KEY/KITE_API_SECRET missing. Stored request token only.",
        requestToken: session.requestToken,
      },
      meta,
    );
  }

  const body = new URLSearchParams({
    api_key: apiKey,
    request_token: requestToken,
    checksum: checksum(apiKey, requestToken, apiSecret),
  });

  const response = await fetch(`${KITE_API_BASE}/session/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Kite-Version": "3",
    },
    body,
  });

  const payload = await response.json();
  if (!response.ok || payload.status === "error") {
    return send(
      res,
      401,
      {
        connected: false,
        error: payload?.message || "Unable to exchange request token",
      },
      meta,
    );
  }

  const data = payload.data || {};
  const expiresAt = computeNextKiteExpiryIso();
  const session = setSession({
    connected: true,
    requestToken,
    accessToken: data.access_token || "",
    publicToken: data.public_token || "",
    userId: data.user_id || null,
    userName: data.user_name || data.user_shortname || null,
    loginTime: new Date().toISOString(),
    expiresAt,
    provider: "kite-direct",
  });

  const secureCookie = !String(req?.headers?.host || "").includes("localhost");
  const maxAgeSec = Math.max(1, secondsUntil(session.expiresAt));
  setCookie(res, "kite_access_token", session.accessToken || "", {
    maxAge: maxAgeSec,
    secure: secureCookie,
    sameSite: "Lax",
    httpOnly: true,
  });
  setCookie(res, "kite_user_id", session.userId || "", {
    maxAge: maxAgeSec,
    secure: secureCookie,
    sameSite: "Lax",
    httpOnly: false,
  });
  setCookie(res, "kite_user_name", session.userName || "", {
    maxAge: maxAgeSec,
    secure: secureCookie,
    sameSite: "Lax",
    httpOnly: false,
  });
  setCookie(res, "kite_expires_at", session.expiresAt || "", {
    maxAge: maxAgeSec,
    secure: secureCookie,
    sameSite: "Lax",
    httpOnly: false,
  });

  return send(
    res,
    200,
    {
      connected: true,
      provider: session.provider,
      user: {
        userId: session.userId,
        userName: session.userName,
      },
      loginTime: session.loginTime,
      expiresAt: session.expiresAt,
    },
    meta,
  );
}

async function handleSessionStatus(req, res, meta) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" }, meta);

  const cookies = parseCookies(req);
  const session = getSession();
  const cookieToken = String(cookies.kite_access_token || "").trim();
  const cookieUserId = String(cookies.kite_user_id || "").trim();
  const cookieUserName = String(cookies.kite_user_name || "").trim();
  const cookieExpiresAt = parseExpiryIso(cookies.kite_expires_at);

  const effective = cookieToken
    ? {
        ...session,
        connected: true,
        accessToken: cookieToken,
        userId: cookieUserId || session.userId || null,
        userName: cookieUserName || session.userName || null,
        expiresAt: cookieExpiresAt || session.expiresAt || null,
      }
    : session;
  const expired = isSessionExpired(effective);
  if (expired) {
    clearSession();
    clearAuthCookies(req, res);
  }

  return send(
    res,
    200,
    {
      connected: Boolean(effective.connected && effective.accessToken) && !expired,
      provider: effective.provider || "kite-direct",
      user: {
        userId: effective.userId || null,
        userName: effective.userName || null,
      },
      loginTime: effective.loginTime || null,
      expiresAt: effective.expiresAt || null,
      expired,
      hasAccessToken: Boolean(effective.accessToken) && !expired,
      hasRequestToken: Boolean(effective.requestToken),
      warnings: [
        expired ? "Zerodha session expired at 06:00 IST. Re-login required." : null,
        !process.env.KITE_API_KEY ? "KITE_API_KEY is missing" : null,
        !process.env.KITE_API_SECRET ? "KITE_API_SECRET is missing" : null,
      ].filter(Boolean),
    },
    meta,
  );
}

async function handleLogout(req, res, meta) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" }, meta);
  clearSession();
  clearAuthCookies(req, res);
  return send(
    res,
    200,
    {
      loggedOut: true,
      connected: false,
    },
    meta,
  );
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "zerodha-api");
  const meta = {
    contractVersion: CONTRACTS.zerodha,
    traceId: trace.traceId,
  };
  const route = String(req.query?.route || "").toLowerCase();

  try {
    if (route === "auth-url") {
      traceLog(trace, "info", "zerodha.auth-url");
      return handleAuthUrl(req, res, meta);
    }
    if (route === "callback") {
      traceLog(trace, "info", "zerodha.callback");
      return handleCallback(req, res, meta);
    }
    if (route === "session-status") {
      traceLog(trace, "info", "zerodha.session-status");
      return handleSessionStatus(req, res, meta);
    }
    if (route === "logout") {
      traceLog(trace, "info", "zerodha.logout");
      return handleLogout(req, res, meta);
    }
  } catch (error) {
    traceLog(trace, "error", "zerodha.route.failed", { route, message: error.message });
    return send(
      res,
      500,
      {
        error: "zerodha-route-failed",
        message: error.message,
      },
      meta,
    );
  }

  return send(res, 404, { error: "Not found" }, meta);
};
