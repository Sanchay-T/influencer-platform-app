# 🎨 Frontend Documentation

## Overview
The usegemz frontend is built with Next.js 15.2.3, TypeScript, and shadcn/ui components. This section covers all frontend aspects including UI design, user flows, and component architecture.

## 📁 Frontend Documentation Index

### 🗺️ [URL Mapping](./url-mapping.md)
Complete URL structure and route organization with ASCII diagrams showing navigation paths.

### 🎨 [Design System](./design-system.md)
Component library, styling patterns, and design aesthetics used throughout the platform.

### 👤 [User Flow](./user-flow.md)
Step-by-step user journey from sign-up to campaign results with detailed flow diagrams.

### 🔍 [Search Interfaces](./search-ui.md)
Detailed breakdown of keyword and similar search interfaces with component details.

### ⚡ [Real-time Features](./real-time-features.md)
Progress bars, live updates, polling mechanisms, and reactive UI components.

### 📱 [Components Reference](./components-reference.md)
Comprehensive component library with props, class names, and usage examples.

## 🏗️ Frontend Architecture

```
app/                          # Next.js App Router
├── (auth)/                   # Auth routes group
│   ├── sign-in/             # Clerk sign-in
│   └── sign-up/             # Clerk sign-up
├── campaigns/               # Campaign management
│   ├── new/                 # Campaign creation
│   ├── search/              # Search interfaces
│   └── [id]/                # Individual campaigns
├── onboarding/              # User onboarding flow
├── profile/                 # User profile
├── admin/                   # Admin-only pages
└── components/              # Shared components
    ├── layout/              # Layout components
    ├── campaigns/           # Campaign-specific
    ├── onboarding/          # Onboarding components
    └── ui/                  # shadcn/ui components
```

## 🎯 Key Frontend Features

### Design System
- **UI Library**: shadcn/ui components
- **Styling**: Tailwind CSS with custom design tokens
- **Icons**: Lucide React icon library
- **Typography**: System fonts with consistent hierarchy
- **Colors**: Blue/gray theme with semantic color usage

### State Management
- **React State**: useState, useEffect for local state
- **Custom Hooks**: useAdmin, useTrialCountdown for specialized logic
- **Session Storage**: Campaign data persistence
- **Real-time Updates**: Polling for job status updates

### Navigation Structure
- **App Router**: Next.js 13+ file-based routing
- **Protected Routes**: Clerk middleware for authentication
- **Admin Routes**: Additional admin verification layer
- **Public Routes**: Sign-in, sign-up, landing page

### Responsive Design
- **Mobile-First**: Tailwind responsive classes
- **Breakpoints**: sm, md, lg, xl breakpoints
- **Component Adaptation**: Cards and tables adapt to screen size
- **Touch-Friendly**: Appropriate touch targets and spacing

## 🔧 Technical Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| Next.js | React framework | 15.2.3 |
| TypeScript | Type safety | Latest |
| Tailwind CSS | Styling | Latest |
| shadcn/ui | Component library | Latest |
| Lucide React | Icons | Latest |
| React Hot Toast | Notifications | Latest |
| Clerk | Authentication UI | Latest |

## 📱 Component Patterns

### Card-Based Layout
Most interfaces use consistent card layouts with:
- `Card`, `CardHeader`, `CardContent` structure
- Consistent padding and spacing
- Shadow and border styling
- Responsive grid layouts

### Form Patterns
- Input validation with error states
- Loading states during submission
- Success/error toast notifications
- Accessibility-compliant form labels

### Data Display
- Table components for results
- Progress bars for job status
- Avatar components for profile images
- Badge components for status indicators

### Interactive Elements
- Consistent button styling and states
- Checkbox and radio button patterns
- Dropdown and select components
- Modal and dialog patterns

## 🎨 Design Philosophy

### Consistency
- Uniform spacing using Tailwind's spacing scale
- Consistent typography hierarchy
- Standard color palette across components
- Predictable interaction patterns

### Accessibility
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Color contrast compliance

### Performance
- Code splitting at route level
- Lazy loading for heavy components
- Optimized image handling
- Minimal bundle size

### User Experience
- Clear visual hierarchy
- Immediate feedback for actions
- Intuitive navigation patterns
- Responsive and fast interactions

---

**Next**: Start with [URL Mapping](./url-mapping.md) to understand the complete navigation structure.