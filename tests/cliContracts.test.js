const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function runScript(scriptName, args = []) {
  const scriptPath = path.resolve(__dirname, `../scripts/${scriptName}`);
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

test("hotspots CLI json envelope includes contract metadata", () => {
  const result = runScript("hotspots-snapshot.js", ["--format", "json", "--exchange", "all"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(typeof payload.meta?.contractVersion, "string");
  assert.equal(typeof payload.meta?.generatedAt, "string");
});

test("agents CLI json envelope includes contract metadata", () => {
  const result = runScript("agents-analyze.js", [
    "--prompt",
    "evaluate my portfolio against current PSU bank thematic momentum",
    "--format",
    "json",
    "--exchange",
    "all",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(typeof payload.meta?.contractVersion, "string");
  assert.equal(typeof payload.meta?.generatedAt, "string");
});

test("run-eod CLI output includes contract metadata", () => {
  const result = runScript("run-eod-snapshot.js", ["--snapshot-date", "2099-12-29", "--exchange", "all"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(typeof payload.meta?.contractVersion, "string");
  assert.equal(typeof payload.meta?.generatedAt, "string");
});

test("replay-backfill CLI output includes contract metadata", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-backfill-cli-"));
  const result = runScript("replay-backfill.js", ["--from", "2026-03-01", "--to", "2026-03-01", "--hotspot-dir", dir]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(typeof payload.meta?.contractVersion, "string");
  assert.equal(typeof payload.meta?.generatedAt, "string");
  assert.equal(Array.isArray(payload.results), true);
});
