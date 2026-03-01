# Indian Thematic Market Tracker Prototype

Interactive thematic engine prototype that models:
- 2,486 stocks
- 26 core thematic heads
- 175 micro-clusters
- momentum windows: `1D`, `1W`, `1M`, `6M`, `YTD`

Market scope:
- India-only synthetic universe mapped to NSE/BSE context

## Run

```bash
python3 -m http.server 4173
```

Open:
- http://127.0.0.1:4173/index.html

## Features

- Generated universe at the requested scale
- Indian-market taxonomy (BFSI, PSU, defence, rail-logistics, chemicals, etc.)
- Heatmap matrix grouped by thematic head and cluster
- Search over heads, clusters, stock names, symbols, and exchange tags
- Mode filters: all, movers, laggards
- Cluster drill-down modal with stock-level momentum
- Live momentum simulation with pause/resume control
- Comparison view with multi-select cluster combinations (up to 8 at once)
- Timeframe controls (`1D`, `5D`, `1M`, `6M`, `YTD`)
- Exchange filters (`All`, `NSE`, `BSE`)
- Normalized real-time line chart and relative-strength scan panel

## Backend Integration (NSE/BSE Adapter Hooks v1)

The app supports two runtime data modes through a global config object:

```html
<script>
  window.PORTFOLIO_TRACKER_CONFIG = {
    dataMode: "backend", // "backend" | "synthetic"
    apiBaseUrl: "/api/v1",
    authToken: "YOUR_BEARER_TOKEN"
  };
</script>
```

Defaults (when omitted) are:
- `dataMode: "synthetic"`
- `apiBaseUrl: "/api/v1"`
- `authToken: ""`

If `dataMode` is `backend` but token/config is invalid, the UI shows an adapter warning and automatically falls back to synthetic mode.

### Backend endpoints

`GET /market/bootstrap`
- query: `exchange=all|nse|bse`, `window=1D|5D|1M|6M|YTD`, `include=taxonomy,stocks,momentum`
- response:

```json
{
  "asOf": "2026-03-01T09:47:10+05:30",
  "cursor": "1740802630_8891",
  "heads": [],
  "clusters": [],
  "stocks": []
}
```

`GET /market/poll`
- query: `cursor=<lastCursor>`, `exchange=all|nse|bse`
- response:

```json
{
  "asOf": "2026-03-01T09:47:15+05:30",
  "cursor": "1740802635_8899",
  "updates": {
    "stocks": [],
    "clusters": [],
    "heads": []
  }
}
```

`GET /comparison/series`
- query: `clusterIds=cluster-1,cluster-9`, `window=1D|5D|1M|6M|YTD`, `exchange=all|nse|bse`, `points=<n>`
- response:

```json
{
  "asOf": "2026-03-01T09:47:15+05:30",
  "window": "1M",
  "exchange": "all",
  "seriesByClusterId": {
    "cluster-1": [{ "ts": "2026-03-01T09:46:15+05:30", "value": 1.2 }]
  }
}
```

### Auth contract

Backend mode sends:
- `Accept: application/json`
- `Authorization: Bearer <authToken>`

### Polling, retry, staleness

- Backend mode polling cadence:
  - market hours (IST weekdays 09:15–15:30): every 5s
  - off-hours: every 60s
  - hidden tab: interval x2
- Retry backoff on failures: `5s -> 10s -> 20s -> ...` (capped at `60s`)
- Stale state triggers when:
  - 2+ consecutive poll failures, or
  - no successful update for >20s during market hours
- UI behavior on failures:
  - keeps last good data visible
  - shows status chip (`Data delayed • retrying` or temporary sync issue)
