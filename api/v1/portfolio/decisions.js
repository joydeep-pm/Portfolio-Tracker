const { getDecisions } = require("../../_lib/portfolioService");
const { exchangeKey, json, methodNotAllowed } = require("../../_lib/http");

module.exports = async function handler(req, res) {
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
};
