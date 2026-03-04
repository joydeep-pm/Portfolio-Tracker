const test = require("node:test");
const assert = require("node:assert/strict");

const zerodhaHandler = require("../api/zerodha");
const { clearSession, setSession } = require("../api/_lib/zerodhaSession");

function createRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

test("auth-url returns not-ready when KITE_API_KEY is missing", async () => {
  const prev = process.env.KITE_API_KEY;
  delete process.env.KITE_API_KEY;

  const req = { method: "GET", query: { route: "auth-url" }, headers: { host: "127.0.0.1:4173" } };
  const res = createRes();

  await zerodhaHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ready, false);
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");
  assert.equal(typeof res.getHeader("x-trace-id"), "string");

  if (typeof prev === "string") process.env.KITE_API_KEY = prev;
});

test("session-status marks expired cookie sessions as disconnected and clears cookies", async () => {
  clearSession();
  setSession({
    connected: true,
    accessToken: "abc",
    userId: "U1",
    userName: "Demo",
    expiresAt: "2000-01-01T00:00:00.000Z",
  });

  const req = {
    method: "GET",
    query: { route: "session-status" },
    headers: {
      host: "127.0.0.1:4173",
      cookie: "kite_access_token=abc; kite_user_id=U1; kite_user_name=Demo; kite_expires_at=2000-01-01T00:00:00.000Z",
    },
  };
  const res = createRes();

  await zerodhaHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.connected, false);
  assert.equal(res.body.expired, true);
  assert.equal(Array.isArray(res.body.warnings), true);
  assert.equal(res.body.warnings.some((item) => String(item).toLowerCase().includes("expired")), true);
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");

  const cookies = res.getHeader("set-cookie");
  assert.equal(Array.isArray(cookies), true);
  assert.equal(cookies.some((cookie) => String(cookie).includes("kite_access_token=")), true);
  assert.equal(cookies.some((cookie) => String(cookie).includes("kite_expires_at=")), true);
});

test("logout endpoint clears session and auth cookies", async () => {
  setSession({
    connected: true,
    accessToken: "abc",
    userId: "U1",
    userName: "Demo",
  });

  const req = {
    method: "POST",
    query: { route: "logout" },
    headers: {
      host: "127.0.0.1:4173",
      cookie: "kite_access_token=abc; kite_user_id=U1; kite_user_name=Demo",
    },
  };
  const res = createRes();

  await zerodhaHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.loggedOut, true);
  assert.equal(res.body.connected, false);
  assert.equal(typeof res.body.meta?.contractVersion, "string");
  assert.equal(typeof res.body.meta?.traceId, "string");

  const cookies = res.getHeader("set-cookie");
  assert.equal(Array.isArray(cookies), true);
  assert.equal(cookies.length >= 3, true);
});
