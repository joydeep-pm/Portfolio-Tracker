module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state, error } = req.query || {};

  if (error) {
    return res.status(400).send(`Angel callback error: ${error}`);
  }

  if (!code) {
    return res.status(400).send("Missing auth code");
  }

  // TODO: Exchange `code` for token using Angel SmartAPI from backend.
  // Keep this server-side only; do not expose secrets in browser code.
  return res.status(200).json({
    ok: true,
    message: "Angel callback received successfully",
    code,
    state: state || null,
  });
};
