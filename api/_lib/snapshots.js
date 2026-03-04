const { bootstrapPortfolio } = require("./portfolioService");

const memorySnapshots = new Map();
const memoryDecisionAudit = [];

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function supabaseReady() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function supabaseSelectByDate(snapshotDate) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/portfolio_snapshots?snapshot_date=eq.${snapshotDate}&select=id,snapshot_date&limit=1`;
  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed (${response.status})`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] : null;
}

async function supabaseInsertSnapshot(row) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/portfolio_snapshots`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify([row]),
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed (${response.status})`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] : null;
}

async function supabaseInsertDecisionAudit(snapshotDate, snapshot) {
  const rows = snapshot.rows.map((row) => ({
    snapshot_date: snapshotDate,
    symbol: row.symbol,
    exchange: row.exchange,
    action: row.decision?.action || "HOLD",
    confidence: row.decision?.confidence || 0,
    score: row.decision?.score || 0,
    reasons: row.decision?.reasons || [],
    risk_flags: row.decision?.riskFlags || [],
    as_of: snapshot.asOf,
  }));

  if (!rows.length) return;

  const url = `${process.env.SUPABASE_URL}/rest/v1/decision_audit_events`;
  await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
}

async function supabaseListDecisionAuditEvents(options = {}) {
  const symbol = String(options.symbol || "").toUpperCase();
  const exchange = String(options.exchange || "").toUpperCase();
  const limit = Math.max(1, Math.min(200, Number.parseInt(String(options.limit || 60), 10) || 60));
  const search = new URLSearchParams();
  search.set("select", "snapshot_date,symbol,exchange,action,confidence,score,as_of,created_at");
  search.set("order", "as_of.desc");
  search.set("limit", String(limit));
  if (symbol) search.set("symbol", `eq.${symbol}`);
  if (exchange) search.set("exchange", `eq.${exchange}`);

  const url = `${process.env.SUPABASE_URL}/rest/v1/decision_audit_events?${search.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Supabase decision audit read failed (${response.status})`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((row) => ({
    snapshotDate: row.snapshot_date || null,
    symbol: String(row.symbol || "").toUpperCase(),
    exchange: String(row.exchange || "").toUpperCase(),
    action: String(row.action || "HOLD").toUpperCase(),
    confidence: Number(row.confidence || 0),
    score: Number(row.score || 0),
    asOf: row.as_of || row.created_at || null,
    createdAt: row.created_at || null,
  }));
}

async function listDecisionAuditEvents(options = {}) {
  const symbol = String(options.symbol || "").toUpperCase();
  const exchange = String(options.exchange || "").toUpperCase();
  const limit = Math.max(1, Math.min(200, Number.parseInt(String(options.limit || 60), 10) || 60));

  if (supabaseReady()) {
    try {
      return await supabaseListDecisionAuditEvents({
        symbol,
        exchange,
        limit,
      });
    } catch (_error) {
      // Fall through to memory mode.
    }
  }

  const filtered = memoryDecisionAudit
    .filter((entry) => {
      if (symbol && String(entry.symbol || "").toUpperCase() !== symbol) return false;
      if (exchange && String(entry.exchange || "").toUpperCase() !== exchange) return false;
      return true;
    })
    .sort((a, b) => String(b.asOf || b.createdAt || "").localeCompare(String(a.asOf || a.createdAt || "")))
    .slice(0, limit)
    .map((entry) => ({
      snapshotDate: entry.snapshotDate || null,
      symbol: String(entry.symbol || "").toUpperCase(),
      exchange: String(entry.exchange || "").toUpperCase(),
      action: String(entry.action || "HOLD").toUpperCase(),
      confidence: Number(entry.confidence || 0),
      score: Number(entry.score || 0),
      asOf: entry.asOf || entry.createdAt || null,
      createdAt: entry.createdAt || null,
    }));

  return filtered;
}

async function saveEodSnapshot(options = {}) {
  const snapshotDate = options.snapshotDate || toIsoDate(new Date());
  const snapshot = options.snapshot || (await bootstrapPortfolio({ exchange: "all", forceRefresh: true }));

  const row = {
    snapshot_date: snapshotDate,
    as_of: snapshot.asOf,
    provider: snapshot.provider,
    provider_mode: snapshot.providerMode,
    connected: snapshot.connected,
    metrics: snapshot.summary,
    rows: snapshot.rows,
    decisions: snapshot.rows.map((item) => item.decision),
    created_at: new Date().toISOString(),
  };

  if (!supabaseReady()) {
    if (memorySnapshots.has(snapshotDate)) {
      return {
        stored: false,
        mode: "memory",
        reason: "snapshot-exists",
        snapshotDate,
      };
    }

    memorySnapshots.set(snapshotDate, row);
    row.rows.forEach((entry) => {
      memoryDecisionAudit.push({
        snapshotDate,
        symbol: entry.symbol,
        exchange: entry.exchange,
        action: entry.decision?.action || "HOLD",
        confidence: entry.decision?.confidence || 0,
        score: entry.decision?.score || 0,
        asOf: snapshot.asOf,
        createdAt: new Date().toISOString(),
      });
    });

    return {
      stored: true,
      mode: "memory",
      snapshotDate,
      totalSymbols: row.rows.length,
    };
  }

  const existing = await supabaseSelectByDate(snapshotDate);
  if (existing) {
    return {
      stored: false,
      mode: "supabase",
      reason: "snapshot-exists",
      snapshotDate,
      id: existing.id,
    };
  }

  const inserted = await supabaseInsertSnapshot(row);
  await supabaseInsertDecisionAudit(snapshotDate, snapshot).catch(() => {
    // Snapshot persists even if audit insert fails.
  });

  return {
    stored: true,
    mode: "supabase",
    snapshotDate,
    id: inserted?.id || null,
    totalSymbols: row.rows.length,
  };
}

module.exports = {
  saveEodSnapshot,
  listDecisionAuditEvents,
};
