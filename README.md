# Indian Thematic Market Architecture Prototype

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
- Comparison engine with multi-select cluster combinations (up to 8 at once)
- Timeframe controls (`1D`, `5D`, `1M`, `6M`, `YTD`)
- Exchange filters (`All`, `NSE`, `BSE`)
- Normalized real-time line chart and momentum scan panel
