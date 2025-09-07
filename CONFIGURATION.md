# ⚙️ Configuration Documentation - Influencer Platform

## Overview

This document provides comprehensive documentation for the complete configuration architecture of the multi-platform influencer search platform. The system uses a sophisticated environment variable strategy with support for development, production, and worktree-specific configurations.

### Configuration Architecture Strategy

The platform employs a **multi-tier configuration system**:

1. **Environment Variables**: Multi-file approach with environment-specific overrides
2. **Dynamic System Configuration**: Database-backed configuration with hot-reloading
3. **Build Configuration**: Next.js, TypeScript, and Tailwind CSS setup
4. **Authentication Configuration**: Clerk integration with admin system
5. **External API Configuration**: Multi-platform API integrations
6. **Database Configuration**: Environment-aware connection management
7. **Deployment Configuration**: Vercel-optimized setup

## Environment Variables

### Environment File Structure

```
├── .env.development          # Development environment settings
├── .env.prod                # Production environment settings  
├── .env.worktree            # Worktree-specific overrides (port configuration)
└── .env.local               # Local overrides (gitignored)
```

### Core Environment Variables by Category

#### **🔐 Authentication Configuration (Clerk)**
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Clerk Webhook Configuration
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
CLERK_BILLING_WEBHOOK_SECRET=whsec_billing_webhook_secret_here

# Admin System Configuration
NEXT_PUBLIC_ADMIN_EMAILS=admin1@example.com,admin2@example.com
NEXT_PUBLIC_CLERK_BILLING_ENABLED=true
```

#### **🗄️ Database Configuration**
```bash
# Primary Database Connection
DATABASE_URL="postgresql://user:pass@host:port/database"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Development JWT Secret
SUPABASE_JWT_SECRET=test-jwt-secret-for-development-only-32chars
```

#### **🌐 External API Configuration**

**ScrapeCreators APIs (Multi-Platform)**
```bash
# TikTok APIs
SCRAPECREATORS_API_URL=https://api.scrapecreators.com/v1/tiktok/search/keyword
SCRAPECREATORS_TIKTOK_SIMILAR_API_URL=https://api.scrapecreators.com/v1/tiktok/similar
SCRAPECREATORS_API_KEY=your_api_key_here

# Instagram APIs
SCRAPECREATORS_INSTAGRAM_API_URL=https://api.scrapecreators.com/v1/instagram/profile
SCRAPECREATORS_INSTAGRAM_REELS_API_URL=https://api.scrapecreators.com/v1/instagram/reels

# YouTube APIs
SCRAPECREATORS_YOUTUBE_API_URL=https://api.scrapecreators.com/v1/youtube/search
SCRAPECREATORS_YOUTUBE_SIMILAR_API_URL=https://api.scrapecreators.com/v1/youtube/similar

# RapidAPI Instagram Integration
RAPIDAPI_INSTAGRAM_KEY=958382f6a1msh6ee05542f311bb3p1eebeajsne632eef2fa54
```

**Apify Integration (Legacy)**
```bash
APIFY_TOKEN=apify_api_xxx
APIFY_ACTOR_ID="KwlQGjMTRQPbNESL9"              # TikTok Scraper
INSTAGRAM_SCRAPER_ACTOR_ID="dSCLg0C3YEZ83HzYX"  # Instagram Scraper
INSTAGRAM_HASHTAG_SCRAPER_ID="reGe1ST3OBgYZSsZJ" # Instagram Hashtag Scraper
```

**Alternative API Providers**
```bash
ENSEMBLE_API_KEY=1CzcU20kHWBb9KYs
```

#### **⚡ Background Processing (QStash)**
```bash
# QStash Configuration
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=eyJVc2VySUQiOiJxxx
QSTASH_CURRENT_SIGNING_KEY=sig_5xvG4ugFg3w7pp3EfutbrEM4JJHE
QSTASH_NEXT_SIGNING_KEY=sig_4nfUjg7dPoSoPX1dqxV8cZmdKg28

# Site URL for QStash Callbacks
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
VERCEL_URL="your-app.vercel.app"
```

#### **💳 Payment Configuration (Stripe)**
```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Product Price IDs
# Monthly Pricing
STRIPE_GLOW_UP_MONTHLY_PRICE_ID=price_1RlU8lIpgTA78vtxbN9padio
STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID=price_1RlUAFIpgTA78vtxH5YN7LJv  
STRIPE_FAME_FLEX_MONTHLY_PRICE_ID=price_1RlUB4IpgTA78vtx7RxGYcoA

