const test = require("node:test");
const assert = require("node:assert/strict");

const angelHandler = require("../api/angel");
const { generateTotp } = require("../api/_lib/angelSmartApi");

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

test("generateTotp returns RFC-compatible code for fixed timestamp", () => {
  const code = generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", { nowMs: 59000, digits: 8, stepSeconds: 30 });
  assert.equal(code, "94287082");
});

test("angel session route returns 424 when required env vars are missing", async () => {
  const snapshot = {
    ANGEL_API_KEY: process.env.ANGEL_API_KEY,
    ANGEL_CLIENT_CODE: process.env.ANGEL_CLIENT_CODE,
    ANGEL_PIN: process.env.ANGEL_PIN,
    ANGEL_TOTP_SECRET: process.env.ANGEL_TOTP_SECRET,
  };

  delete process.env.ANGEL_API_KEY;
  delete process.env.ANGEL_CLIENT_CODE;
  delete process.env.ANGEL_PIN;
  delete process.env.ANGEL_TOTP_SECRET;

  const res = createRes();
  await angelHandler({ method: "POST", query: { route: "session" }, body: {} }, res);

  assert.equal(res.statusCode, 424);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.mode, "missing-env-values");
  assert.equal(Array.isArray(res.body.missing), true);
  assert.equal(res.body.missing.length, 4);

  Object.keys(snapshot).forEach((key) => {
    if (typeof snapshot[key] === "string") process.env[key] = snapshot[key];
    else delete process.env[key];
  });
});

test("angel session route generates and reports connected state with mocked SmartAPI", async () => {
  const snapshot = {
    ANGEL_API_KEY: process.env.ANGEL_API_KEY,
    ANGEL_CLIENT_CODE: process.env.ANGEL_CLIENT_CODE,
    ANGEL_PIN: process.env.ANGEL_PIN,
    ANGEL_TOTP_SECRET: process.env.ANGEL_TOTP_SECRET,
  };

  process.env.ANGEL_API_KEY = "k_test";
  process.env.ANGEL_CLIENT_CODE = "C12345";
  process.env.ANGEL_PIN = "1234";
  process.env.ANGEL_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/loginByPassword")) {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            status: true,
            message: "SUCCESS",
            data: {
              jwtToken: "jwt.test.token",
              refreshToken: "refresh.test.token",
              feedToken: "feed.test.token",
            },
          });
        },
      };
    }

    if (String(url).includes("/getProfile")) {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            status: true,
            message: "SUCCESS",
            data: {
              clientcode: "C12345",
              name: "Test User",
            },
          });
        },
      };
    }

    return {
      ok: false,
      status: 404,
      async text() {
        return JSON.stringify({ status: false, message: "not-found" });
      },
    };
  };

  try {
    const connectRes = createRes();
    await angelHandler({ method: "POST", query: { route: "session" }, body: {} }, connectRes);
    assert.equal(connectRes.statusCode, 200);
    assert.equal(connectRes.body.ok, true);
    assert.equal(connectRes.body.connected, true);
    assert.equal(connectRes.body.clientCode, "C12345");

    const statusRes = createRes();
    await angelHandler({ method: "GET", query: { route: "session-status" } }, statusRes);
    assert.equal(statusRes.statusCode, 200);
    assert.equal(statusRes.body.connected, true);

    const reusedRes = createRes();
    await angelHandler({ method: "POST", query: { route: "session" }, body: {} }, reusedRes);
    assert.equal(reusedRes.statusCode, 200);
    assert.equal(reusedRes.body.reused, true);
    const reusedCookies = reusedRes.getHeader("set-cookie");
    assert.equal(Array.isArray(reusedCookies), true);
    assert.equal(reusedCookies.some((cookie) => String(cookie).includes("pt_angel_jwt=")), true);

    assert.equal(calls.some((item) => item.includes("/loginByPassword")), true);
    assert.equal(calls.some((item) => item.includes("/getProfile")), true);
  } finally {
    global.fetch = originalFetch;
    Object.keys(snapshot).forEach((key) => {
      if (typeof snapshot[key] === "string") process.env[key] = snapshot[key];
      else delete process.env[key];
    });
  }
});
