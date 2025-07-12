# 🎨 Design System & Component Architecture

## Overview
The usegemz platform uses a modern design system built on shadcn/ui components with Tailwind CSS. This document covers the complete design system including components, styling patterns, theming, and design philosophies.

## 🏗️ Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **shadcn/ui** | Component library foundation | Latest |
| **Tailwind CSS** | Utility-first CSS framework | Latest |
| **Radix UI** | Headless component primitives | Latest |
| **Class Variance Authority (CVA)** | Component variant management | Latest |
| **Tailwindcss-animate** | Animation utilities | Latest |
| **Lucide React** | Icon library | Latest |

## 🎯 Design Philosophy

### Consistency
- **Semantic color system** using HSL CSS custom properties
- **Unified spacing scale** using Tailwind's spacing tokens
- **Typography hierarchy** with consistent font sizes and weights
- **Component composition** following shadcn/ui patterns

### Accessibility
- **Keyboard navigation** support in all interactive components
- **Screen reader compatibility** with proper ARIA labels
- **Color contrast** compliance with WCAG guidelines
- **Focus management** with visible focus indicators

### Performance
- **CSS-in-JS free** approach for better performance
- **Tailwind purging** removes unused styles
- **Component code splitting** at route level
- **Optimized bundle sizes** with minimal component overhead

## 🎨 Color System

### Design Tokens
**File**: `app/globals.css`

```css
:root {
  /* Base colors */
  --background: 0 0% 100%;        /* Pure white */
  --foreground: 0 0% 3.9%;        /* Near black text */
  
  /* Component colors */
  --card: 0 0% 100%;              /* Card backgrounds */
  --card-foreground: 0 0% 3.9%;   /* Card text */
  
  /* Interactive colors */
  --primary: 0 0% 9%;             /* Primary buttons, links */
  --primary-foreground: 0 0% 98%; /* Primary button text */
  
  /* Secondary colors */
  --secondary: 0 0% 96.1%;        /* Secondary backgrounds */
  --secondary-foreground: 0 0% 9%; /* Secondary text */
  
  /* Muted colors */
  --muted: 0 0% 96.1%;           /* Disabled states */
  --muted-foreground: 0 0% 45.1%; /* Subtle text */
  
  /* Border & input */
  --border: 0 0% 89.8%;          /* Component borders */
  --input: 0 0% 89.8%;           /* Input borders */
  
  /* States */
  --destructive: 0 84.2% 60.2%;  /* Error/danger states */
  --ring: 0 0% 3.9%;             /* Focus ring color */
  
  /* Border radius */
  --radius: 0.5rem;              /* 8px base radius */
}
```

### Color Usage Patterns

```typescript
// Semantic color usage
<Button variant="default">        // Primary action
<Button variant="secondary">      // Secondary action  
<Button variant="outline">        // Subtle action
<Button variant="destructive">    // Danger action
<Button variant="ghost">          // Minimal action

// Text hierarchy
<h1 className="text-foreground">         // Primary text
<p className="text-muted-foreground">    // Secondary text
<span className="text-destructive">      // Error text
```

### Dark Mode Support
```css
.dark {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  /* ... inverted color scheme */
}
```

## 📱 Component Library

### 🔘 Button Component
**File**: `components/ui/button.tsx`

#### Variants
```typescript
// Button variants with CVA
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    }
  }
)
```

#### Usage Examples
```jsx
// Primary action
<Button>Create Campaign</Button>

// Secondary action with icon
<Button variant="outline">
  <PlusCircle className="mr-2" />
  Add Item
</Button>

// Loading state
<Button disabled={isLoading}>
  {isLoading ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Save className="mr-2 h-4 w-4" />
  )}
  Save Changes
</Button>
```

### 🃏 Card Component
**File**: `components/ui/card.tsx`

#### Structure
```jsx
<Card className="max-w-lg mx-auto">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Footer actions */}
  </CardFooter>
</Card>
```

