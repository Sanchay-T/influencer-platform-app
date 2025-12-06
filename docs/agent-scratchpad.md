# Agent Scratchpad (Codex)

- **Preferences**: keep source files <300 lines; prioritize modular design over inline repetition; minimize code size while preserving business flow.
- **Business rules**: paid-only onboarding; 3 plans (monthly/yearly); card required even for trial; completion only after paid/active Stripe sub.
- **Logging**: per-user structured logs (mask PII), grouped and retrievable; event sourcing for onboarding steps; avoid noisy banners.
- **Testing**: favor lean E2E scripts over unit tests; avoid clutter—only essential helpers.
- **Next actions**:
  1) Add onboarding schemas + flow/guard/email helpers.
  2) Refactor onboarding routes to use helpers; keep each file <300 lines.
  3) Add E2E scripts for paid success, unpaid block, ordering/plan validation.
  4) Verify logs/events per user and file sizes; run lint.