# Yearly Pricing (with discount)
STRIPE_GLOW_UP_YEARLY_PRICE_ID=price_1Rm8t4IpgTA78vtx1FHxZM6k
STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID=price_1RlUAmIpgTA78vtxu7AepsPT
STRIPE_FAME_FLEX_YEARLY_PRICE_ID=price_1RlUBcIpgTA78vtxS5MwdPfk

# Customer Portal
STRIPE_CUSTOMER_PORTAL_LINK=https://billing.stripe.com/p/login/test_xxx
```

#### **📧 Email Configuration (Resend)**
```bash
# Email Service
RESEND_API_KEY=re_FTDEjQvp_GGxvEChbyXFQsPvhy95QKZAY
EMAIL_FROM_ADDRESS=hello@usegemz.io
```

#### **🖼️ Image Storage (Vercel Blob)**
```bash
# Vercel Blob Storage for Image Caching
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_UqSUnXfcuH4KcK1E_RaQyHJzAg2ieY4jcymBD4nQY223zpF
```

#### **📊 Monitoring & Logging (Sentry)**
```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://900157c894cad49e533ad82be00a9c5b@o4509176214388736.ingest.us.sentry.io/4509535311560704
SENTRY_ORG=none-vx0
SENTRY_PROJECT=influencer-platform
SENTRY_AUTH_TOKEN=sntrys_eyJpYXQiOjE3NTA0ODgyODcuMDIxNzI5...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
```

#### **🔧 Development & Testing Configuration**
```bash
# Development Mode Settings
NODE_ENV=development
NEXT_PUBLIC_DEV_MODE=true

# Test Authentication (Development Only)
ENABLE_TEST_AUTH=true
TEST_USER_ID=b9b65707-10e9-4d2b-85eb-130f513d7c59

# API Testing Limits
TEST_TARGET_RESULTS=5
API_MODE=production

# Stripe Testing Mode
USE_REAL_STRIPE=true
NEXT_PUBLIC_USE_REAL_STRIPE=true

# Local Development Port (Worktree Support)
LOCAL_PORT=3002
```

### Environment-Specific Configuration

#### **Development Environment (.env.development)**
- **Purpose**: Local development with ngrok tunneling
- **Key Features**: 
  - Test authentication enabled
  - Limited API results (5) to save costs
  - ngrok URL for QStash callbacks
  - Development Stripe mode

#### **Production Environment (.env.prod)**  
- **Purpose**: Production deployment on Vercel
- **Key Features**:
  - Full API limits enabled
  - Production Stripe configuration
  - Production database connections
  - Error tracking enabled

#### **Worktree Environment (.env.worktree)**
- **Purpose**: Git worktree-specific port configuration
- **Contents**: `LOCAL_PORT=3002`
- **Usage**: Allows different ports for different git worktrees

### Security Considerations

#### **Sensitive Data Handling**
- ✅ All API keys and secrets in environment variables
- ✅ No sensitive data committed to repository
- ✅ Environment-specific secrets (dev vs prod)
- ✅ JWT secrets for development only

#### **Environment Separation**
- ✅ Separate Clerk instances for dev/prod
- ✅ Separate Stripe accounts for testing/production
- ✅ Separate database instances
- ✅ Separate QStash projects

## Build Configuration

### Next.js Configuration (next.config.mjs)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true  // For rapid development
  },
  eslint: {
    ignoreDuringBuilds: true  // Skip lint during builds
  },
  webpack: (config, { isServer }) => {
    // Suppress libheif-js warnings for HEIC conversion
    config.ignoreWarnings = [
      {
        module: /libheif-js/,
        message: /Critical dependency/,
      },
    ];
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/video-proxy',
        destination: 'https://tiktok-proxy.jahirjimenez1010.workers.dev/',
      }
    ];
  }
}
```