#### CSS Classes
```css
Card:          "rounded-lg border bg-card text-card-foreground shadow-sm"
CardHeader:    "flex flex-col space-y-1.5 p-6"
CardTitle:     "text-2xl font-semibold leading-none tracking-tight"
CardDescription: "text-sm text-muted-foreground"
CardContent:   "p-6 pt-0"
CardFooter:    "flex items-center p-6 pt-0"
```

### 📊 Progress Component
**File**: `components/ui/progress.tsx`

#### Implementation
```jsx
<Progress 
  value={progressPercentage} 
  className="h-2 w-full"
/>

// Custom styling
<Progress 
  value={75} 
  className="h-3 bg-blue-100"
/>
```

#### CSS Structure
```css
Root:      "relative h-4 w-full overflow-hidden rounded-full bg-secondary"
Indicator: "h-full w-full flex-1 bg-primary transition-all"
```

### 📝 Input Component
**File**: `components/ui/input.tsx`

#### Base Classes
```css
"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
```

#### Usage Patterns
```jsx
// Basic input
<Input 
  placeholder="Enter username..."
  value={username}
  onChange={(e) => setUsername(e.target.value)}
/>

// With validation
<Input 
  type="email"
  placeholder="email@example.com"
  className={error ? "border-destructive" : ""}
  disabled={isLoading}
/>
```

## 🎭 Component Patterns

### Form Layouts
```jsx
// Standard form pattern
<form onSubmit={handleSubmit} className="space-y-6">
  <div className="space-y-4">
    <label className="text-sm font-medium">Field Label</label>
    <Input placeholder="Enter value..." />
    {error && (
      <p className="text-sm text-destructive">{error}</p>
    )}
  </div>
  
  <Button type="submit" className="w-full" disabled={isLoading}>
    {isLoading ? 'Processing...' : 'Submit'}
  </Button>
</form>
```

### Grid Layouts
```jsx
// Responsive card grid
<div className="grid gap-6 lg:grid-cols-2">
  <Card>...</Card>
  <Card>...</Card>
</div>

// Three-column layout
<div className="grid gap-4 md:grid-cols-3">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>
```

### Loading States
```jsx
// Button loading
<Button disabled={isLoading}>
  {isLoading ? (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      Loading...
    </div>
  ) : 'Submit'}
</Button>

// Page loading
<div className="flex justify-center items-center min-h-[400px]">
  <div className="text-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
    <p>Loading...</p>
  </div>
</div>
```

## 🎨 Styling Conventions

### Spacing Scale
```css
/* Tailwind spacing scale used consistently */
space-y-1    /* 4px vertical spacing */
space-y-2    /* 8px vertical spacing */
space-y-4    /* 16px vertical spacing */
space-y-6    /* 24px vertical spacing */
space-y-8    /* 32px vertical spacing */

gap-2        /* 8px gap in flex/grid */
gap-4        /* 16px gap in flex/grid */
gap-6        /* 24px gap in flex/grid */

p-4          /* 16px padding all sides */
p-6          /* 24px padding all sides */
px-3         /* 12px horizontal padding */
py-2         /* 8px vertical padding */
```

### Typography Hierarchy
```css
/* Heading hierarchy */
text-3xl font-bold           /* Page titles */
text-2xl font-semibold       /* Card titles */
text-lg font-semibold        /* Section headings */
text-base font-medium        /* Subheadings */

/* Body text */
text-sm                      /* Small text, captions */
text-base                    /* Body text */
text-muted-foreground        /* Secondary text */

/* Interactive text */
text-blue-600 hover:underline   /* Links */
text-destructive                /* Error text */
```

### Border Radius
```css
rounded-sm      /* 2px - subtle rounding */
rounded-md      /* 6px - standard rounding */
rounded-lg      /* 8px - card rounding */
rounded-full    /* Full circle - buttons, badges */
```

## 🎯 Real-World Usage Examples

### Campaign Form Pattern
```jsx
<Card className="max-w-lg mx-auto">
  <CardHeader>
    <CardTitle>Create a Campaign</CardTitle>
    <CardDescription>
      Set up your influencer search campaign
    </CardDescription>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Campaign Name</label>
        <Input 
          placeholder="e.g., Summer Fashion Campaign"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      
      <Button type="submit" className="w-full">
        Continue
      </Button>
    </form>
  </CardContent>
</Card>
```

