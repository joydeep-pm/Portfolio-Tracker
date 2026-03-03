module.exports = async function handler(req, res) {
  const action = String(req.query?.action || "").toLowerCase();

  if (action === "callback") {
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

    return res.status(200).json({
      ok: true,
      message: "Angel callback received successfully",
      code,
      state: state || null,
    });
  }

  if (action === "postback") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    return res.status(200).json({
      ok: true,
      received: true,
      at: new Date().toISOString(),
    });
  }

  if (action === "health") {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const requiredKeys = ["ANGEL_API_KEY", "ANGEL_CLIENT_CODE", "ANGEL_PIN", "ANGEL_TOTP_SECRET"];
    const checks = requiredKeys.map((key) => ({
      key,
      present: typeof process.env[key] === "string" && process.env[key].trim().length > 0,
    }));
    const ready = checks.every((item) => item.present);

    return res.status(200).json({
      ok: true,
      provider: "angel-one",
      mode: ready ? "ready-for-session-attempt" : "missing-env-values",
      ready,
      checks,
      serverTime: new Date().toISOString(),
      note: ready
        ? "All required env vars are present. You can now attempt session generation once account activation is complete."
        : "Set missing env vars in Vercel Project Settings > Environment Variables.",
    });
  }

  return res.status(404).json({ error: "Not found" });
};
