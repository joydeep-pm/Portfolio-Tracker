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
