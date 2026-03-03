const { getSession } = require("../../_lib/zerodhaSession");
const { json, methodNotAllowed } = require("../../_lib/http");

function buildRedirectUrl(req) {
  if (process.env.KITE_REDIRECT_URL) return process.env.KITE_REDIRECT_URL;

  const host = req?.headers?.host || "127.0.0.1:4173";
  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/api/zerodha/callback`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const apiKey = process.env.KITE_API_KEY || "";
  const redirectUrl = buildRedirectUrl(req);

  if (!apiKey) {
    return json(res, 200, {
      ready: false,
      connected: Boolean(getSession().connected),
      authUrl: "",
      message: "Set KITE_API_KEY to generate Zerodha auth URL",
      redirectUrl,
    });
  }

  const query = new URLSearchParams({
    v: "3",
    api_key: apiKey,
    redirect_url: redirectUrl,
  });

  return json(res, 200, {
    ready: true,
    connected: Boolean(getSession().connected),
    authUrl: `https://kite.zerodha.com/connect/login?${query.toString()}`,
    redirectUrl,
  });
};
