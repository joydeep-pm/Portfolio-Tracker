const test = require("node:test");
const assert = require("node:assert/strict");

const { retrieveNewsContext, aggregateSentiment } = require("../api/_lib/newsRagStore");

test("retrieveNewsContext returns ranked docs for themed query", async () => {
  const context = await retrieveNewsContext("PSU bank momentum SBIN", {
    path: "data/does-not-exist-news.json",
    forceReload: true,
    limit: 3,
  });

  assert.equal(Array.isArray(context.documents), true);
  assert.equal(context.documents.length > 0, true);
  assert.equal(typeof context.documents[0].score, "number");
});

test("aggregateSentiment computes bounded sentiment score", () => {
  const result = aggregateSentiment([
    { sentiment: "positive" },
    { sentiment: "positive" },
    { sentiment: "negative" },
  ]);

  assert.equal(result.total, 3);
  assert.equal(result.sentimentScore > 0, true);
  assert.equal(result.sentimentScore <= 1, true);
});
