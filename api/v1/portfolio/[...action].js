const { bootstrapPortfolio, pollPortfolio, getDecisions } = require("../../_lib/portfolioService");
const { saveEodSnapshot } = require("../../_lib/snapshots");
const { exchangeKey, json, methodNotAllowed, parseJsonBody } = require("../../_lib/http");

function pathParts(req) {
  const raw = req.query?.action;
  if (Array.isArray(raw)) return raw.map((part) => String(part).toLowerCase());
  if (!raw) return [];
  return [String(raw).toLowerCase()];
}

module.exports = async function handler(req, res) {
  const parts = pathParts(req);

  if (parts.length === 1 && parts[0] === "bootstrap") {
    if (req.method !== "GET") return methodNotAllowed(res);

    try {
      const payload = await bootstrapPortfolio({
        exchange: exchangeKey(req.query?.exchange),
        forceRefresh: String(req.query?.refresh || "").toLowerCase() === "true",
      });

      return json(res, 200, payload);
    } catch (error) {
      return json(res, 500, {
        error: "portfolio-bootstrap-failed",
        message: error.message,
      });
    }
  }

  if (parts.length === 1 && parts[0] === "poll") {
    if (req.method !== "GET") return methodNotAllowed(res);

    try {
      const payload = await pollPortfolio({
        cursor: req.query?.cursor || "",
        exchange: exchangeKey(req.query?.exchange),
      });

      return json(res, 200, payload);
    } catch (error) {
      return json(res, 500, {
        error: "portfolio-poll-failed",
        message: error.message,
      });
    }
  }

  if (parts.length === 1 && parts[0] === "decisions") {
    if (req.method !== "GET") return methodNotAllowed(res);

    try {
      const payload = await getDecisions({
        exchange: exchangeKey(req.query?.exchange),
      });

      return json(res, 200, payload);
    } catch (error) {
      return json(res, 500, {
        error: "portfolio-decisions-failed",
        message: error.message,
      });
    }
  }

  if (parts.length === 2 && parts[0] === "snapshots" && parts[1] === "eod") {
    if (req.method !== "POST") return methodNotAllowed(res);

    try {
      const body = await parseJsonBody(req);
      const payload = await saveEodSnapshot({
        snapshotDate: body.snapshotDate,
      });

      return json(res, 200, payload);
    } catch (error) {
      return json(res, 500, {
        error: "portfolio-snapshot-failed",
        message: error.message,
      });
    }
  }

  return json(res, 404, { error: "Not found" });
};
