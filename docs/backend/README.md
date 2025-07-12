# ⚙️ Backend Documentation

## Overview
The usegemz backend is built with Next.js API routes, providing a robust server-side infrastructure for multi-platform influencer search and campaign management. This section covers all backend systems including authentication, database, job processing, and external API integrations.

## 🏗️ Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend Request                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Middleware    │────│ Authentication  │                    │
│  │   (Route Guard) │    │    (Clerk)      │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │   API Routes    │                                           │
│  │  (Next.js)      │                                           │
│  └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │    Database     │    │     QStash      │                    │
│  │   (Drizzle +    │    │  (Background    │                    │
│  │   Supabase)     │    │   Processing)   │                    │
│  └─────────────────┘    └─────────────────┘                    │
│         │                        │                             │
│         ▼                        ▼                             │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ External APIs   │    │   Email System  │                    │
│  │ (TikTok, IG,    │    │    (Resend +    │                    │
│  │  YouTube)       │    │    QStash)      │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Backend Documentation Index

### 🔐 [Authentication System](./auth/)
- **[Clerk Integration](./auth/clerk-integration.md)** - Complete authentication setup and flows
- **[Admin System](./auth/admin-system.md)** - Admin verification and permissions  
- **[Middleware](./auth/middleware.md)** - Route protection and security layers

### 🗃️ [Database System](./database/)
- **[Complete Schema](./database/schema-complete.md)** - Every table, field, and relationship
- **[Drizzle ORM](./database/drizzle-orm.md)** - ORM patterns and CRUD operations
- **[Data Flows](./database/data-flows.md)** - How data moves through the system
- **[Migrations](./database/migrations.md)** - Database migration strategy

### 🔄 [QStash Integration](./qstash/)
- **[Implementation](./qstash/implementation.md)** - Complete QStash setup and configuration
- **[Job Processing](./qstash/job-processing.md)** - Background job lifecycle and patterns
- **[Webhook Handling](./qstash/webhook-handling.md)** - Security, verification, and error handling

### 🔍 [Search APIs](./apis/)
- **[Overview](./apis/search-apis-overview.md)** - All 6 platform combinations
- **[TikTok APIs](./apis/tiktok-apis.md)** - Keyword + Similar search endpoints
- **[Instagram APIs](./apis/instagram-apis.md)** - Similar search implementation
- **[YouTube APIs](./apis/youtube-apis.md)** - Keyword + Similar search endpoints
- **[API Transformers](./apis/api-transformers.md)** - Data transformation patterns
- **[Bio/Email Extraction](./apis/bio-email-extraction.md)** - Enhanced profile fetching system

### 📊 [Trial System](./trial-system/)
- **[Implementation](./trial-system/trial-implementation.md)** - Complete 7-day trial flow
- **[Email Sequences](./trial-system/email-sequences.md)** - Automated email system with QStash
- **[Countdown System](./trial-system/countdown-timers.md)** - Trial countdown logic and calculations
- **[Stripe Mock](./trial-system/stripe-mock.md)** - Mock payment system for development

### 🛠️ [Other Systems](./other-systems/)
- **[Image Proxy](./other-systems/image-proxy.md)** - HEIC conversion and CDN handling
- **[CSV Export](./other-systems/csv-export.md)** - Data export functionality
- **[Logging System](./other-systems/logging-system.md)** - Comprehensive logging patterns
- **[Admin Features](./other-systems/admin-features.md)** - Admin-only functionality and tools

## 🎯 Core Technologies

| Technology | Purpose | Version | Documentation |
|------------|---------|---------|---------------|
| **Next.js** | API Routes Framework | 15.2.3 | Full-stack React framework |
| **TypeScript** | Type Safety | Latest | Strongly typed JavaScript |
| **Drizzle ORM** | Database ORM | Latest | Type-safe SQL queries |
| **Supabase** | PostgreSQL Database | Cloud | Managed PostgreSQL |
| **Clerk** | Authentication | Latest | Complete auth solution |
| **QStash** | Background Jobs | Latest | Serverless job queue |
| **Resend** | Email Service | Latest | Transactional emails |

## 🔧 Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:port/db"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="xxx"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"
CLERK_SECRET_KEY="sk_test_xxx"
NEXT_PUBLIC_ADMIN_EMAILS="admin@company.com,admin2@company.com"

# Background Processing (QStash)
QSTASH_URL="https://qstash.upstash.io"
QSTASH_TOKEN="xxx"
QSTASH_CURRENT_SIGNING_KEY="xxx"
QSTASH_NEXT_SIGNING_KEY="xxx"

# External APIs
SCRAPECREATORS_API_KEY="xxx"
SCRAPECREATORS_API_URL="https://api.scrapecreators.com/v1/tiktok/search/keyword"
SCRAPECREATORS_INSTAGRAM_API_URL="https://api.scrapecreators.com/v1/instagram/profile"

