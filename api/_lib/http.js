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

function parseCookies(req) {
  const header = req?.headers?.cookie || req?.headers?.Cookie || "";
  if (!header || typeof header !== "string") return {};

  return header.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.split("=");
    const key = String(rawKey || "").trim();
    if (!key) return acc;
    const value = rest.join("=").trim();
    acc[key] = decodeURIComponent(value || "");
    return acc;
  }, {});
}

function setCookie(res, name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(String(value || ""))}`];
  attrs.push(`Path=${options.path || "/"}`);
  if (Number.isFinite(options.maxAge)) attrs.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.httpOnly !== false) attrs.push("HttpOnly");
  if (options.sameSite) attrs.push(`SameSite=${options.sameSite}`);
  if (options.secure) attrs.push("Secure");

  const existing = res.getHeader ? res.getHeader("Set-Cookie") : null;
  const next = Array.isArray(existing) ? existing.concat(attrs.join("; ")) : [attrs.join("; ")];
  if (res.setHeader) {
    res.setHeader("Set-Cookie", next);
  }
}

module.exports = {
  toNumber,
  getQuery,
  json,
  methodNotAllowed,
  parseJsonBody,
  exchangeKey,
  parseCookies,
  setCookie,
};
