const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptPath = path.resolve(__dirname, "../scripts/exchange-request-token.js");

test("exchange-request-token prints help", () => {
  const result = spawnSync(process.execPath, [scriptPath, "--help"], {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes("Usage:"), true);
});

test("exchange-request-token requires request token", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes("--request-token is required"), true);
});
