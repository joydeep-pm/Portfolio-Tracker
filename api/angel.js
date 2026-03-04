const { json, methodNotAllowed, parseJsonBody, parseCookies, setCookie } = require("./_lib/http");
const { initTrace, traceLog } = require("./_lib/trace");
const { angelRequest, generateAngelSession, missingAngelEnv, readAngelEnv } = require("./_lib/angelSmartApi");

const SESSION_TTL_MS = 10 * 60 * 60 * 1000;
const SESSION_COOKIE_PREFIX = "pt_angel";

const angelSession = {
  connected: false,
  clientCode: "",
  jwtToken: "",
  refreshToken: "",
  feedToken: "",
  createdAt: "",
  expiresAt: "",
  profile: null,
};

function applySession(session = {}) {
  angelSession.connected = true;
  angelSession.clientCode = String(session.clientCode || "");
  angelSession.jwtToken = String(session.jwtToken || "");
  angelSession.refreshToken = String(session.refreshToken || "");
  angelSession.feedToken = String(session.feedToken || "");
  angelSession.createdAt = String(session.createdAt || new Date().toISOString());
  angelSession.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  angelSession.profile = session.profile || null;
}

function clearSession() {
  angelSession.connected = false;
  angelSession.clientCode = "";
  angelSession.jwtToken = "";
  angelSession.refreshToken = "";
  angelSession.feedToken = "";
  angelSession.createdAt = "";
  angelSession.expiresAt = "";
  angelSession.profile = null;
}

function isSessionAlive() {
  if (!angelSession.connected || !angelSession.jwtToken) return false;
  const expires = new Date(angelSession.expiresAt).getTime();
  return Number.isFinite(expires) && Date.now() < expires;
}

function readCookieSession(req) {
  const cookies = parseCookies(req);
  const jwtToken = String(cookies[`${SESSION_COOKIE_PREFIX}_jwt`] || "");
  const refreshToken = String(cookies[`${SESSION_COOKIE_PREFIX}_refresh`] || "");
  const feedToken = String(cookies[`${SESSION_COOKIE_PREFIX}_feed`] || "");
  const clientCode = String(cookies[`${SESSION_COOKIE_PREFIX}_client`] || "");
  const createdAt = String(cookies[`${SESSION_COOKIE_PREFIX}_created`] || "");
  const expiresAt = String(cookies[`${SESSION_COOKIE_PREFIX}_expires`] || "");
  const expiresMs = new Date(expiresAt).getTime();
  const connected = Boolean(jwtToken && Number.isFinite(expiresMs) && Date.now() < expiresMs);
  return {
    connected,
    clientCode,
    createdAt,
    expiresAt,
    jwtToken,
    refreshToken,
    feedToken,
  };
}

