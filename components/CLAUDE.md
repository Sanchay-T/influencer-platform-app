# CLAUDE.md

## Context
This folder (`components/`) contains shared UI components.
- **UI:** Reusable primitives (Buttons, Inputs) in `ui/`.
- **Feature:** Shared feature components (Email templates).

## Patterns
- **Shadcn UI:** Use `cva` for variants and `cn` for class merging.
- **Icons:** Use `lucide-react`.
- **Client/Server:** Most UI components should be Server Components unless they need state.
- **Exports:** Named exports preferred.

## Styling
- **Tailwind:** Use utility classes.
- **Variables:** Use CSS variables for colors (`bg-primary`, `text-foreground`).
- **Responsive:** Mobile-first (`w-full md:w-auto`).

## Do Not
- **Do not** use `style={{}}` props. Use Tailwind.
- **Do not** import from `app/`. Components should be independent.
- **Do not** hardcode colors. Use theme variables.pp/components/`.
