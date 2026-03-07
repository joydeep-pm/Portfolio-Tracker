const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptPath = path.resolve(__dirname, "../scripts/ingest-bharatfintrack.js");

test("ingest-bharatfintrack writes normalized catalog in force-seed mode", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bharatfintrack-ingest-"));
  const output = path.join(dir, "catalog.json");

  const result = spawnSync(process.execPath, [scriptPath, "--force-seed", "--output", output], {
    encoding: "utf8",
    env: { ...process.env },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(output), true);

  const payload = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(Array.isArray(payload.categories), true);
  assert.equal(Array.isArray(payload.indices), true);
  assert.equal(payload.indices.length > 0, true);
  assert.equal(typeof payload.source, "string");
});

test("ingest-bharatfintrack accepts explicit target flags in force-seed mode", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bharatfintrack-ingest-"));
  const output = path.join(dir, "catalog.json");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--force-seed", "--target-stocks", "2486", "--target-clusters", "175", "--output", output],
    {
      encoding: "utf8",
      env: { ...process.env },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(output), true);
});

test("ingest-bharatfintrack rejects --require-live with --force-seed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bharatfintrack-ingest-"));
  const output = path.join(dir, "catalog.json");

  const result = spawnSync(process.execPath, [scriptPath, "--force-seed", "--require-live", "--output", output], {
    encoding: "utf8",
    env: { ...process.env },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--require-live cannot be used with --force-seed/);
});