### Search Results Table Pattern
```jsx
<Card>
  <CardHeader>
    <CardTitle className="flex justify-between items-center">
      Results ({resultsCount})
      <Button variant="outline" size="sm">
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
    </CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Profile</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Followers</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((creator) => (
          <TableRow key={creator.id}>
            <TableCell>
              <Avatar>
                <AvatarImage src={creator.avatar} />
                <AvatarFallback>{creator.name[0]}</AvatarFallback>
              </Avatar>
            </TableCell>
            <TableCell className="font-medium">
              {creator.name}
            </TableCell>
            <TableCell>
              {creator.followers.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### Progress Tracking Pattern
```jsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Searching TikTok...
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-sm text-muted-foreground">
        Found {resultsCount} creators so far...
      </p>
    </div>
  </CardContent>
</Card>
```

## 📐 Layout Patterns

### Dashboard Layout
```jsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div className="flex justify-between items-center mb-8">
    <h1 className="text-3xl font-bold">Page Title</h1>
    <Button>Primary Action</Button>
  </div>
  
  <div className="grid gap-6 lg:grid-cols-2">
    <Card>...</Card>
    <Card>...</Card>
  </div>
</div>
```

### Form Layout
```jsx
<div className="max-w-4xl mx-auto py-8">
  <Card>
    <CardHeader>
      <CardTitle>Form Title</CardTitle>
    </CardHeader>
    <CardContent>
      <form className="space-y-6">
        {/* Form fields */}
      </form>
    </CardContent>
  </Card>
</div>
```

### Modal/Overlay Pattern
```jsx
<div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
  <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <Card>
      <CardHeader>
        <CardTitle>Modal Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Modal content */}
      </CardContent>
    </Card>
  </div>
</div>
```

## 🎨 Icon Usage

### Lucide React Icons
```jsx
import { 
  PlusCircle,
  Download, 
  Loader2,
  Search,
  User,
  Settings 
} from "lucide-react";

// Standard icon sizing
<PlusCircle className="h-4 w-4" />     // Small icons
<Search className="h-5 w-5" />         // Medium icons
<User className="h-6 w-6" />           // Large icons

// Icon with text
<Button>
  <PlusCircle className="mr-2 h-4 w-4" />
  Create Campaign
</Button>
```

## 🔧 Customization Patterns

### Component Variants
```jsx
// Custom button variant
<Button className="bg-blue-600 hover:bg-blue-700 text-white">
  Custom Blue Button
</Button>

// Custom card styling
<Card className="border-blue-200 bg-blue-50">
  <CardHeader>
    <CardTitle className="text-blue-800">
      Custom Card
    </CardTitle>
  </CardHeader>
</Card>
```

### Responsive Design
```jsx
// Mobile-first responsive design
<div className="w-full max-w-md sm:max-w-lg lg:max-w-2xl">
  <Card className="shadow-sm sm:shadow-md lg:shadow-lg">
    <CardContent className="p-4 sm:p-6">
      {/* Responsive padding */}
    </CardContent>
  </Card>
</div>

// Responsive grid
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Responsive columns */}
</div>
```

## 🎯 Design Tokens Reference

### Component Sizing
```css
h-8    /* 32px height - small elements */
h-10   /* 40px height - buttons, inputs */
h-12   /* 48px height - large buttons */
h-16   /* 64px height - large elements */

w-64   /* 256px width - sidebar */
w-full /* 100% width - full width elements */
```

### Shadows
```css
shadow-sm    /* Subtle shadow */
shadow-md    /* Medium shadow - cards */
shadow-lg    /* Large shadow - modals */
shadow-xl    /* Extra large shadow - floating elements */
```

### Transitions
```css
transition-colors    /* Color transitions */
transition-all      /* All property transitions */
duration-200        /* 200ms duration */
ease-in-out         /* Easing function */
```

---

**Next**: Continue with [User Flow](./user-flow.md) to understand the complete user journey and interaction patterns.