# Email System
RESEND_API_KEY="re_xxx"

# Application
NEXT_PUBLIC_SITE_URL="https://your-app.vercel.app"
VERCEL_URL="your-app.vercel.app"
```

## 🎯 API Route Structure

### Public Routes (No Auth)
```
/api/qstash/*                    # QStash webhook endpoints
/api/scraping/*                  # Search API endpoints (internal)
/api/proxy/*                     # Image proxy and utilities
/api/export/*                    # CSV export endpoints
/api/email/send-scheduled        # Scheduled email sending
```

### Protected Routes (Auth Required)
```
/api/campaigns/*                 # Campaign CRUD operations
/api/profile                     # User profile management
/api/onboarding/*               # Onboarding flow endpoints
```

### Admin Routes (Admin Only)
```
/api/admin/config/*             # System configuration
/api/admin/email-testing/*      # Email testing tools
/api/admin/users/*              # User management
/api/admin/create-test-user     # Development utilities
/api/admin/test-login           # Admin testing tools
```

## 🔄 Request/Response Patterns

### Standard API Response Format
```typescript
// Success Response
{
  success: true,
  data: T,
  message?: string,
  meta?: {
    pagination?: PaginationInfo,
    timing?: number,
    requestId?: string
  }
}

// Error Response
{
  success: false,
  error: string,
  code?: string,
  details?: any,
  requestId?: string
}
```

### Authentication Headers
```typescript
// Clerk JWT Token
headers: {
  'Authorization': 'Bearer <clerk-jwt-token>',
  'Content-Type': 'application/json'
}

// QStash Webhook Verification
headers: {
  'Upstash-Signature': '<signature>',
  'Upstash-Message-Id': '<message-id>',
  'Upstash-Timestamp': '<timestamp>'
}
```

## 🎯 Data Flow Patterns

### Campaign Creation Flow
```
Frontend Request → Authentication → Validation → Database Write → Response
      ↓
Campaign API (/api/campaigns) → User Verification → Create Record → Return ID
      ↓
Search Initiation → Job Creation → QStash Message → Background Processing
```

### Search Processing Flow
```
QStash Webhook → Signature Verification → Job Loading → External API Call
      ↓
Data Transformation → Database Storage → Progress Update → Email Notification
```

### Real-time Updates Flow
```
Frontend Polling → Job Status API → Database Query → Status Response
      ↓
Progress Calculation → Results Aggregation → Client Update
```

## 🛡️ Security Patterns

### Authentication Layers
1. **Clerk Middleware** - Route-level authentication
2. **Admin Verification** - Environment variable + database checks  
3. **API Key Management** - External service authentication
4. **QStash Signature** - Webhook request verification

### Data Protection
- **Input Validation** - Zod schemas for request validation
- **SQL Injection Prevention** - Drizzle ORM parameterized queries
- **Rate Limiting** - QStash built-in rate limiting
- **CORS Configuration** - Selective origin allowance

## 🔧 Development Patterns

### Error Handling
```typescript
try {
  // API operation
  const result = await apiCall();
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  console.error('[API-ERROR]', error);
  return NextResponse.json(
    { error: error.message || 'Internal server error' },
    { status: 500 }
  );
}
```

### Logging Standards
```typescript
// Success logging
console.log('✅ [OPERATION] Success message:', data);

// Error logging  
console.error('❌ [OPERATION] Error description:', error);

// Debug logging
console.log('🔍 [DEBUG] Variable state:', { var1, var2 });

// Progress logging
console.log('📊 [PROGRESS] Current status:', progress);
```

### Database Patterns
```typescript
// Drizzle query pattern
const result = await db.query.tableName.findFirst({
  where: eq(tableName.field, value),
  with: {
    relationName: true
  }
});

// Transaction pattern
await db.transaction(async (tx) => {
  await tx.insert(table1).values(data1);
  await tx.update(table2).set(data2).where(condition);
});
```

## 🎯 Performance Considerations

### Database Optimization
- **Indexes**: Key fields for fast queries
- **Transactions**: Atomic operations for data consistency
- **Connection Pooling**: Supabase managed connections
- **Query Optimization**: Selective field loading

### API Performance
- **Response Caching**: Strategic caching for static data
- **Pagination**: Large result set handling
- **Background Processing**: Heavy operations via QStash
- **Image Optimization**: Proxy with HEIC conversion

### Memory Management
- **Stream Processing**: Large data sets
- **Garbage Collection**: Proper cleanup in long-running processes
- **Resource Limits**: Vercel function constraints

---

**Start Here**: Begin with [Authentication System](./auth/) to understand the foundation of backend security and user management.