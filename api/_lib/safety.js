const RECOMMENDATION_DISCLAIMER =
  "For educational use only. This is not investment advice. Validate with your risk profile and a licensed advisor before trading.";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function applyDecisionGuardrails(decision, options = {}) {
  const liveTradingEnabled = Boolean(options.liveTradingEnabled);
  const maxConfidence = Number.isFinite(Number(options.maxConfidence)) ? Number(options.maxConfidence) : 95;
  const minDecisionConfidence = Number.isFinite(Number(options.minDecisionConfidence)) ? Number(options.minDecisionConfidence) : 40;

  const next = {
    ...decision,
    confidence: Number.parseFloat(clamp(toNumber(decision.confidence, 0), 0, maxConfidence).toFixed(1)),
    riskFlags: Array.isArray(decision.riskFlags) ? [...decision.riskFlags] : [],
    rationale: Array.isArray(decision.rationale) ? [...decision.rationale] : [],
  };

  const aggressive = next.action === "BUY" || next.action === "SELL";
  if (aggressive && next.confidence < minDecisionConfidence) {
    next.action = "HOLD";
    next.rationale.push("Guardrail override: confidence below execution threshold");
    next.riskFlags.push("Low-confidence signal");
  }

  if (!liveTradingEnabled && aggressive) {
    next.riskFlags.push("Live-trading disabled (advisory only)");
  }

  next.riskFlags = [...new Set(next.riskFlags)];
  return next;
}

module.exports = {
  RECOMMENDATION_DISCLAIMER,
  applyDecisionGuardrails,
};
