const { getSession } = require("../../_lib/zerodhaSession");
const { json, methodNotAllowed } = require("../../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const session = getSession();
  return json(res, 200, {
    connected: Boolean(session.connected && session.accessToken),
    provider: session.provider || "kite-direct",
    user: {
      userId: session.userId || null,
      userName: session.userName || null,
    },
    loginTime: session.loginTime || null,
    hasAccessToken: Boolean(session.accessToken),
    hasRequestToken: Boolean(session.requestToken),
    warnings: [
      !process.env.KITE_API_KEY ? "KITE_API_KEY is missing" : null,
      !process.env.KITE_API_SECRET ? "KITE_API_SECRET is missing" : null,
    ].filter(Boolean),
  });
};
