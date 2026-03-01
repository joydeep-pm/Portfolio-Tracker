# Thematic Engine Build Plan

## Plan
- [x] Initialize project structure for a standalone browser app
- [x] Implement generated market universe (2,486 stocks, 26 core heads, 175 micro-clusters)
- [x] Build thematic matrix UI with heatmap momentum cells (1D, 1W, 1M, 6M, YTD)
- [x] Add interaction features: stock search, mode filters, cluster drill-down modal
- [x] Simulate live momentum updates and refresh aggregate values
- [x] Verify behavior locally and document review results
- [x] Retarget taxonomy and labeling to Indian market-only coverage (NSE/BSE context)
- [x] Build comparison engine view with cluster multi-select and control toolbar
- [x] Add normalized comparison chart with timeframe switching (`1D`, `5D`, `1M`, `6M`, `YTD`)
- [x] Add NSE/BSE comparison filter and momentum scan side panel
- [x] Add live update loop for selected cluster series in comparison view
- [x] Verify comparison workflows and document results

## Verify Plan Check-In
- Scope is a functional MVP that reproduces the interaction model and visual framing from the reference screenshots.
- Stack decision: plain HTML/CSS/JS to keep setup friction near zero in an empty repo.
- Data decision: deterministic synthetic universe matching target scale exactly.
- Comparison v1 scope: compare any combination of clusters from all 175 micro-clusters, render normalized series, support timeframe/exchange filters, and show momentum scan for selected set.
- Out of scope for this step: real market feed integration and backend APIs.

## Review
- `node --check app.js` passed.
- Manual runtime verification through Playwright:
  - loaded app at `http://127.0.0.1:4173/index.html`
  - verified universe totals render as 2,486 stocks / 26 heads / 175 clusters
  - verified search + mode filtering pathways update matrix
  - verified cluster click opens composition modal
  - verified live ticks update pulse while modal is open (no modal state exception)
  - verified browser console has zero errors
- Indian-market retarget verification:
  - confirmed page title and hero copy are India-specific
  - confirmed thematic heads are India market sectors (BFSI, PSU, defence, ports, etc.)
  - confirmed exchange mix card and modal exchange breakdown render (`NSE` / `BSE`)
  - confirmed symbol formatting renders as `NSE:XXXXX123` / `BSE:XXXXX123`
  - confirmed browser console has zero errors after retarget
- Comparison v1 verification:
  - `node --check app.js` passed after comparison implementation
  - switched between Themes and Comparison views via top nav links
  - confirmed initial cluster chips render and normalized chart canvas is visible
  - confirmed timeframe toggle (`5D`) and exchange filter (`NSE`) update comparison meta
  - confirmed cluster search (`Defence`) returns suggestions and adds selected cluster chip
  - confirmed momentum scan panel updates and live tick increments (`tick #9` -> `tick #10`)
  - confirmed browser console has zero errors during comparison interactions
