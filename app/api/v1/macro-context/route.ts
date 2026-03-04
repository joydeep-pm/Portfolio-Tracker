import path from "node:path";

import Database from "better-sqlite3";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Db = InstanceType<typeof Database>;

type ImpactedCluster = {
  cluster_name: string;
  impact_direction: "up" | "down" | "flat";
  impact_score: number | null;
};

type MacroContextPayload = {
  sentiment_score: number;
  key_catalyst: string;
  impacted_clusters: ImpactedCluster[];
  rationale_summary: string;
  source_url: string | null;
  source_label: string | null;
  timestamp: string | null;
};

function resolveDbPath() {
  return path.resolve(process.env.MACRO_EVENTS_DB_PATH || path.join(process.cwd(), "data", "macro_events.db"));
}

function openDatabase(): Db {
  return new Database(resolveDbPath(), { readonly: true, fileMustExist: true });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toLowerSafe(value: unknown) {
  return String(value || "").toLowerCase();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonSafe(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getTableNames(db: Db) {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  return new Set(rows.map((row) => String(row.name)));
}

function getColumns(db: Db, tableName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => String(row.name)));
}

function pickFirst(columns: Set<string>, candidates: string[]) {
  return candidates.find((candidate) => columns.has(candidate)) || null;
}

function normalizeImpactedClusters(value: unknown): ImpactedCluster[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const clusterName = String(row.cluster_name || row.clusterName || row.name || "").trim();
      if (!clusterName) return null;

      const impactScoreRaw = row.impact_score ?? row.impactScore;
      const impactScore = Number.isFinite(Number(impactScoreRaw)) ? Number(impactScoreRaw) : null;
      const directionRaw = String(row.impact_direction || row.impactDirection || "").toLowerCase();
      let impactDirection: "up" | "down" | "flat" = "flat";
      if (directionRaw === "up" || directionRaw === "positive") impactDirection = "up";
      else if (directionRaw === "down" || directionRaw === "negative") impactDirection = "down";
      else if (impactScore !== null) impactDirection = impactScore > 0 ? "up" : impactScore < 0 ? "down" : "flat";

      return {
        cluster_name: clusterName,
        impact_direction: impactDirection,
        impact_score: impactScore,
      };
    })
    .filter(Boolean) as ImpactedCluster[];
}

function normalizeAnalysis(raw: unknown, row: Record<string, unknown>): MacroContextPayload | null {
  const parsed = parseJsonSafe(raw);
  if (!parsed) return null;

  const sentiment = clamp(toNumber(parsed.sentiment_score ?? parsed.sentimentScore ?? 0, 0), -1, 1);
  const catalyst = String(parsed.key_catalyst || parsed.keyCatalyst || "").trim();
  const rationale = String(parsed.rationale_summary || parsed.rationaleSummary || "").trim();
  const impacted = normalizeImpactedClusters(parsed.impacted_clusters || parsed.impactedClusters || []);

  const sourceFromAnalysis =
    String(
      (parsed.source as Record<string, unknown> | undefined)?.url ||
        (parsed.source as Record<string, unknown> | undefined)?.link ||
        parsed.source_url ||
        "",
    ).trim() || null;

  const sourceLabel =
    String(
      (parsed.source as Record<string, unknown> | undefined)?.label ||
        parsed.source_label ||
        row.source_label ||
        row.source_type ||
        "",
    ).trim() || null;

  const timestamp =
    String(parsed.timestamp || parsed.asOf || parsed.published_date || row.published_at || row.published_date || "").trim() || null;

  return {
    sentiment_score: sentiment,
    key_catalyst: catalyst || "No macro catalyst available.",
    impacted_clusters: impacted,
    rationale_summary: rationale || "No rationale summary is available yet.",
    source_url: sourceFromAnalysis || (String(row.source_url || row.url || "").trim() || null),
    source_label: sourceLabel,
    timestamp,
  };
}

