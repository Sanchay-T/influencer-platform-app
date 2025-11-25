# components/CLAUDE.md — Shared UI Components

## What This Directory Contains

The `components/` directory contains shared, reusable UI components used across the application. This is the design system layer—Shadcn UI primitives, email templates, and common widgets. These components are framework-agnostic within the app and should NOT import from `app/`.

For feature-specific components tied to particular pages, see `app/components/`.

---

## Directory Structure

```
components/
├── ui/                     → Shadcn/Radix UI primitives
│   ├── button.tsx          → Button variants (primary, secondary, ghost, etc.)
│   ├── card.tsx            → Card container + header/content/footer
│   ├── input.tsx           → Text input with variants
│   ├── select.tsx          → Dropdown select
│   ├── dialog.tsx          → Modal dialogs
│   ├── toast.tsx           → Toast notifications
│   ├── badge.tsx           → Status badges
│   ├── table.tsx           → Data tables
│   ├── tabs.tsx            → Tab navigation
│   ├── dropdown-menu.tsx   → Dropdown menus
│   ├── progress.tsx        → Progress bars
│   ├── skeleton.tsx        → Loading skeletons
│   └── ...                 → Many more primitives
├── email-templates/        → React Email templates
│   ├── welcome-email.tsx   → Onboarding welcome
│   ├── trial-day2-email.tsx → Trial day 2 reminder
│   ├── trial-day5-email.tsx → Trial day 5 reminder
│   └── abandonment-email.tsx → Post-trial abandonment
├── trial/                  → Trial-related UI
│   └── trial-email-schedule.tsx → Email schedule display
└── lists/                  → Creator list components
    └── add-to-list-button.tsx → Add creator to list modal
```

---

## Shadcn UI Primitives (`ui/`)

All UI primitives follow the Shadcn pattern: Radix UI for behavior, Tailwind for styling, `cva` for variants.

### Button (`button.tsx`)

```typescript
import { Button } from '@/components/ui/button';

<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
<Button asChild><Link href="/path">Link Button</Link></Button>
```

To grep: `Button`, `buttonVariants`, `variant=`

### Card (`card.tsx`)

```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

To grep: `Card`, `CardHeader`, `CardContent`

### Input (`input.tsx`)

```typescript
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="email@example.com" />
</div>
```

To grep: `Input`, `Label`

### Dialog (`dialog.tsx`)

```typescript
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Description here</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

To grep: `Dialog`, `DialogTrigger`, `DialogContent`

### Toast (`toast.tsx`)

Use via the `useToast` hook from `app/providers/`:

```typescript
import { useToast } from '@/app/providers/toast-provider';

const { toast } = useToast();
toast({
  title: 'Success',
  description: 'Operation completed',
  variant: 'default' // or 'destructive'
});
```

To grep: `useToast`, `toast(`, `ToastProvider`

### Badge (`badge.tsx`)

```typescript
import { Badge } from '@/components/ui/badge';

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Error</Badge>
```

To grep: `Badge`, `badgeVariants`

### Progress (`progress.tsx`)

```typescript
import { Progress } from '@/components/ui/progress';

<Progress value={33} /> // 33% complete
```

To grep: `Progress`, `value={`

---

## Email Templates (`email-templates/`)

React Email templates for transactional emails sent via Resend.

### Welcome Email (`welcome-email.tsx`)

Sent when user completes onboarding.

```typescript
import { WelcomeEmail } from '@/components/email-templates/welcome-email';

// Props: { userName, planName }
```

### Trial Day 2 Email (`trial-day2-email.tsx`)

Sent 2 days after trial starts. Highlights key features.

```typescript
import { TrialDay2Email } from '@/components/email-templates/trial-day2-email';

// Props: { userName, daysRemaining, upgradeUrl }
```

### Trial Day 5 Email (`trial-day5-email.tsx`)

Sent 5 days after trial starts. Creates urgency.

```typescript
import { TrialDay5Email } from '@/components/email-templates/trial-day5-email';

// Props: { userName, daysRemaining, upgradeUrl }
```

To grep: `WelcomeEmail`, `TrialDay2Email`, `TrialDay5Email`

---

## Styling Patterns

### Class Merging with `cn()`

All components use `cn()` for conditional class application:

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

To grep: `cn(`, `@/lib/utils`

### CSS Variables for Theming

Use CSS variables for colors, not hardcoded values:

```typescript
// Good
<div className="bg-primary text-primary-foreground">
<div className="bg-muted text-muted-foreground">
<div className="border-border">

// Bad - don't do this
<div className="bg-blue-500">
```

### Icons with Lucide

All icons come from `lucide-react`:

```typescript
import { Search, Plus, Trash, Settings, User } from 'lucide-react';

<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</Button>
```

To grep: `lucide-react`, `className="h-4 w-4"`

---

## Component Rules

1. **Server Components by default** — Only add `"use client"` if component needs interactivity
2. **No app/ imports** — Components should be self-contained
3. **Named exports** — `export { Button }` not `export default Button`
4. **Tailwind only** — No `style={{}}` props
5. **Theme variables** — No hardcoded colors

---

## Creating New Components

Follow the Shadcn pattern:

```typescript
// components/ui/my-component.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const myComponentVariants = cva(
  'base-styles',
  {
    variants: {
      variant: {
        default: 'default-styles',
        secondary: 'secondary-styles',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3',
        lg: 'h-12 px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(myComponentVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
MyComponent.displayName = 'MyComponent';

export { MyComponent, myComponentVariants };
```

---

## Next in Chain

- For feature-specific components, see `app/components/`
- For page layouts, see `app/CLAUDE.md`
