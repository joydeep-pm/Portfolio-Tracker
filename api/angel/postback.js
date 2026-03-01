module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO: Verify signature/auth headers once webhook contract is finalized.
  // For now this is an ack endpoint to confirm connectivity.
  return res.status(200).json({
    ok: true,
    received: true,
    at: new Date().toISOString(),
  });
};
