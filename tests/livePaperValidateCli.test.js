const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptPath = path.resolve(__dirname, "../scripts/live-paper-validate.js");

test("live-paper-validate shows help output", () => {
  const result = spawnSync(process.execPath, [scriptPath, "--help"], {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes("Usage:"), true);
});

test("live-paper-validate requires KITE_API_KEY and KITE_ACCESS_TOKEN", () => {
  const result = spawnSync(process.execPath, [scriptPath, "--exchange", "all"], {
    encoding: "utf8",
    env: {
      ...process.env,
      KITE_API_KEY: "",
      KITE_ACCESS_TOKEN: "",
    },
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes("KITE_API_KEY and KITE_ACCESS_TOKEN are required"), true);
});
