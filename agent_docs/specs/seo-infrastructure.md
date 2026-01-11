# Spec: SEO Infrastructure

## Overview
Fix SEO so "usegemz" appears in Google search results. Currently nothing shows up.

## Canonical Domain
`usegemz.io` (NOT usegems.io or usegems.com)

## Public Pages to Index
| Page | URL | Priority |
|------|-----|----------|
| Homepage (with pricing) | `https://usegemz.io/` | 1.0 |

All other routes (dashboard, campaigns, lists, onboarding, billing, api) should be blocked from indexing.

## Implementation

### 1. Create robots.txt

**File:** `public/robots.txt`

```
# Gemz - Influencer Discovery Platform
# https://usegemz.io

User-agent: *
Allow: /

# Block authenticated/private routes
Disallow: /api/
Disallow: /dashboard/
Disallow: /campaigns/
Disallow: /lists/
Disallow: /onboarding/
Disallow: /billing/
Disallow: /profile/
Disallow: /sign-in/
Disallow: /sign-up/
Disallow: /debug/
Disallow: /admin/

# Sitemap
Sitemap: https://usegemz.io/sitemap.xml
```

### 2. Create Dynamic Sitemap

**File:** `app/sitemap.ts`

```typescript
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://usegemz.io';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
```

This generates `/sitemap.xml` automatically via Next.js.

### 3. Enhanced Metadata in Layout

**File:** `app/layout.tsx`

Update the metadata export:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://usegemz.io'),

  // Primary
  title: {
    default: 'Gemz — AI-Powered Influencer Discovery Platform',
    template: '%s | Gemz',
  },
  description: 'Find and activate high-performing creators across TikTok, Instagram, and YouTube. AI-ranked insights, verified emails, and campaign management in one platform.',

  // Keywords (still used by some search engines)
  keywords: [
    'influencer discovery',
    'influencer marketing platform',
    'find influencers',
    'creator discovery',
    'TikTok influencers',
    'Instagram influencers',
    'YouTube influencers',
    'influencer outreach',
    'creator marketing',
    'influencer database',
  ],

  // Canonical URL
  alternates: {
    canonical: 'https://usegemz.io',
  },

  // Open Graph
  openGraph: {
    title: 'Gemz — Find the Right Influencer, Fast. With AI.',
    description: 'Source verified creators, enrich outreach data, and launch campaigns in minutes.',
    url: 'https://usegemz.io',
    siteName: 'Gemz',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/landing/og-preview.png',
        width: 1200,
        height: 630,
        alt: 'Gemz - AI-Powered Influencer Discovery',
      },
    ],
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Gemz — AI-Powered Influencer Discovery',
    description: 'Find and activate high-performing creators across TikTok, Instagram, and YouTube.',
    images: ['/landing/og-preview.png'],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Verification (placeholder - update when you have Search Console)
  verification: {
    google: 'YOUR_GOOGLE_VERIFICATION_CODE', // Update later
  },
};
```

### 4. Structured Data (JSON-LD)

**File:** `app/layout.tsx` (add to body)

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Gemz',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'AI-powered influencer discovery platform for TikTok, Instagram, and YouTube.',
      url: 'https://usegemz.io',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '99',
        highPrice: '499',
        priceCurrency: 'USD',
        offerCount: '3',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '50',
      },
    }),
  }}
/>
```

### 5. Fix Domain Consistency

**File:** `app/layout.tsx`

Update Clerk appearance config:
```typescript
const clerkAppearance: Appearance = {
  layout: {
    helpPageUrl: 'mailto:support@usegemz.io',  // Changed from usegems.com
    privacyPageUrl: 'https://usegemz.io/privacy',  // Changed
    termsPageUrl: 'https://usegemz.io/terms',  // Changed
  },
  // ... rest unchanged
};
```

### 6. OG Image Optimization

Ensure `/public/landing/og-preview.png` exists and is:
- 1200x630 pixels (Facebook/LinkedIn optimal)
- Under 5MB
- Contains: Logo, tagline, visual of product

## Post-Deployment Steps

1. **Submit to Google Search Console:**
   - Go to https://search.google.com/search-console
   - Add property: `https://usegemz.io`
   - Verify via HTML tag (add meta tag to layout)
   - Submit sitemap: `https://usegemz.io/sitemap.xml`

2. **Request Indexing:**
   - In Search Console, use URL Inspection
   - Enter `https://usegemz.io`
   - Click "Request Indexing"

3. **Monitor:**
   - Check Coverage report for errors
   - Check Core Web Vitals

## Success Criteria

- [ ] `robots.txt` accessible at `https://usegemz.io/robots.txt`
- [ ] `sitemap.xml` accessible at `https://usegemz.io/sitemap.xml`
- [ ] OG tags render correctly (test with https://developers.facebook.com/tools/debug/)
- [ ] Structured data valid (test with https://search.google.com/test/rich-results)
- [ ] Google Search Console shows site as indexed
- [ ] "usegemz" search shows the site (may take 1-2 weeks)
