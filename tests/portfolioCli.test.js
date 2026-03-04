const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptPath = path.resolve(__dirname, "../scripts/portfolio-snapshot.js");

function runCli(args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      BROKER_PROVIDER: "kite-direct",
      KITE_API_KEY: "",
      KITE_API_SECRET: "",
      KITE_ACCESS_TOKEN: "",
    },
  });
}

test("CLI emits valid JSON summary payload", () => {
  const result = runCli(["--format", "json", "--mode", "summary"]);
  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(typeof payload.asOf, "string");
  assert.equal(typeof payload.summary.totalSymbols, "number");
  assert.equal(typeof payload.summary.totalCurrent, "number");
  assert.equal(Array.isArray(payload.topMovers.gainers), true);
  assert.equal(typeof payload.meta?.contractVersion, "string");
});

test("CLI emits valid JSON detailed payload with rows", () => {
  const result = runCli(["--format", "json", "--mode", "detailed"]);
  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(Array.isArray(payload.rows), true);
  assert.equal(payload.rows.length > 0, true);
  assert.equal(typeof payload.rows[0].symbol, "string");
  assert.equal(typeof payload.rows[0].currentValue, "number");
  assert.equal(typeof payload.meta?.contractVersion, "string");
});

test("CLI exports JSON when format is json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-cli-json-"));
  const exportPath = path.join(dir, "snapshot.json");

  const result = runCli(["--format", "json", "--mode", "summary", "--export", exportPath]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(exportPath), true);

  const payload = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  assert.equal(typeof payload.summary.totalInvested, "number");
  assert.equal(typeof payload.meta?.contractVersion, "string");
});

test("CLI exports CSV when format is table", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-cli-csv-"));
  const exportPath = path.join(dir, "snapshot.csv");

  const result = runCli(["--format", "table", "--mode", "detailed", "--export", exportPath]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(exportPath), true);

  const csv = fs.readFileSync(exportPath, "utf8");
  assert.equal(csv.includes("symbol,exchange,quantity"), true);
  assert.equal(csv.split("\n").length > 2, true);
});
