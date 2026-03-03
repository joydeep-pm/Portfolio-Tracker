const { buildPreview } = require("../../_lib/orderService");
const { json, methodNotAllowed, parseJsonBody } = require("../../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const body = await parseJsonBody(req);
  const preview = await buildPreview(body);

  if (!preview.ok) {
    return json(res, 400, preview);
  }

  return json(res, 200, preview);
};
