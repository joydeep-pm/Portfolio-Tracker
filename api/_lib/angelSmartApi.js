const crypto = require("node:crypto");

const ANGEL_ROOT = "https://apiconnect.angelone.in";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "X-ClientLocalIP": "127.0.0.1",
  "X-ClientPublicIP": "127.0.0.1",
  "X-MACAddress": "00:00:00:00:00:00",
  "X-UserType": "USER",
  "X-SourceID": "WEB",
};

function normalizeBase32(secret) {
  return String(secret || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
}

function decodeBase32(secret) {
  const normalized = normalizeBase32(secret);
  if (!normalized) throw new Error("Invalid TOTP secret");

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 character in TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, options = {}) {
  const digits = Number.isFinite(options.digits) ? options.digits : 6;
  const stepSeconds = Number.isFinite(options.stepSeconds) ? options.stepSeconds : 30;
  const algorithm = String(options.algorithm || "sha1").toLowerCase();
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();

  const key = decodeBase32(secret);
  const counter = Math.floor(nowMs / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto.createHmac(algorithm, key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, "0");
}

function buildHeaders(apiKey, accessToken = "") {
  const token = String(accessToken || "").trim();
  return {
    ...DEFAULT_HEADERS,
    "X-PrivateKey": String(apiKey || "").trim(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function angelRequest({ path, method = "GET", body, apiKey, accessToken, timeoutMs = 15000, fetchImpl } = {}) {
  const fn = fetchImpl || global.fetch;
  if (typeof fn !== "function") throw new Error("fetch unavailable");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const methodKey = String(method || "GET").toUpperCase();
    const query = methodKey === "GET" && body && typeof body === "object" ? `?${new URLSearchParams(body).toString()}` : "";
    const response = await fn(`${ANGEL_ROOT}${path}${query}`, {
      method,
      headers: buildHeaders(apiKey, accessToken),
      body: methodKey === "GET" ? undefined : body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      payload = {
        status: false,
        message: "non-json-response",
        raw,
      };
    }

    return {
      ok: response.ok,
      statusCode: response.status,
      payload,
    };
  } finally {
    clearTimeout(timer);
  }
}

function readAngelEnv(env = process.env) {
  return {
    apiKey: String(env.ANGEL_API_KEY || "").trim(),
    clientCode: String(env.ANGEL_CLIENT_CODE || "").trim(),
    pin: String(env.ANGEL_PIN || "").trim(),
    totpSecret: String(env.ANGEL_TOTP_SECRET || "").trim(),
  };
}

function missingAngelEnv(env = process.env) {
  const values = readAngelEnv(env);
  return Object.entries({
    ANGEL_API_KEY: values.apiKey,
    ANGEL_CLIENT_CODE: values.clientCode,
    ANGEL_PIN: values.pin,
    ANGEL_TOTP_SECRET: values.totpSecret,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

async function generateAngelSession(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;
  const values = readAngelEnv(env);
  const missing = missingAngelEnv(env);
  if (missing.length) {
    return {
      ok: false,
      error: "missing-env-values",
      missing,
    };
  }

  const totp = String(options.totp || generateTotp(values.totpSecret));
  const login = await angelRequest({
    path: "/rest/auth/angelbroking/user/v1/loginByPassword",
    method: "POST",
    body: {
      clientcode: values.clientCode,
      password: values.pin,
      totp,
    },
    apiKey: values.apiKey,
    fetchImpl,
  });

  const loginPayload = login.payload || {};
  if (!login.ok || loginPayload.status !== true || !loginPayload.data?.jwtToken) {
    return {
      ok: false,
      error: "angel-login-failed",
      statusCode: login.statusCode,
      message: String(loginPayload.message || "Login failed"),
      payload: loginPayload,
    };
  }

  const profile = await angelRequest({
    path: "/rest/secure/angelbroking/user/v1/getProfile",
    method: "GET",
    body: {
      refreshToken: loginPayload.data.refreshToken,
    },
    apiKey: values.apiKey,
    accessToken: loginPayload.data.jwtToken,
    fetchImpl,
  });

  return {
    ok: true,
    session: {
      clientCode: values.clientCode,
      jwtToken: String(loginPayload.data.jwtToken || ""),
      refreshToken: String(loginPayload.data.refreshToken || ""),
      feedToken: String(loginPayload.data.feedToken || ""),
      generatedTotp: totp,
      profile: profile.payload?.data || null,
      loginResponse: loginPayload,
      profileResponse: profile.payload || null,
      createdAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  ANGEL_ROOT,
  generateTotp,
  buildHeaders,
  angelRequest,
  readAngelEnv,
  missingAngelEnv,
  generateAngelSession,
};
