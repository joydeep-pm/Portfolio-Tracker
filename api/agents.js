const { routePrompt } = require("./_lib/agentRouter");
const { runAgentWorkflow } = require("./_lib/multiAgentEngine");
const { CONTRACTS } = require("./_lib/contracts");
const { initTrace, traceLog } = require("./_lib/trace");
const { exchangeKey, json, methodNotAllowed, parseJsonBody } = require("./_lib/http");

module.exports = async function handler(req, res) {
  const trace = initTrace(req, res, "agents-api");
  const route = String(req.query?.route || "").toLowerCase();

  if (route === "intent") {
    if (req.method !== "GET") return methodNotAllowed(res);
    const prompt = String(req.query?.prompt || "");
    const payload = routePrompt(prompt);
    traceLog(trace, "info", "agents.intent", { promptLength: prompt.length, intent: payload.intent });
    return json(res, 200, {
      ...payload,
      meta: {
        contractVersion: CONTRACTS.agents,
        traceId: trace.traceId,
      },
    });
  }

  if (route === "analyze") {
    if (req.method !== "POST") return methodNotAllowed(res);
    try {
      const body = await parseJsonBody(req);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        return json(res, 400, {
          error: "invalid-prompt",
          message: "prompt is required",
          meta: {
            contractVersion: CONTRACTS.agents,
            traceId: trace.traceId,
          },
        });
      }

      const payload = await runAgentWorkflow({
        prompt,
        exchange: exchangeKey(body.exchange || req.query?.exchange),
      });
      traceLog(trace, "info", "agents.analyze.success", {
        intent: payload.intent,
        decisions: payload.summary?.totalDecisions || 0,
      });
      return json(res, 200, {
        ...payload,
        meta: {
          contractVersion: CONTRACTS.agents,
          traceId: trace.traceId,
        },
      });
    } catch (error) {
      traceLog(trace, "error", "agents.analyze.failed", { message: error.message });
      return json(res, 500, {
        error: "agent-analysis-failed",
        message: error.message,
        meta: {
          contractVersion: CONTRACTS.agents,
          traceId: trace.traceId,
        },
      });
    }
  }

  return json(res, 404, {
    error: "Not found",
    meta: {
      contractVersion: CONTRACTS.agents,
      traceId: trace.traceId,
    },
  });
};
