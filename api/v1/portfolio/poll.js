const { pollPortfolio } = require("../../_lib/portfolioService");
const { exchangeKey, json, methodNotAllowed } = require("../../_lib/http");

module.exports = async function handler(req, res) {
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
};
