# components/CLAUDE.md — Shared UI Primitives
Last updated: 2025-11-27
Imports: ../CLAUDE.md, ../.claude/CLAUDE.md, app/CLAUDE.md.

## Scope
Framework-agnostic, reusable UI + email primitives (Shadcn/Radix + Tailwind + React Email). Feature-specific UI lives under `app/components/`; keep this layer clean and dependency-light.

## Key Areas
- `components/ui/*` — Shadcn primitives (button, card, input, dialog, table, tabs, toast, badge, skeleton, etc.) built with `cva` variants.
- `components/email-templates/*` — React Email templates (welcome, trial reminders, abandonment).
- `components/trial/*` — Trial-related widgets.
- `components/lists/*` — Shared list actions (e.g., add-to-list button).

## Do / Don’t
- Do: keep components pure and composable; prefer prop-driven variants over hard-coded styles.
- Do: enforce accessibility (Radix semantics, focus states, ARIA labels).
- Do: export TypeScript types with components.
- Don’t: import from `app/` or business logic; pass data in from callers.
- Don’t: add one-off styles—extend variants instead.

## Usage Patterns
- Import via `@/components/ui/<component>`; keep variant names aligned across primitives (`variant`, `size`, `intent`).
- For emails, ensure templates remain inline-style friendly and avoid browser-only APIs.

## Testing & QA
- Visual sanity via Story/Playground (if present) or `app/test/` pages.
- When changing primitives, scan dependent features for regressions (Buttons, Dialogs, Toasts are widely used).

## Update Rules
Update when adding/removing primitives or email templates. Keep examples minimal; link to Story/playground instead of embedding long snippets.
