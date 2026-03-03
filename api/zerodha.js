const crypto = require("node:crypto");

const { getSession, setSession } = require("./_lib/zerodhaSession");
const { getQuery, json, methodNotAllowed, parseCookies, setCookie } = require("./_lib/http");

const KITE_API_BASE = "https://api.kite.trade";

function checksum(apiKey, requestToken, apiSecret) {
  return crypto.createHash("sha256").update(`${apiKey}${requestToken}${apiSecret}`).digest("hex");
}

function buildRedirectUrl(req) {
  if (process.env.KITE_REDIRECT_URL) return process.env.KITE_REDIRECT_URL;
  const host = req?.headers?.host || "127.0.0.1:4173";
  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/api/zerodha/callback`;
}

async function handleAuthUrl(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const cookies = parseCookies(req);
  const connectedByCookie = Boolean(String(cookies.kite_access_token || "").trim());
  const session = getSession();
  const apiKey = process.env.KITE_API_KEY || "";
  const redirectUrl = buildRedirectUrl(req);

  if (!apiKey) {
    return json(res, 200, {
      ready: false,
      connected: connectedByCookie || Boolean(session.connected),
      authUrl: "",
      message: "Set KITE_API_KEY to generate Zerodha auth URL",
      redirectUrl,
    });
  }

  const query = new URLSearchParams({
    v: "3",
    api_key: apiKey,
    redirect_url: redirectUrl,
  });

  return json(res, 200, {
    ready: true,
    connected: connectedByCookie || Boolean(session.connected),
    authUrl: `https://kite.zerodha.com/connect/login?${query.toString()}`,
    redirectUrl,
  });
}

async function handleCallback(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const apiKey = process.env.KITE_API_KEY || "";
  const apiSecret = process.env.KITE_API_SECRET || "";
  const requestToken = getQuery(req, "request_token", "");
  const status = getQuery(req, "status", "");
  const action = getQuery(req, "action", "");

  if (status && status.toLowerCase() === "error") {
    return json(res, 400, {
      connected: false,
      error: "Zerodha login returned error status",
      status,
      action,
    });
  }

  if (!requestToken) {
    return json(res, 400, {
      connected: false,
      error: "Missing request_token in callback",
    });
  }

  if (!apiKey || !apiSecret) {
    const session = setSession({
      requestToken,
      connected: false,
      accessToken: "",
      provider: "kite-direct",
    });

    return json(res, 200, {
      connected: false,
      warning: "KITE_API_KEY/KITE_API_SECRET missing. Stored request token only.",
      requestToken: session.requestToken,
    });
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
    return json(res, 401, {
      connected: false,
      error: payload?.message || "Unable to exchange request token",
    });
  }

  const data = payload.data || {};
  const session = setSession({
    connected: true,
    requestToken,
    accessToken: data.access_token || "",
    publicToken: data.public_token || "",
    userId: data.user_id || null,
    userName: data.user_name || data.user_shortname || null,
    loginTime: new Date().toISOString(),
    expiresAt: data.login_time || null,
    provider: "kite-direct",
  });

  const secureCookie = !String(req?.headers?.host || "").includes("localhost");
  setCookie(res, "kite_access_token", session.accessToken || "", {
    maxAge: 60 * 60 * 8,
    secure: secureCookie,
    sameSite: "Lax",
    httpOnly: true,
  });
  setCookie(res, "kite_user_id", session.userId || "", {
    maxAge: 60 * 60 * 8,
    secure: secureCookie,
    sameSite: "Lax",
    httpOnly: false,
  });
  setCookie(res, "kite_user_name", session.userName || "", {
    maxAge: 60 * 60 * 8,
    secure: secureCookie,
    sameSite: "Lax",
    httpOnly: false,
  });

  return json(res, 200, {
    connected: true,
    provider: session.provider,
    user: {
      userId: session.userId,
      userName: session.userName,
    },
    loginTime: session.loginTime,
  });
}

async function handleSessionStatus(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const cookies = parseCookies(req);
  const session = getSession();
  const cookieToken = String(cookies.kite_access_token || "").trim();
  const cookieUserId = String(cookies.kite_user_id || "").trim();
  const cookieUserName = String(cookies.kite_user_name || "").trim();

  const effective = cookieToken
    ? {
        ...session,
        connected: true,
        accessToken: cookieToken,
        userId: cookieUserId || session.userId || null,
        userName: cookieUserName || session.userName || null,
      }
    : session;
  return json(res, 200, {
    connected: Boolean(effective.connected && effective.accessToken),
    provider: effective.provider || "kite-direct",
    user: {
      userId: effective.userId || null,
      userName: effective.userName || null,
    },
    loginTime: effective.loginTime || null,
    hasAccessToken: Boolean(effective.accessToken),
    hasRequestToken: Boolean(effective.requestToken),
    warnings: [
      !process.env.KITE_API_KEY ? "KITE_API_KEY is missing" : null,
      !process.env.KITE_API_SECRET ? "KITE_API_SECRET is missing" : null,
    ].filter(Boolean),
  });
}

module.exports = async function handler(req, res) {
  const route = String(req.query?.route || "").toLowerCase();

  if (route === "auth-url") return handleAuthUrl(req, res);
  if (route === "callback") return handleCallback(req, res);
  if (route === "session-status") return handleSessionStatus(req, res);

  return json(res, 404, { error: "Not found" });
};
