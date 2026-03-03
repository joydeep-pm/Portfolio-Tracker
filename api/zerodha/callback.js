const crypto = require("node:crypto");

const { getQuery, json, methodNotAllowed } = require("../_lib/http");
const { setSession } = require("../_lib/zerodhaSession");

const KITE_API_BASE = "https://api.kite.trade";

function checksum(apiKey, requestToken, apiSecret) {
  return crypto.createHash("sha256").update(`${apiKey}${requestToken}${apiSecret}`).digest("hex");
}

module.exports = async function handler(req, res) {
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

  return json(res, 200, {
    connected: true,
    provider: session.provider,
    user: {
      userId: session.userId,
      userName: session.userName,
    },
    loginTime: session.loginTime,
  });
};