function writeSessionCookies(res) {
  const now = Date.now();
  const expiresMs = new Date(angelSession.expiresAt || 0).getTime();
  const maxAge = Math.max(0, Math.floor(((Number.isFinite(expiresMs) ? expiresMs : now) - now) / 1000));
  const options = {
    path: "/",
    maxAge,
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
  };
  setCookie(res, `${SESSION_COOKIE_PREFIX}_jwt`, angelSession.jwtToken, options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_refresh`, angelSession.refreshToken, options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_feed`, angelSession.feedToken, options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_client`, angelSession.clientCode, options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_created`, angelSession.createdAt, options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_expires`, angelSession.expiresAt, options);
}

function clearSessionCookies(res) {
  const options = {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
  };
  setCookie(res, `${SESSION_COOKIE_PREFIX}_jwt`, "", options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_refresh`, "", options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_feed`, "", options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_client`, "", options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_created`, "", options);
  setCookie(res, `${SESSION_COOKIE_PREFIX}_expires`, "", options);
}

function sessionSnapshot(req) {
  const cookieSession = readCookieSession(req);
  const memoryConnected = isSessionAlive();
  const connected = memoryConnected || cookieSession.connected;
  const clientCode = memoryConnected ? angelSession.clientCode : cookieSession.clientCode;
  const createdAt = memoryConnected ? angelSession.createdAt : cookieSession.createdAt;
  const expiresAt = memoryConnected ? angelSession.expiresAt : cookieSession.expiresAt;
  const hasFeedToken = memoryConnected ? Boolean(angelSession.feedToken) : Boolean(cookieSession.feedToken);
  const hasRefreshToken = memoryConnected ? Boolean(angelSession.refreshToken) : Boolean(cookieSession.refreshToken);

  return {
    connected,
    clientCode: clientCode || null,
    createdAt: createdAt || null,
    expiresAt: expiresAt || null,
    profile: memoryConnected ? angelSession.profile || null : null,
    hasFeedToken,
    hasRefreshToken,
  };
}

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "angel-api");
  const route = String(req.query?.route || "").toLowerCase();

  if (route === "callback") {
    if (req.method !== "GET") return methodNotAllowed(res);

    const { code, state, error } = req.query || {};
    if (error) {
      return json(res, 400, { error: `Angel callback error: ${error}` });
    }
    if (!code) {
      return json(res, 400, { error: "Missing auth code" });
    }

    return json(res, 200, {
      ok: true,
      message: "Angel callback received successfully",
      code,
      state: state || null,
    });
  }

  if (route === "postback") {
    if (req.method !== "POST") return methodNotAllowed(res);

    return json(res, 200, {
      ok: true,
      received: true,
      at: new Date().toISOString(),
    });
  }

  if (route === "session-status") {
    if (req.method !== "GET") return methodNotAllowed(res);
    const snapshot = sessionSnapshot(req);
    return json(res, 200, {
      ok: true,
      provider: "angel-one",
      mode: snapshot.connected ? "connected" : "disconnected",
      ...snapshot,
      serverTime: new Date().toISOString(),
    });
  }

  if (route === "session") {
    if (req.method !== "POST") return methodNotAllowed(res);

    const body = await parseJsonBody(req);
    const force = String(body.force || req.query?.force || "").toLowerCase() === "true";
    if (!force && isSessionAlive()) {
      return json(res, 200, {
        ok: true,
        provider: "angel-one",
        mode: "connected",
        reused: true,
        ...sessionSnapshot(req),
      });
    }

    const auth = await generateAngelSession();
    if (!auth.ok) {
      traceLog(trace, "warn", "angel.session.failed", {
        error: auth.error,
        missing: auth.missing || [],
        statusCode: auth.statusCode || null,
      });
      return json(res, 424, {
        ok: false,
        provider: "angel-one",
        mode: auth.error || "session-failed",
        missing: auth.missing || [],
        message: auth.message || "Angel session generation failed",
      });
    }

    applySession(auth.session);
    traceLog(trace, "info", "angel.session.connected", {
      clientCode: angelSession.clientCode,
      hasFeedToken: Boolean(angelSession.feedToken),
    });
    writeSessionCookies(res);

    return json(res, 200, {
      ok: true,
      provider: "angel-one",
      mode: "connected",
      reused: false,
      ...sessionSnapshot(req),
    });
  }

  if (route === "logout") {
    if (req.method !== "POST") return methodNotAllowed(res);
    const alive = isSessionAlive();
    if (alive) {
      try {
        const env = readAngelEnv(process.env);
        await angelRequest({
          path: "/rest/secure/angelbroking/user/v1/logout",
          method: "POST",
          body: { clientcode: angelSession.clientCode || env.clientCode },
          apiKey: env.apiKey,
          accessToken: angelSession.jwtToken,
        });
      } catch (_error) {
        // swallow remote logout errors; local clear still proceeds.
      }
    }
    clearSession();
    clearSessionCookies(res);
    return json(res, 200, {
      ok: true,
      provider: "angel-one",
      mode: "disconnected",
      at: new Date().toISOString(),
    });
  }

  if (route === "health") {
    if (req.method !== "GET") return methodNotAllowed(res);
    const missing = missingAngelEnv(process.env);
    const requiredKeys = ["ANGEL_API_KEY", "ANGEL_CLIENT_CODE", "ANGEL_PIN", "ANGEL_TOTP_SECRET"];
    const checks = requiredKeys.map((key) => ({ key, present: !missing.includes(key) }));
    const ready = checks.every((item) => item.present);
    const snapshot = sessionSnapshot(req);

    return json(res, 200, {
      ok: true,
      provider: "angel-one",
      mode: ready ? (snapshot.connected ? "connected" : "ready-for-session-attempt") : "missing-env-values",
      ready,
      checks,
      connected: snapshot.connected,
      session: snapshot,
      serverTime: new Date().toISOString(),
      note: ready
        ? "All required env vars are present. Use POST /api/angel/session to generate live session."
        : "Set missing env vars in Vercel Project Settings > Environment Variables.",
    });
  }

  return json(res, 404, { error: "Not found" });
};
