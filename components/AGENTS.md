# AGENTS.md -# AGENTS.md

## Overview
The `components/` directory contains shared UI primitives and feature-agnostic components. It follows the Shadcn UI pattern.

## Structure
- **`ui/`**: Atomic primitives (Button, Input, Card). **Do not modify logic here, only styles.**
- **`email-templates/`**: React Email templates.
- **`landing/`**: Components specific to the marketing site.
- **`lists/`**: Shared list display components.
- **`onboarding/`**: Shared onboarding steps.

## Key Rules
1. **Composition:** Build complex UIs by composing primitives from `ui/`.
2. **Styling:**
   - Use Tailwind CSS for everything.
   - Use `cn()` to allow class overrides from props.
   - Respect the design system (colors, spacing, typography).
3. **Accessibility:**
   - Ensure all interactive elements have `aria-label` or visible labels.
   - Use semantic HTML (`button`, `nav`, `main`).
4. **Independence:** Components here should NOT depend on `app/` code. They should be portable.

## Example
```tsx
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva("...", { ... })

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}
```
