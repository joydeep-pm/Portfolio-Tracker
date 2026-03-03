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
};