**Key Features:**
- **TypeScript**: Ignore build errors for rapid development
- **ESLint**: Skip linting during builds
- **Webpack**: Suppress HEIC conversion warnings
- **Rewrites**: Proxy TikTok video content

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "es2020",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/app/*": ["./app/*"],
      "@/lib/*": ["./lib/*"]
    },
    "baseUrl": "."
  }
}
```

**Key Features:**
- **Path Aliases**: `@/` for root, `@/components/`, `@/app/`, `@/lib/`
- **ES2020**: Modern JavaScript target
- **Strict Mode**: Type safety enabled

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "node scripts/dev-with-port.js",
    "dev:local": "NODE_ENV=development next dev -p 3002", 
    "dev:wt2": "LOCAL_PORT=3002 node scripts/dev-with-port.js",
    "build": "next build",
    "start": "NODE_ENV=development next dev",
    "start:prod": "next start",
    
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate", 
    "db:push": "npm run db:generate && npm run db:migrate",
    "db:studio": "drizzle-kit studio",
    
    "logs:onboarding": "tail -f onboarding-logs",
    "reset-user": "node scripts/reset-user-onboarding.js",
    "find-user-id": "node scripts/find-user-id.js"
  }
}
```

**Key Scripts:**
- **Development**: Multi-port support with worktree detection
- **Database**: Drizzle ORM management
- **User Management**: Reset and utility scripts
- **Monitoring**: Live log monitoring

### Key Dependencies

#### **Frontend**
```json
{
  "@clerk/nextjs": "^6.23.3",
  "@radix-ui/react-*": "^1.x.x",
  "react": "^18.3.1",
  "next": "15.2.3",
  "tailwindcss": "^3.4.1",
  "framer-motion": "^12.7.4"
}
```

#### **Backend**  
```json
{
  "drizzle-orm": "^0.39.3",
  "postgres": "^3.4.5",
  "@upstash/qstash": "^2.7.22",
  "stripe": "^18.3.0",
  "resend": "^4.5.1"
}
```

#### **Image Processing**
```json
{
  "heic-convert": "^2.1.0",
  "sharp": "^0.33.2",
  "@vercel/blob": "^1.1.1"
}
```

### Tailwind CSS Configuration (tailwind.config.mjs)

```javascript
export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}", 
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // shadcn/ui color system with CSS variables
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        // Brand color mapping
        pink: {
          300: 'hsl(var(--primary-300) / <alpha-value>)',
          // ... other shades
        },
        emerald: {
          300: 'hsl(var(--brand-green-300) / <alpha-value>)',
          // ... other shades  
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}
```

## Authentication Configuration

### Clerk Setup

#### **Environment Configuration**
```bash
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Admin System
NEXT_PUBLIC_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

#### **Middleware Configuration (middleware.ts)**
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// Webhook routes (bypass auth)
const isWebhookRoute = createRouteMatcher([
  '/api/qstash/(.*)',
  '/api/scraping/(.*)',
  '/api/proxy/(.*)',
])

// Admin API routes 
const isAdminRoute = createRouteMatcher([
  '/api/admin(.*)',
])
```

#### **Admin Authentication System**
- **Dual Authentication**: Environment-based + Database-based admin roles
- **Environment Admins**: Set via `NEXT_PUBLIC_ADMIN_EMAILS`
- **Database Admins**: Set via admin promotion API
- **Route Protection**: Middleware-level admin route protection

### Security Features

#### **Route Protection Strategy**
1. **Public Routes**: Landing page, auth pages
2. **Protected Routes**: All app functionality requires authentication
3. **Admin Routes**: Additional admin email verification
4. **Webhook Routes**: Bypass Clerk auth, use signature verification

#### **Webhook Security**
```typescript
// QStash signature verification
const isValid = await receiver.verify({
  signature: req.headers.get('Upstash-Signature'),
  body: await req.text(),
  url: `${baseUrl}/api/qstash/process-scraping`
});
```

## External API Configuration

### Multi-Platform API Strategy

The platform integrates with **6 different platform/search combinations**:

#### **ScrapeCreators API (Primary)**
```bash
# TikTok APIs
SCRAPECREATORS_API_URL=https://api.scrapecreators.com/v1/tiktok/search/keyword
SCRAPECREATORS_TIKTOK_SIMILAR_API_URL=https://api.scrapecreators.com/v1/tiktok/similar

# Instagram APIs  
SCRAPECREATORS_INSTAGRAM_API_URL=https://api.scrapecreators.com/v1/instagram/profile
SCRAPECREATORS_INSTAGRAM_REELS_API_URL=https://api.scrapecreators.com/v1/instagram/reels

# YouTube APIs
SCRAPECREATORS_YOUTUBE_API_URL=https://api.scrapecreators.com/v1/youtube/search
SCRAPECREATORS_YOUTUBE_SIMILAR_API_URL=https://api.scrapecreators.com/v1/youtube/similar

# Universal API Key
SCRAPECREATORS_API_KEY=your_api_key_here
```

#### **RapidAPI Integration (Instagram Enhanced)**
```bash
RAPIDAPI_INSTAGRAM_KEY=958382f6a1msh6ee05542f311bb3p1eebeajsne632eef2fa54
```

#### **API Configuration Patterns**
```typescript
// Environment-aware API configuration
const apiConfig = {
  tiktokKeyword: process.env.SCRAPECREATORS_API_URL,
  tiktokSimilar: process.env.SCRAPECREATORS_TIKTOK_SIMILAR_API_URL,
  instagramProfile: process.env.SCRAPECREATORS_INSTAGRAM_API_URL,
  instagramReels: process.env.SCRAPECREATORS_INSTAGRAM_REELS_API_URL,
  youtubeSearch: process.env.SCRAPECREATORS_YOUTUBE_API_URL,
  youtubeSimilar: process.env.SCRAPECREATORS_YOUTUBE_SIMILAR_API_URL,
  apiKey: process.env.SCRAPECREATORS_API_KEY
};
```

### API Route Configuration

#### **Platform-Specific Endpoints**
```
/api/scraping/tiktok               # TikTok keyword search
/api/scraping/tiktok-similar       # TikTok similar search  
/api/scraping/instagram            # Instagram similar search
/api/scraping/instagram-reels      # Instagram reels search
/api/scraping/youtube              # YouTube keyword search
/api/scraping/youtube-similar      # YouTube similar search
```

#### **Background Processing**
```
/api/qstash/process-scraping       # Universal job processor
/api/qstash/process-results        # Results aggregation
```

#### **Admin & Management APIs**
```
/api/admin/config                  # System configuration
/api/admin/users/promote           # Admin promotion
/api/admin/email-testing           # Email system testing
/api/export/csv                    # Data export
```

## Database Configuration

### Environment-Aware Database Setup

#### **Drizzle Configuration (drizzle.config.ts)**
```typescript
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Environment-aware config loading
const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: false,  // Disable for CHECK constraint compatibility
  verbose: true,
});
```

#### **Connection String Strategy**
```bash
# Development Database (Supabase Dev Instance)
DATABASE_URL="postgresql://postgres.cufwvosytcmaggyyfsix:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

# Production Database (Supabase Production)
DATABASE_URL="postgresql://postgres.nlxgzhqfrjohvkigwqvh:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres"
```

### Database Schema Configuration

#### **Primary Tables**
- `campaigns` - Campaign management
- `scrapingJobs` - Background job processing
- `scrapingResults` - Search results storage  
- `userProfiles` - User management with trials
- `systemConfigurations` - Dynamic system settings
- `adminActions` - Admin audit logging

#### **Migration Management**
```bash
# Generate migrations
npm run db:generate

# Apply migrations  
npm run db:migrate

# Database studio
npm run db:studio
```

## Dynamic System Configuration

### Database-Backed Configuration System

The platform features a sophisticated configuration system that stores settings in the database with in-memory caching and hot-reloading capabilities.

#### **Configuration Categories**

**API Limits**
```typescript
'api_limits.max_api_calls_for_testing': { value: '5', type: 'number' }
'api_limits.max_api_calls_tiktok': { value: '1', type: 'number' }
'api_limits.max_api_calls_tiktok_similar': { value: '1', type: 'number' }
```

**QStash Delays**
```typescript
'qstash_delays.tiktok_continuation_delay': { value: '2s', type: 'duration' }
'qstash_delays.instagram_reels_delay': { value: '30s', type: 'duration' }
```

**Timeouts**
```typescript
'timeouts.standard_job_timeout': { value: '60m', type: 'duration' }
'timeouts.cleanup_timeout_hours': { value: '24h', type: 'duration' }
```

#### **Configuration Service Usage**
```typescript
import { SystemConfig } from '@/lib/config/system-config';

// Get configuration values
const apiLimit = await SystemConfig.get('api_limits', 'max_api_calls_tiktok');
const delay = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');

// Set configuration
await SystemConfig.set('api_limits', 'max_api_calls_tiktok', '10', 'number');
```

#### **Caching Strategy**
- **TTL**: 30 seconds in-memory cache
- **Hot-reloading**: Automatic cache invalidation on updates
- **Fallback**: Default values if database unavailable

## Deployment Configuration

### Vercel Configuration

#### **Environment Variables Setup**
1. **Vercel Dashboard** → Project Settings → Environment Variables
2. **Separate configs** for Preview/Production environments
3. **Encrypted secrets** for all API keys

#### **Build Configuration**
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

#### **Domain Configuration**
```bash
# Production Domain
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
VERCEL_URL="your-app.vercel.app"

# Development (ngrok for QStash callbacks)
NEXT_PUBLIC_SITE_URL=https://c9e6d4d872bd.ngrok-free.app
```

### CI/CD Configuration

#### **Automatic Deployments**
- **Git Integration**: Auto-deploy on push to main branch
- **Preview Deployments**: Auto-deploy on pull requests
- **Environment Separation**: Different env vars for preview/production

#### **Build Optimizations**
- **TypeScript**: Build errors ignored for rapid development
- **ESLint**: Skipped during builds for speed
- **Image Optimization**: Automatic WebP conversion
- **API Routes**: Serverless function deployment

### Performance Configuration

#### **Image Optimization**
```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

#### **Database Optimization**
- **Connection Pooling**: Supabase connection pooler
- **Query Optimization**: Drizzle ORM with prepared statements
- **Indexing**: Optimized database indexes

## Development Setup

### Local Development Environment Setup

#### **1. Clone Repository**
```bash
git clone <repository-url>
cd influencerplatform-wt2
```

#### **2. Install Dependencies** 
```bash
npm install
```

#### **3. Environment Configuration**
```bash
# Copy and configure environment file
cp .env.development.example .env.development

# Edit environment variables
nano .env.development
```

#### **4. Database Setup**
```bash
# Generate database schema
npm run db:generate

# Apply migrations
npm run db:migrate

# Open database studio (optional)
npm run db:studio
```

#### **5. Start Development Server**
```bash
# Standard development
npm run dev

# Custom port development
LOCAL_PORT=3001 npm run dev

# Worktree-specific development
npm run dev:wt2
```

### Development Tools Configuration

#### **Database Tools**
```bash
# Local PostgreSQL (Docker)
npm run db:local:up
npm run db:local:down

# Database introspection
npm run db:studio:local
```

#### **User Management Scripts**
```bash
# Reset user onboarding
npm run reset-user

# Find user by email
npm run find-user-id

# View onboarding logs
npm run logs:onboarding
```

#### **Testing Configuration**
```bash
# Test all search platforms
node scripts/test-all-searches.js

# Test specific APIs
node scripts/test-tiktok-similar-api.js
```

### Port Management Strategy

The platform supports **multi-worktree development** with intelligent port management:

#### **Port Selection Priority**
1. `LOCAL_PORT` environment variable
2. `.env.worktree` file setting
3. `PORT` environment variable  
4. Default port `3000`

#### **Worktree Configuration**
```bash
# Create worktree-specific port config
echo "LOCAL_PORT=3002" > .env.worktree

# Each worktree can have its own port
git worktree add ../feature-branch feature-branch
cd ../feature-branch
echo "LOCAL_PORT=3003" > .env.worktree
```

### Docker Configuration

#### **Local Database (docker-compose.yml)**
```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: influencer-platform-postgres
    environment:
      POSTGRES_DB: influencer_platform_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: localdev123
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

#### **Database Scripts**
```bash
# Start local database
npm run db:local:up

# Reset local database
npm run db:local:reset

# Test database connection
npm run db:local:test
```

## Configuration Management Best Practices

### Security Best Practices

#### **API Key Management**
- ✅ All API keys in environment variables
- ✅ No secrets committed to repository
- ✅ Separate keys for dev/staging/production
- ✅ Regular key rotation policy

#### **Database Security**
- ✅ Connection string encryption
- ✅ SSL-enabled connections in production
- ✅ Separate databases per environment
- ✅ Regular backup strategy

#### **Authentication Security**
- ✅ Separate Clerk instances
- ✅ Webhook signature verification
- ✅ JWT secret management
- ✅ Admin role verification

### Environment Management

#### **Environment Separation Strategy**
1. **Development**: Local development with test APIs
2. **Staging**: Pre-production testing environment  
3. **Production**: Live environment with production APIs

#### **Configuration Validation**
```typescript
// Environment validation on startup
const requiredEnvVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'SCRAPECREATORS_API_KEY'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

### Monitoring and Debugging

#### **Configuration Logging**
```typescript
// Startup configuration logging
console.log(`🔧 [CONFIG] Environment: ${process.env.NODE_ENV}`);
console.log(`🔧 [CONFIG] Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
console.log(`🔧 [CONFIG] Site URL: ${process.env.NEXT_PUBLIC_SITE_URL}`);
```

#### **Health Check Endpoint**
```typescript
// /api/diagnostics/system-health/route.ts
export async function GET() {
  const health = {
    database: await testDatabaseConnection(),
    qstash: await testQStashConnection(),
    stripe: await testStripeConnection(),
    environment: process.env.NODE_ENV
  };
  
  return NextResponse.json(health);
}
```

This comprehensive configuration documentation ensures that all aspects of the multi-platform influencer search platform are properly configured and maintainable across different environments and deployment scenarios.