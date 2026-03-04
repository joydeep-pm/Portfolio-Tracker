const IST_UTC_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function computeNextKiteExpiryIso(now = new Date()) {
  const nowMs = now.getTime();
  const istNow = new Date(nowMs + IST_UTC_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  // 06:00 IST equals 00:30 UTC.
  let cutoffUtcMs = Date.UTC(year, month, day, 0, 30, 0, 0);
  if (nowMs >= cutoffUtcMs) {
    cutoffUtcMs = Date.UTC(year, month, day + 1, 0, 30, 0, 0);
  }
  return new Date(cutoffUtcMs).toISOString();
}

function normalizeExpiryIso(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString();
}

function isSessionExpired(session, nowMs = Date.now()) {
  const expiryIso = String(session?.expiresAt || "").trim();
  if (!expiryIso) return false;
  const expiryMs = new Date(expiryIso).getTime();
  if (!Number.isFinite(expiryMs)) return false;
  return nowMs >= expiryMs;
}

let sessionState = {
  connected: false,
  userId: null,
  userName: null,
  accessToken: process.env.KITE_ACCESS_TOKEN || "",
  publicToken: "",
  loginTime: null,
  expiresAt: process.env.KITE_ACCESS_TOKEN ? computeNextKiteExpiryIso() : null,
  provider: "kite-direct",
  requestToken: null,
};

if (sessionState.accessToken) {
  sessionState.connected = true;
  sessionState.loginTime = new Date().toISOString();
}

function getSession() {
  return { ...sessionState };
}

function setSession(update) {
  const normalized = {
    ...update,
  };
  if (update && Object.prototype.hasOwnProperty.call(update, "expiresAt")) {
    const nextExpiry = normalizeExpiryIso(update.expiresAt);
    normalized.expiresAt = nextExpiry || null;
  }

  sessionState = {
    ...sessionState,
    ...normalized,
  };

  if (sessionState.accessToken) {
    sessionState.connected = true;
    if (!sessionState.loginTime) sessionState.loginTime = new Date().toISOString();
    if (!sessionState.expiresAt) sessionState.expiresAt = computeNextKiteExpiryIso();
  }

  if (isSessionExpired(sessionState)) {
    sessionState.connected = false;
    sessionState.accessToken = "";
  }

  return getSession();
}

function clearSession() {
  sessionState = {
    connected: false,
    userId: null,
    userName: null,
    accessToken: "",
    publicToken: "",
    loginTime: null,
    expiresAt: null,
    provider: sessionState.provider,
    requestToken: null,
  };
  return getSession();
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  isSessionExpired,
  computeNextKiteExpiryIso,
};
