"use client";

import { useEffect, useMemo, useState } from "react";

type ImpactedCluster = {
  cluster_name: string;
  impact_direction: "up" | "down" | "flat";
  impact_score: number | null;
};

type MacroContextData = {
  sentiment_score: number;
  key_catalyst: string;
  impacted_clusters: ImpactedCluster[];
  rationale_summary: string;
  source_url: string | null;
  source_label: string | null;
  timestamp: string | null;
};

type ApiResponse = {
  data: MacroContextData | null;
  meta?: {
    found?: boolean;
    symbol?: string | null;
    theme?: string | null;
  };
};

type MacroContextPanelProps = {
  symbol?: string;
  theme?: string;
  className?: string;
  endpoint?: string;
};

function toDisplayTime(timestamp: string | null) {
  if (!timestamp) return "--";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sentimentPosition(score: number) {
  const clamped = Math.max(-1, Math.min(1, score));
  return ((clamped + 1) / 2) * 100;
}

function clusterToneClasses(direction: ImpactedCluster["impact_direction"]) {
  if (direction === "up") return "border-primary/30 bg-primary/10 text-primary";
  if (direction === "down") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

function sentimentToneText(score: number) {
  if (score > 0.2) return "Constructive";
  if (score < -0.2) return "Defensive";
  return "Balanced";
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
      </div>
      <div className="animate-pulse space-y-2 rounded-lg border border-border p-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
      </div>
      <div className="animate-pulse space-y-2 rounded-lg border border-border p-3">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-24 rounded-full bg-muted" />
          <div className="h-6 w-28 rounded-full bg-muted" />
          <div className="h-6 w-20 rounded-full bg-muted" />
        </div>
      </div>
      <div className="animate-pulse space-y-2 rounded-lg border border-border p-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
    </div>
  );
}

export function MacroContextPanel({
  symbol,
  theme,
  className = "",
  endpoint = "/api/v1/macro/context",
}: MacroContextPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MacroContextData | null>(null);

  const queryKey = `${symbol || ""}|${theme || ""}`;

  useEffect(() => {
    const hasQuery = Boolean((symbol || "").trim() || (theme || "").trim());
    if (!hasQuery) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (symbol) params.set("symbol", symbol);
        if (theme) params.set("theme", theme);

        const response = await fetch(`${endpoint}?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Macro context request failed (${response.status})`);
        }

        const payload = (await response.json()) as ApiResponse;
        setData(payload.data || null);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unable to load macro context.";
        setError(message);
        setData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [queryKey, endpoint, symbol, theme]);

  const score = Number(data?.sentiment_score || 0);
  const meterPosition = useMemo(() => sentimentPosition(score), [score]);

  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`.trim()}>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Macro &amp; Regulatory Context</h3>
        <p className="text-xs text-muted-foreground">
          {symbol ? `Symbol: ${symbol}` : theme ? `Theme: ${theme}` : "Select symbol/theme"}
        </p>
      </header>

      {loading ? <LoadingSkeleton /> : null}

      {!loading && error ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">{error}</div>
      ) : null}

      {!loading && !error && !data ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          No macro context available yet for this selection.
        </div>
      ) : null}

      {!loading && !error && data ? (
        <div className="space-y-4">
          <article className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sentiment Meter</p>
              <span className="text-xs font-medium text-foreground">
                {sentimentToneText(score)} ({score.toFixed(2)})
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted">
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary" style={{ left: `${meterPosition}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>-1.0</span>
              <span>+1.0</span>
            </div>
          </article>

          <article className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Key Catalyst</p>
            <p className="inline-flex rounded-md border border-border bg-muted px-2 py-1 text-sm font-medium text-foreground">
              {data.key_catalyst}
            </p>
          </article>

          <article className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Impacted Clusters</p>
            <div className="flex flex-wrap gap-2">
              {data.impacted_clusters.length ? (
                data.impacted_clusters.map((cluster, index) => (
                  <span key={`${cluster.cluster_name}-${index}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${clusterToneClasses(cluster.impact_direction)}`}>
                    <span>{cluster.cluster_name}</span>
                    {typeof cluster.impact_score === "number" ? <span className="opacity-80">{cluster.impact_score.toFixed(2)}</span> : null}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No impacted clusters returned.</span>
              )}
            </div>
          </article>

          <article className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Rationale</p>
            <p className="text-sm leading-6 text-foreground">{data.rationale_summary}</p>
          </article>

          <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Source: {" "}
              {data.source_url ? (
                <a className="underline underline-offset-2" href={data.source_url} target="_blank" rel="noreferrer">
                  {data.source_label || "View source"}
                </a>
              ) : (
                <span>{data.source_label || "N/A"}</span>
              )}
            </span>
            <span>{toDisplayTime(data.timestamp)}</span>
          </footer>
        </div>
      ) : null}
    </section>
  );
}

export default MacroContextPanel;