function queryFromLlmAnalysisTable(db: Db, symbol: string, theme: string) {
  const columns = getColumns(db, "llm_analysis");
  const jsonCol = pickFirst(columns, ["analysis_json", "llm_analysis", "analysis", "payload"]);
  if (!jsonCol) return null;

  const symbolCol = pickFirst(columns, ["symbol", "ticker"]);
  const themeCol = pickFirst(columns, ["theme", "theme_hint", "cluster", "sector"]);
  const sourceCol = pickFirst(columns, ["source_url", "url", "link"]);
  const sourceLabelCol = pickFirst(columns, ["source_label", "source_type", "source"]);
  const publishedCol = pickFirst(columns, ["published_date", "published_at", "as_of", "created_at", "timestamp"]);

  const whereParts: string[] = [`${jsonCol} IS NOT NULL`, `TRIM(${jsonCol}) <> ''`];
  const params: Record<string, unknown> = {};

  if (symbol) {
    params.symbolUpper = symbol.toUpperCase();
    params.symbolLike = `%${toLowerSafe(symbol)}%`;

    const symbolChecks: string[] = [];
    if (symbolCol) symbolChecks.push(`UPPER(${symbolCol}) = @symbolUpper`);
    symbolChecks.push(`LOWER(${jsonCol}) LIKE @symbolLike`);
    whereParts.push(`(${symbolChecks.join(" OR ")})`);
  }

  if (theme) {
    params.themeLike = `%${toLowerSafe(theme)}%`;
    const themeChecks: string[] = [];
    if (themeCol) themeChecks.push(`LOWER(${themeCol}) LIKE @themeLike`);
    themeChecks.push(`LOWER(${jsonCol}) LIKE @themeLike`);
    whereParts.push(`(${themeChecks.join(" OR ")})`);
  }

  const publishedExpr = publishedCol ? publishedCol : "NULL";
  const sourceExpr = sourceCol ? sourceCol : "NULL";
  const sourceLabelExpr = sourceLabelCol ? sourceLabelCol : "NULL";

  const sql = `
    SELECT
      id,
      ${jsonCol} AS analysis_json,
      ${sourceExpr} AS source_url,
      ${sourceLabelExpr} AS source_label,
      ${publishedExpr} AS published_at
    FROM llm_analysis
    WHERE ${whereParts.join(" AND ")}
    ORDER BY ${publishedCol ? `COALESCE(${publishedCol}, '')` : "id"} DESC, id DESC
    LIMIT 1
  `;

  return (db.prepare(sql).get(params) as Record<string, unknown> | undefined) || null;
}

function queryFromMarketNewsTable(db: Db, symbol: string, theme: string) {
  const columns = getColumns(db, "market_news");
  if (!columns.has("llm_analysis")) return null;

  const whereParts: string[] = ["llm_analysis IS NOT NULL", "TRIM(llm_analysis) <> ''"];
  const params: Record<string, unknown> = {};

  if (symbol) {
    params.symbolLike = `%${toLowerSafe(symbol)}%`;
    whereParts.push(`(LOWER(llm_analysis) LIKE @symbolLike OR LOWER(title) LIKE @symbolLike OR LOWER(content_text) LIKE @symbolLike)`);
  }

  if (theme) {
    params.themeLike = `%${toLowerSafe(theme)}%`;
    whereParts.push(`(LOWER(llm_analysis) LIKE @themeLike OR LOWER(title) LIKE @themeLike OR LOWER(content_text) LIKE @themeLike)`);
  }

  const sql = `
    SELECT
      id,
      llm_analysis AS analysis_json,
      url AS source_url,
      source_type AS source_label,
      published_date AS published_at
    FROM market_news
    WHERE ${whereParts.join(" AND ")}
    ORDER BY COALESCE(published_date, '') DESC, id DESC
    LIMIT 1
  `;

  return (db.prepare(sql).get(params) as Record<string, unknown> | undefined) || null;
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") || "").trim();
  const theme = (request.nextUrl.searchParams.get("theme") || "").trim();

  let db: Db | null = null;
  try {
    db = openDatabase();
    const tables = getTableNames(db);

    let row: Record<string, unknown> | null = null;
    if (tables.has("llm_analysis")) {
      row = queryFromLlmAnalysisTable(db, symbol, theme);
    }
    if (!row && tables.has("market_news")) {
      row = queryFromMarketNewsTable(db, symbol, theme);
    }

    if (!row) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            symbol: symbol || null,
            theme: theme || null,
            found: false,
          },
        },
        { status: 200 },
      );
    }

    const data = normalizeAnalysis(row.analysis_json, row);
    return NextResponse.json(
      {
        data,
        meta: {
          symbol: symbol || null,
          theme: theme || null,
          found: Boolean(data),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "macro-context route failed";
    return NextResponse.json(
      {
        error: "macro-context-route-failed",
        message,
      },
      { status: 500 },
    );
  } finally {
    if (db) db.close();
  }
}
