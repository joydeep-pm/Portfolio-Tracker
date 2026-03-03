function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getQuery(req, key, fallback = "") {
  if (!req || !req.query) return fallback;
  const value = req.query[key];
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function json(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

function methodNotAllowed(res) {
  return json(res, 405, { error: "Method not allowed" });
}

async function parseJsonBody(req) {
  if (!req) return {};

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return {};
    }
  }

  if (typeof req.rawBody === "string" && req.rawBody.trim()) {
    try {
      return JSON.parse(req.rawBody);
    } catch (_error) {
      return {};
    }
  }

  return {};
}

function exchangeKey(rawValue) {
  const value = String(rawValue || "all").toLowerCase();
  if (value === "nse" || value === "bse" || value === "all") return value;
  return "all";
}

module.exports = {
  toNumber,
  getQuery,
  json,
  methodNotAllowed,
  parseJsonBody,
  exchangeKey,
};
