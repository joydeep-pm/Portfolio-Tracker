const { saveEodSnapshot } = require("../../../_lib/snapshots");
const { json, methodNotAllowed, parseJsonBody } = require("../../../_lib/http");

module.exports = async function handler(req, res) {
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
};
