# 📚 usegemz Platform Documentation

## Overview
This is the comprehensive technical documentation for the usegemz multi-platform influencer campaign management system. Documentation is written for developers and future maintainers of the system.

## 🏗️ System Architecture
- **Frontend**: Next.js 15.2.3 with TypeScript, shadcn/ui components
- **Backend**: Next.js API routes with Drizzle ORM and PostgreSQL (Supabase)
- **Authentication**: Clerk with custom admin system
- **Job Processing**: QStash for background processing
- **Search APIs**: 6 platform combinations (TikTok, Instagram, YouTube)
- **Trial System**: 7-day trial with automated email sequences
- **Deployment**: Vercel with environment-based configuration

## 📁 Documentation Structure

### 🎨 [Frontend Documentation](./frontend/)
- **[Design System](./frontend/design-system.md)** - Components, styling, and UI patterns
- **[URL Mapping](./frontend/url-mapping.md)** - Complete route structure and navigation
- **[User Flow](./frontend/user-flow.md)** - Step-by-step user journey with diagrams
- **[Search Interfaces](./frontend/search-ui.md)** - Keyword and similar search UIs
- **[Real-time Features](./frontend/real-time-features.md)** - Progress bars, polling, live updates

### ⚙️ [Backend Documentation](./backend/)

#### 🔐 [Authentication](./backend/auth/)
- **[Clerk Integration](./backend/auth/clerk-integration.md)** - Complete auth flow and setup
- **[Admin System](./backend/auth/admin-system.md)** - Admin verification and permissions
- **[Middleware](./backend/auth/middleware.md)** - Route protection and security

#### 🗃️ [Database](./backend/database/)
- **[Complete Schema](./backend/database/schema-complete.md)** - Every table, field, relationship
- **[Drizzle ORM](./backend/database/drizzle-orm.md)** - ORM patterns and CRUD operations
- **[Data Flows](./backend/database/data-flows.md)** - How data moves through the system

#### 🔄 [QStash Integration](./backend/qstash/)
- **[Implementation](./backend/qstash/implementation.md)** - Complete QStash setup
- **[Job Processing](./backend/qstash/job-processing.md)** - Background job lifecycle
- **[Webhook Handling](./backend/qstash/webhook-handling.md)** - Security and verification

#### 🔍 [Search APIs](./backend/apis/)
- **[Overview](./backend/apis/search-apis-overview.md)** - All 6 platform combinations
- **[TikTok APIs](./backend/apis/tiktok-apis.md)** - Keyword + Similar search
- **[Instagram APIs](./backend/apis/instagram-apis.md)** - Similar search
- **[YouTube APIs](./backend/apis/youtube-apis.md)** - Keyword + Similar search
- **[Bio/Email Extraction](./backend/apis/bio-email-extraction.md)** - Enhanced profile fetching

#### 📊 [Trial System](./backend/trial-system/)
- **[Implementation](./backend/trial-system/trial-implementation.md)** - Complete trial flow
- **[Email Sequences](./backend/trial-system/email-sequences.md)** - Automated emails
- **[Countdown System](./backend/trial-system/countdown-timers.md)** - Trial countdown logic

#### 🛠️ [Other Systems](./backend/other-systems/)
- **[Image Proxy](./backend/other-systems/image-proxy.md)** - HEIC conversion and CDN
- **[CSV Export](./backend/other-systems/csv-export.md)** - Data export functionality
- **[Logging System](./backend/other-systems/logging-system.md)** - Comprehensive logging
- **[Admin Features](./backend/other-systems/admin-features.md)** - Admin-only functionality

### 🚀 [Deployment](./deployment/)
- **[Environment Setup](./deployment/environment-setup.md)** - All environment variables
- **[Vercel Deployment](./deployment/vercel-deployment.md)** - Production deployment
- **[Troubleshooting](./deployment/troubleshooting.md)** - Common issues and solutions

## 🎯 Platform Capabilities

### Supported Search Types
| Platform | Keyword Search | Similar Search | Bio/Email Extraction | Image Support |
|----------|---------------|----------------|---------------------|---------------|
| **TikTok** | ✅ | ✅ | ✅ Enhanced Profile Fetching | HEIC → JPEG |
| **Instagram** | ❌ | ✅ | ✅ Direct from API | Standard |
| **YouTube** | ✅ | ❌ | ❌ Not Available | Thumbnails |

### User Journey
1. **Sign Up** → Clerk authentication + onboarding
2. **Trial Start** → 7-day trial with email sequence
3. **Campaign Creation** → Name and description
4. **Search Selection** → Keyword or Similar search
5. **Platform & Input** → Choose platform + enter keywords/username
6. **Background Processing** → QStash job with real-time progress
7. **Results Display** → Table with bio, email, stats
8. **Export** → CSV download with all data

## 🔧 Quick Start for Developers

1. **Clone and Setup**
   ```bash
   git clone [repo-url]
   npm install
   ```

2. **Environment Variables** (see [environment-setup.md](./deployment/environment-setup.md))
   ```bash
   cp .env.example .env.local
   # Configure Clerk, Supabase, QStash, APIs
   ```

3. **Database Migration**
   ```bash
   npm run db:migrate
   ```

4. **Development Server**
   ```bash
   npm run dev
   ```

## 📝 Documentation Standards

- **Technical Accuracy**: All code examples are from actual implementation
- **File References**: Include exact file paths and line numbers
- **API Specifications**: Complete request/response examples
- **Self-Contained**: Each document provides full context
- **Engineer-Focused**: Written for technical audience

## 🔄 Keeping Documentation Updated

When making changes to the system:
1. Update relevant documentation files
2. Update CLAUDE.md for major architectural changes
3. Add new sections as needed
4. Keep examples current with actual implementation

---

**Last Updated**: [Auto-generated timestamp]  
**System Version**: v2.0 (Multi-platform with Trial System)  
**Documentation Maintainer**: Claude AI Assistant