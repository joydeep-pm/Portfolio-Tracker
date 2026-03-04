# Lessons Learned

## 2026-03-01
- User correction: scope must be specific to Indian market.
- Preventive rule: explicitly confirm region scope in UI copy, taxonomy, and generated symbol conventions before finalizing market analytics features.
- Preventive rule: for market-intelligence prototypes, include exchange context (NSE/BSE for India) in the first shipped version, not as a follow-up.
- User correction: remove borrowed third-party branding/copy references from the project.
- Preventive rule: run a final copy audit for borrowed labels/phrasing before closing UI tasks, especially after screenshot-inspired implementations.
- Preventive rule: prefer neutral product-owned naming in headings, nav labels, and docs from v1 instead of retrofitting later.

## 2026-03-02
- User correction: operational setup guidance was too technical for the user’s current workflow.
- Preventive rule: when guiding third-party onboarding steps (broker/API dashboards), default to short, action-only checklists with minimal jargon first.
- Preventive rule: sequence instructions by immediate user action (what to click and where) before architecture details, and defer technical internals until asked.

## 2026-03-03
- User correction: production deployment succeeded but API URLs still returned 404.
- Preventive rule: on Vercel Hobby/non-Next setups, validate runtime route resolution on production domain after any routing refactor before asking user to test.
- Preventive rule: prefer stable function filenames plus `vercel.json` rewrites over bracket dynamic filenames for API routing portability.

## 2026-03-04
- User correction: dark-theme rebrand shipped with unreadable table text in production.
- Preventive rule: for any UI refactor, run a contrast and readability pass on all interactive elements (`button`, `a`, inputs) to catch browser default color inheritance.
- Preventive rule: explicitly set `color` and `font-family` on clickable row controls that use `button` elements in dark themes.
- User correction: some return values overflowed outside heatmap chips after typography/theme change.
- Preventive rule: for dense metric chips, always enforce `white-space: nowrap`, fixed min-height, centered flex alignment, and tested min column widths across desktop/mobile breakpoints.
- User correction: themes grid columns still spilled outside card bounds on large desktop layout.
- Preventive rule: for dense table-like rows, prefer fixed-width metric columns with a flexible first column (`minmax(0,1fr)`) and ellipsis truncation, rather than multi-`fr` metric columns that can overflow unpredictably.
- User correction: post-fix micro-cluster names became too aggressively truncated.
- Preventive rule: when truncating taxonomy labels, prefer 2-line clamp before single-line ellipsis so scanability and semantic readability both hold.
- User correction: even with truncation tweaks, single-row theme layout still forced tradeoff between readable labels and boxed metrics.
- Preventive rule: for dense analytics rows with long labels, split into a two-tier row structure (label/meta row + metrics row) instead of forcing all fields into one horizontal grid.
- User correction: themes heatmap looked misaligned after two-tier refactor due centered button text behavior.
- Preventive rule: when rows are rendered as `<button>`, explicitly set `text-align: left` and `justify-self` for key grid children to avoid default centering artifacts.
- User correction: themes heatmap must align directly under period headers, and cluster text should remain one-line.
- Preventive rule: do not introduce multi-line/two-tier row structures for period heatmaps unless explicitly requested; keep row schema identical to header schema for visual alignment.
- User correction: one-line labels still clipped after alignment restore.
- Preventive rule: when one-line full labels are required in dense heatmaps, first tighten metric-column footprint and use responsive label font sizing before changing row structure.
- User correction: roadmap template existed but was perceived as non-actionable because progress/evidence and active execution items were missing.
- Preventive rule: when creating a tracking roadmap, always include a live execution board, per-item sub-steps, and immediate status/evidence updates in the same turn.
- Preventive rule: after creating any planning artifact, begin at least one concrete implementation item and mark it with verification evidence to avoid a static checklist impression.
- User correction: troubleshooting guidance around DevTools/token extraction was not explicit enough.
- Preventive rule: for operational support, provide exact click-path instructions (menu names, shortcuts, tab names) and avoid high-level phrasing like "open DevTools" without navigation steps.
- User correction: every shipped change should be reflected in the homepage "What's New" surface.
- Preventive rule: whenever a user-visible capability is added, append a dated entry to the `WHATS_NEW_FEED` in `app.js` and ensure the "What's New" panel reflects it before handoff.
- User correction: theme heatmap rows must begin at the same left anchor and align exactly under period headers.
- Preventive rule: keep `.table-head` and `.cluster-row` on an identical fixed-column grid template; avoid mixing `fr` sizing in metric columns for dense heatmaps.
- User correction: "What's New" should be a standalone page, not embedded only inside Themes.
- Preventive rule: when a section drives navigation/actions across multiple workflows, promote it to a dedicated top-nav view instead of burying it inside another page.
- User correction: UI claims must clearly differentiate pre-existing screens vs newly delivered plan-derived changes.
- Preventive rule: when summarizing delivery, include a visible source-to-feature traceability block in-product (repo source -> module path -> UI/API surface).
- User correction: theme heatmap columns (`6M/YTD`) were clipped at 3-cards-per-row laptop widths.
- Preventive rule: size dense heatmap cards from required internal grid width first; set container min width so layouts gracefully step down to fewer cards per row before columns clip.
- User correction: Phase 1 storage needed to be SQLite-backed, not JSON-file backed.
- Preventive rule: when user specifies storage technology (e.g., SQLite), implement that exact persistence layer and schema first, and treat alternatives as non-compliant unless explicitly approved.
