const ACTIONS = ["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, scale) {
  return clamp(value / scale, -1, 1);
}

function decisionForRow(row, context = {}) {
  const targetWeight = Number.isFinite(context.targetWeightPct) ? context.targetWeightPct : 0;
  const returns = row.returns || {};
  const longTrend = normalize(returns.YTD || 0, 30) * 0.34 + normalize(returns["6M"] || 0, 24) * 0.29;
  const mediumTrend = normalize(returns["1M"] || 0, 12) * 0.18;
  const shortNoisePenalty = -Math.abs(normalize(returns["1D"] || 0, 4)) * 0.06 - Math.abs(normalize(returns["1W"] || 0, 7)) * 0.05;

  const weightDrift = targetWeight > 0 ? (row.weightPct - targetWeight) / targetWeight : 0;
  const overweightPenalty = weightDrift > 0.35 ? -0.15 : weightDrift > 0.2 ? -0.08 : 0;
  const underweightBoost = weightDrift < -0.25 ? 0.08 : 0;

  const stressPenalty = row.unrealizedPnlPct <= -15 ? -0.13 : row.unrealizedPnlPct <= -8 ? -0.07 : 0;
  const scoreNorm = clamp(longTrend + mediumTrend + shortNoisePenalty + overweightPenalty + underweightBoost + stressPenalty, -1, 1);
  const score = Number.parseFloat((scoreNorm * 100).toFixed(2));

  let action = "HOLD";
  if (score >= 35) action = row.weightPct < targetWeight * 0.9 ? "BUY" : "ACCUMULATE";
  else if (score >= 15) action = "ACCUMULATE";
  else if (score <= -40) action = "SELL";
  else if (score <= -18) action = "REDUCE";

  const confidenceBase = Math.abs(scoreNorm) * 100;
  const confidence = Number.parseFloat(clamp(confidenceBase * 0.82 + (row.weightPct > targetWeight * 1.5 ? 8 : 0), 35, 98).toFixed(1));

  const reasons = [];
  const riskFlags = [];

  if ((returns.YTD || 0) > 10) reasons.push(`Strong long-term trend (${returns.YTD.toFixed(1)}% YTD)`);
  if ((returns["6M"] || 0) > 6) reasons.push(`Healthy 6M continuation (${returns["6M"].toFixed(1)}%)`);
  if ((returns["1M"] || 0) > 3) reasons.push(`Positive 1M confirmation (${returns["1M"].toFixed(1)}%)`);
  if ((returns.YTD || 0) < -10) reasons.push(`Weak long-term trend (${returns.YTD.toFixed(1)}% YTD)`);
  if ((returns["1M"] || 0) < -6) reasons.push(`1M breakdown (${returns["1M"].toFixed(1)}%)`);

  if (row.weightPct > targetWeight * 1.4 && targetWeight > 0) {
    reasons.push(`Allocation above target (${row.weightPct.toFixed(1)}% vs ${targetWeight.toFixed(1)}%)`);
    riskFlags.push("Concentration risk");
  }

  if (row.unrealizedPnlPct <= -12) {
    riskFlags.push("Deep drawdown");
  }

  if ((returns["1D"] || 0) <= -3) {
    riskFlags.push("High short-term downside momentum");
  }

  if (!reasons.length) reasons.push("Mixed trend signals, maintain discipline");

  return {
    action,
    confidence,
    score,
    reasons: reasons.slice(0, 5),
    riskFlags: riskFlags.slice(0, 4),
    asOf: context.asOf || new Date().toISOString(),
  };
}

function evaluatePortfolio(rows, asOf) {
  const targetWeight = rows.length ? 100 / rows.length : 0;
  return rows.map((row) => ({
    symbol: row.symbol,
    exchange: row.exchange,
    ...decisionForRow(row, {
      targetWeightPct: targetWeight,
      asOf,
    }),
  }));
}

module.exports = {
  ACTIONS,
  decisionForRow,
  evaluatePortfolio,
};
