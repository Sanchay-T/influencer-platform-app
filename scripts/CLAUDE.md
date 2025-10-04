# 🔧 Scripts & Utilities Documentation - Influencer Platform

## Overview

The influencer platform includes a comprehensive suite of development scripts, automation tools, and utilities designed to streamline database management, user administration, testing, monitoring, and deployment workflows. These scripts are organized across the root directory and `/scripts` folder, providing essential development and operational capabilities.

**Total Scripts**: 85+ utility scripts and tools
**Categories**: Database Management, User Administration, API Testing, Performance Monitoring, Development Tools, Production Deployment, **Database Normalization & Testing Framework**, **Platform Testing Framework**
**NEW**: Professional-grade testing framework with 1500+ lines of specialized test code + comprehensive platform-specific test suite

---

## Database Management Scripts

### 🗄️ Core Database Operations

#### **`scripts/setup-local-db.sh`** 
**Purpose**: Complete local PostgreSQL database setup with Docker
**Usage**: `npm run db:local:setup`
**Features**:
- Docker availability verification
- PostgreSQL container management via docker-compose
- Automatic migration execution
- Connection verification and ready-state checking
- Comprehensive setup instructions and troubleshooting

**Environment Requirements**: Docker Desktop, `docker-compose.yml` configuration

#### **`scripts/test-local-db.js`**
**Purpose**: Verify local database connectivity and schema
**Usage**: `npm run db:local:test` or `node scripts/test-local-db.js`
**Features**:
- Connection string validation
- Table existence verification
- Basic CRUD operation testing
- Schema integrity checks

#### **`run-migration.js`** *(root level)*
**Purpose**: Execute specific database migrations
**Usage**: `node run-migration.js`
**Features**:
- Drizzle ORM migration execution
- Migration status tracking
- Rollback capabilities
- Error handling with detailed logging

#### **`scripts/run-single-migration.js`**
**Purpose**: Execute individual migration files
**Usage**: `node scripts/run-single-migration.js [migration-name]`
**Features**:
- Single migration execution
- Dependency validation
- Progress tracking

### 📊 Database Analysis & Monitoring

#### **`scripts/analyze-database.js`**
**Purpose**: Comprehensive database structure and billing state analysis
**Usage**: `node scripts/analyze-database.js`
**Features**:
- Complete table schema analysis
- User profile and billing status review
- Plan distribution analysis
- Database size and integrity checks
- Data inconsistency detection

#### **`scripts/inspect-db.js`**
**Purpose**: Interactive database inspection and debugging
**Usage**: `node scripts/inspect-db.js`
**Features**:
- Live database state examination
- Table row counting
- Schema validation
- Performance metrics collection

#### **`scripts/test-db-performance.js`**
**Purpose**: Database performance benchmarking and optimization analysis
**Usage**: `node scripts/test-db-performance.js`
**Features**:
- Query performance measurement
- Connection pool testing
- Transaction timing analysis
- Performance bottleneck identification

### 🔍 Database Indexing & Optimization

#### **`scripts/add-search-indexes.js`**
**Purpose**: Add performance indexes for search operations
**Usage**: `node scripts/add-search-indexes.js`
**Features**:
- Campaign search index creation
- User profile indexes
- Scraping job performance indexes
- Foreign key constraint optimization

#### **`scripts/update-database-schema.js`**
**Purpose**: Schema updates and migrations management
**Usage**: `node scripts/update-database-schema.js`
**Features**:
- Schema version management
- Automated schema updates
- Backward compatibility checking
- Migration conflict resolution

#### **`lib/migrations/clean-test-subscriptions.js`** *(Enhanced)*
**Purpose**: Production-ready test subscription cleanup with normalized table support
**Usage**: Automatically runs in production environments or `node lib/migrations/clean-test-subscriptions.js`
**Features**:
- **🆕 Normalized Table Support**: Updated for new `user_subscriptions`, `user_billing` structure
- **Environment Detection**: Only runs in production (`NODE_ENV=production` or `VERCEL_ENV=production`)
- **Comprehensive Cleanup**: Removes test Stripe subscription IDs, customer IDs, and test data patterns
- **Audit Logging**: Detailed logging of cleanup operations with user impact tracking
- **Safety Measures**: Includes confirmation patterns and graceful error handling
- **Auto-execution**: Runs automatically on import in production environments

**Enhanced Security Features**:
```javascript
// Updated query patterns for normalized tables
const cleanQuery = `
  UPDATE user_profiles
  SET
    stripe_subscription_id = NULL,
    stripe_customer_id = NULL,
    subscription_status = NULL,
    updated_at = NOW()
  WHERE stripe_subscription_id LIKE 'sub_1Rm%'     // Remove test subscriptions
     OR stripe_subscription_id LIKE '%test%'        // Remove test patterns
     OR stripe_customer_id LIKE 'cus_test_%'        // Remove test customers
`;
```

**🔒 Production Safety**: Includes extensive safety checks and will not execute in development environments

---

## User Management Tools

### 👤 User Administration

#### **`scripts/list-users.js`**
**Purpose**: Comprehensive user listing and status overview
**Usage**: `node scripts/list-users.js`
**Features**:
- All user profiles display
- Trial status and plan information
- Subscription details
- Usage statistics
- Admin role identification

#### **`scripts/find-user-id.js`**
**Purpose**: User lookup by email or identifier
**Usage**: `npm run find-user-id` or `node scripts/find-user-id.js`
**Features**:
- Email-based user search
- Clerk ID resolution
- User profile data display
- Cross-reference validation

#### **`scripts/inspect-user-state.js`**
**Purpose**: Detailed individual user state analysis
**Usage**: `node scripts/inspect-user-state.js`
**Features**:
- Complete user profile examination
- Trial and subscription status
- Usage tracking analysis
- Payment method details
- Billing history review

### 🔄 User State Management

#### **`scripts/reset-user-to-fresh-state.js`**
**Purpose**: Complete user reset to fresh onboarding state
**Usage**: `node scripts/reset-user-to-fresh-state.js`
**Features**:
- Complete data deletion (campaigns, jobs, results)
- Fresh 7-day trial activation
- Free plan reset with zero limits
- Stripe billing data clearing
- Usage counter reset
- Browser cache clearing instructions

**⚠️ WARNING**: This is a destructive operation that permanently deletes all user data.

#### **`scripts/reset-user-simple.js`**
**Purpose**: Lightweight user reset without data deletion
**Usage**: `npm run reset-user:simple`
**Features**:
- Onboarding step reset
- Plan status adjustment
- Trial renewal
- Usage counter reset (preserves historical data)

#### **`scripts/reset-user-onboarding.js/.ts`**
**Purpose**: Onboarding flow reset with plan maintenance
**Usage**: `npm run reset-user` or `npm run reset-user:ts`
**Features**:
- Onboarding step reset to 'pending'
- Current plan preservation
- Trial status adjustment
- User profile updates

#### **`scripts/reset-onboarding-by-user-id.js`**
**Purpose**: Target specific user for onboarding reset
**Usage**: `node scripts/reset-onboarding-by-user-id.js [user-id]`
**Features**:
- Direct user ID targeting
- Selective onboarding reset
- State validation
- Error recovery

#### **`scripts/delete-user-completely.js`**
**Purpose**: Complete user data purging (GDPR compliance)
**Usage**: `node scripts/delete-user-completely.js`
**Features**:
- Complete user data deletion
- Cascade deletion of related records
- GDPR compliance ensuring
- Verification and confirmation prompts

**⚠️ DANGER**: Irreversible user data deletion. Use with extreme caution.

#### **`scripts/delete-duplicate-users.js`**
**Purpose**: Identify and remove duplicate user profiles
**Usage**: `node scripts/delete-duplicate-users.js`
**Features**:
- Duplicate detection by email/Clerk ID
- Safe deduplication logic
- Data migration before deletion
- Conflict resolution

### 🔧 User Utility Scripts

#### **`scripts/copy-trial-to-current-user.js`**
**Purpose**: Clone trial configuration to different user
**Usage**: `node scripts/copy-trial-to-current-user.js`
**Features**:
- Trial state duplication
- Plan configuration copying
- Usage limit transfer
- State synchronization

#### **`scripts/start-trial-for-existing-user.js`**
**Purpose**: Manually initiate trial for existing users
**Usage**: `node scripts/start-trial-for-existing-user.js [user-id]`
**Features**:
- Manual trial activation
- Email sequence triggering
- Trial expiration scheduling
- State validation

#### **`scripts/fix-user-billing-state.js`**
**Purpose**: Repair inconsistent billing states
**Usage**: `node scripts/fix-user-billing-state.js`
**Features**:
- Billing state validation
- Stripe data synchronization
- Plan limit corrections
- Usage tracking fixes

---

## Development Utilities

### 🚀 Development Server Management

#### **`scripts/dev-with-port.js`**
**Purpose**: Enhanced development server with flexible port configuration
**Usage**: `npm run dev`, `npm run dev:wt2`
**Features**:
- Multi-environment port management (.env.local, .env.worktree)
- Automatic port resolution (LOCAL_PORT → PORT → 3000)
- Next.js binary resolution
- Process inheritance and exit handling
- Worktree-specific development support

#### **`scripts/dev-wt.sh`**
**Purpose**: Worktree-specific development launcher
**Usage**: `./scripts/dev-wt.sh`
**Features**:
- Branch-specific development configuration
- Environment isolation
- Port conflict prevention

### 🌍 Environment Management

#### **`scripts/check-env.js`**
**Purpose**: Environment variable validation for API integrations
**Usage**: `node scripts/check-env.js`
**Features**:
- Required environment variable checking
- API key validation
- ScrapeCreators API setup verification
- Apify integration validation
- Configuration completeness assessment

#### **`setup-testing-environment.sh`** *(root level)*
**Purpose**: Complete testing environment setup with Supabase project cloning
**Usage**: `./setup-testing-environment.sh`
**Features**:
- Supabase CLI verification and login
- Production schema pulling
- Testing project creation guidance
- Migration file management
- Template environment file generation
- Manual setup step instructions

**Dependencies**: Supabase CLI (`npm install -g supabase`)

### 📦 Package & Dependency Management

#### **`package.json` Scripts Summary**
**Key NPM Scripts**:
```bash
# Development
npm run dev              # Enhanced dev server with port config
npm run dev:local        # Local development on port 3002
npm run dev:wt2          # Worktree-specific development

# Database
npm run db:local:setup   # Complete local DB setup
npm run db:local:test    # Test local database connectivity
npm run db:seed:plans    # Seed subscription plans
npm run db:studio:local  # Open Drizzle studio for local DB

# User Management
npm run reset-user       # Reset user onboarding state
npm run find-user-id     # Find user by email/identifier

# Testing
npm run test:tiktok-similar     # TikTok similar search testing
npm run test:tiktok-similar-api # TikTok API testing

# Monitoring
npm run logs:onboarding  # Monitor onboarding logs
```

---

## API Testing & Research Scripts

### 🧪 Platform-Specific API Testing

#### **TikTok API Testing**
- **`run-tiktok-test.js`** *(root)*: Basic TikTok API functionality testing
- **`test-tiktok-similar.js`** *(root)*: TikTok similar search API validation
- **`standalone-tiktok-test.js`** *(root)*: Isolated TikTok API testing
- **`test-tiktok-modules.js`** *(root)*: TikTok module integration testing

#### **Instagram API Testing Suite**
- **`scripts/quick-test-instagram-apis.js`**: Rapid Instagram API validation
- **`scripts/research-instagram-similar-apis.js`**: Instagram similar search research
- **`scripts/test-instagram-keyword.js`**: Instagram keyword search testing
- **`scripts/test-instagram-keyword-comparison.js`**: Multi-provider comparison
- **`scripts/test-ensemble-instagram-keyword.js`**: Ensemble API testing

#### **Apify Integration Testing**
- **`scripts/test-apify-instagram.js/.mjs`**: Apify Instagram scraper testing
- **`scripts/test-apify-instagram-simple.js`**: Basic Apify functionality
- **`scripts/test-apify-instagram-final.js`**: Production-ready Apify testing
- **`scripts/test-apify-hashtag-actors.js`**: Hashtag scraper validation
- **`scripts/test-both-hashtag-scrapers.js`**: Multi-scraper comparison

### 📊 End-to-End Testing

#### **`scripts/test-all-searches.js`**
**Purpose**: Comprehensive testing of all 6 search endpoint combinations
**Usage**: `node scripts/test-all-searches.js`
**Features**:
- TikTok keyword + similar search testing
- Instagram reels + similar search testing  
- YouTube keyword + similar search testing
- Automated test data generation
- Performance measurement
- Results validation

#### **`test-complete-flow.js`** *(root)*
**Purpose**: Complete end-to-end workflow validation
**Usage**: `node test-complete-flow.js`
**Features**:
- Core logic testing
- API endpoint validation
- QStash integration verification
- Frontend integration testing
- Data flow validation

#### **`validate-test-results.js`** *(root)*
**Purpose**: Test result validation and quality assessment
**Usage**: `node validate-test-results.js`
**Features**:
- Data quality validation
- Result completeness checking
- Performance metrics analysis
- Error pattern detection

### 🎯 Specialized Testing Scripts

#### **Exact Count Delivery Testing** (`/test-scripts/`)
- **`run-exact-count-test.js`**: Exact creator count delivery testing
- **`test-100-creators.js`**: 100-creator target validation
- **`tiktok-exact-count-tracker.js`**: TikTok count accuracy tracking
- **`qstash-exact-count-processor.js`**: QStash processor testing
- **`qstash-integration-patch.js`**: QStash integration fixes

---

## Database Normalization & Testing Framework

### 🏗️ **Comprehensive Testing Architecture**

The platform includes a professional-grade testing framework designed for database normalization verification, API integration testing, and data integrity validation. This system provides **1500+ lines of specialized test code** across multiple testing layers.

#### **Master Test Orchestration**

##### **`run-all-tests.js`** *(243 lines)*
**Purpose**: Comprehensive test suite orchestration with multi-layer verification
**Usage**: `node run-all-tests.js`
**Architecture**:
- **4 Test Suite Integration**: Database Refactoring, API Integration, Data Integrity, MCP Verification
- **Real-time Progress Tracking**: Color-coded console output with detailed timing
- **Comprehensive Reporting**: Pass/fail statistics, warnings, and detailed results
- **Error Recovery**: Individual suite failure isolation

**Test Suite Hierarchy**:
```javascript
MasterTestRunner
├── DatabaseRefactoringTester (Database normalization validation)
├── APIIntegrationTester (API endpoint verification)
├── DataIntegrityTester (Data migration safety)
└── MCPDatabaseVerifier (MCP integration validation)
```

**Features**:
- Multi-threaded test execution
- Detailed performance metrics
- HTML-style result reporting
- Error isolation and recovery
- Production-ready test orchestration

### 🧪 **Database Testing & Verification**

#### **`test-normalized-database.ts`** *(307 lines)*
**Purpose**: TypeScript-based database normalization verification
**Usage**: `tsx test-normalized-database.ts` or `npm run test:db:normalized`
**Features**:
- **Schema Validation**: Verify normalized table structures (users, user_subscriptions, user_usage, user_billing, campaign_data)
- **Constraint Testing**: Foreign key relationships, check constraints, unique indexes
- **Migration Verification**: Ensure data migration accuracy and completeness
- **Performance Testing**: Index effectiveness and query optimization
- **Rollback Safety**: Verify safe migration rollback procedures

#### **`test-migration.js`** *(78 lines)*
**Purpose**: Database migration testing and validation
**Usage**: `node test-migration.js`
**Features**:
- Migration execution verification
- Schema change validation
- Data preservation testing
- Performance impact assessment
- Rollback capability verification

#### **`apply-normalization.sql`** *(144 lines)*
**Purpose**: Production-ready database normalization SQL script
**Usage**: Direct SQL execution in database console or via migration system
**Architecture**:
```sql
-- 5 Normalized Tables Architecture
├── users (Core identity & profile)
├── user_subscriptions (Trial & billing)
├── user_usage (Usage tracking)
├── user_billing (Payment integration) 
└── campaign_data (Search campaigns)
```

**Features**:
- **Clean Normalization**: 5-table normalized structure
- **Comprehensive Constraints**: Check constraints, foreign keys, unique indexes
- **Data Integrity**: ACID compliance and referential integrity
- **Performance Optimization**: Strategic indexing for query performance

### 🔗 **API Integration Testing**

#### **`test-api-endpoints.ts`** *(190 lines)*
**Purpose**: TypeScript API endpoint verification against normalized database
**Usage**: `tsx test-api-endpoints.ts` or `npm run test:api`
**Features**:
- **Endpoint Coverage**: Test all critical API routes with new database schema
- **Response Validation**: Verify API responses match expected normalized data structure
- **Performance Metrics**: Response time measurement and performance benchmarking
- **Error Handling**: Test error scenarios and validation failures
- **Authentication Testing**: Verify auth integration with new user table structure

**Tested Endpoints**:
- User profile APIs (`/api/user/*`)
- Subscription management (`/api/subscriptions/*`)
- Campaign operations (`/api/campaigns/*`)
- Admin panel APIs (`/api/admin/*`)
- Scraping job APIs (`/api/scraping/*`)

#### **`verify-refactor.js`** *(121 lines)*
**Purpose**: End-to-end refactor verification and validation
**Usage**: `node verify-refactor.js`
**Features**:
- **Complete System Verification**: Test entire application stack with normalized database
- **Integration Validation**: Verify frontend-backend-database integration
- **Performance Comparison**: Before/after performance metrics
- **Data Consistency**: Ensure data consistency across refactored system

### 🔒 **Comprehensive Test Suites**

#### **`tests/database-refactoring-tests.js`** *(401 lines)*
**Purpose**: Multi-layered database refactoring verification
**Features**:
- **MCP Integration Testing**: Verify MCP (Model Context Protocol) database operations
- **Direct Database Testing**: Raw SQL query validation
- **Schema Migration Testing**: Complete migration process verification
- **Performance Benchmarking**: Database operation performance measurement
- **Error Recovery Testing**: Test failure scenarios and recovery procedures

#### **`tests/api-integration-tests.js`** *(378 lines)*
**Purpose**: Comprehensive API integration testing with normalized database
**Features**:
- **HTTP Request Testing**: All API endpoints with realistic payloads
- **Authentication Flow**: Complete auth testing with Clerk integration
- **Database Transaction Testing**: Verify API operations create correct database records
- **Error Scenario Testing**: Invalid inputs, auth failures, constraint violations
- **Rate Limiting Testing**: API throttling and quota enforcement

#### **`tests/data-integrity-tests.js`** *(471 lines)*
**Purpose**: Data integrity and migration safety validation
**Features**:
- **Data Migration Verification**: Ensure data preservation during normalization
- **Referential Integrity**: Test foreign key constraints and cascading operations
- **Rollback Safety**: Verify safe rollback procedures and data recovery
- **Constraint Validation**: Test all database constraints and business rules
- **GDPR Compliance**: User data deletion and privacy compliance testing

#### **`tests/mcp-database-verification.js`** *(272 lines)*
**Purpose**: MCP (Model Context Protocol) database integration verification
**Features**:
- **MCP Operation Testing**: Verify MCP can correctly interact with normalized database
- **Query Translation**: Test MCP query translation to normalized schema
- **Performance Optimization**: Verify MCP queries are optimized for new schema
- **Connection Management**: Test MCP database connection handling

### 🚀 **Testing Framework Usage Patterns**

#### **Complete System Verification Workflow**
```bash
# 1. Run master test suite (comprehensive verification)
node run-all-tests.js

# 2. Individual test suite execution
tsx test-normalized-database.ts          # Database normalization verification
tsx test-api-endpoints.ts                # API endpoint testing
node test-migration.js                   # Migration verification
node verify-refactor.js                  # End-to-end refactor verification

# 3. Specialized testing
node tests/database-refactoring-tests.js # Database-specific tests
node tests/api-integration-tests.js      # API integration validation
node tests/data-integrity-tests.js       # Data safety verification
node tests/mcp-database-verification.js  # MCP integration testing
```

#### **Pre-Production Deployment Checklist**
```bash
# Essential testing sequence before deployment
node run-all-tests.js                    # Master verification (all 4 suites)
tsx test-normalized-database.ts          # Database schema verification
node verify-refactor.js                  # Complete system validation
node test-migration.js                   # Migration safety check

# Performance validation
node scripts/benchmark-performance.js     # Performance benchmarking
node scripts/test-db-performance.js      # Database performance verification
```

### 🛠️ **Testing Framework Architecture**

#### **Professional Testing Standards**
- **Modular Design**: Independent test suites with clear separation of concerns
- **Comprehensive Coverage**: Database, API, integration, and performance testing
- **Production-Ready**: Professional logging, error handling, and reporting
- **Scalable Architecture**: Easily extensible for new features and test scenarios

#### **Test Data Management**
- **Mock Data Generation**: Realistic test data for comprehensive validation
- **Data Isolation**: Tests use isolated test environments
- **Cleanup Procedures**: Automatic test data cleanup and environment reset
- **State Management**: Test state tracking and rollback capabilities

#### **Reporting & Monitoring**
- **Real-time Feedback**: Color-coded console output with progress indicators  
- **Detailed Metrics**: Performance timing, pass/fail rates, error details
- **Structured Logging**: JSON-formatted logs for automated analysis
- **Test History**: Maintain test execution history for trend analysis

### 🔧 **Framework Dependencies**

**Required Technologies**:
- **Node.js 18+**: JavaScript runtime environment
- **TypeScript/TSX**: For TypeScript-based test execution
- **PostgreSQL**: Database system for testing
- **MCP Protocol**: Model Context Protocol integration
- **Drizzle ORM**: Database query builder and migration system

**Testing Libraries**:
```json
{
  "tsx": "TypeScript execution environment",
  "node-fetch": "HTTP request testing",
  "colors": "Console output formatting", 
  "child_process": "Process execution for system testing"
}
```

---

## Platform Testing Framework

### 🧪 **Comprehensive Platform Test Suite**

The platform includes a **specialized testing framework** designed for smoke testing, platform integration verification, and search result comparison across TikTok, Instagram, and YouTube. This system provides **600+ lines of platform-specific test code** with comprehensive CSV logging and result analysis.

#### **Search Result Comparison**

##### **`test-scripts/compare-search-results.ts`** *(188 lines)*
**Purpose**: Compare search results between current and legacy implementations
**Usage**: `COMPARE_TYPE=keyword COMPARE_PLATFORM=tiktok tsx test-scripts/compare-search-results.ts`
**Features**:
- **Cross-Version Comparison**: Compares current vs legacy search implementations
- **Intelligent Parsing**: Custom CSV parser with metadata handling
- **Field-Level Analysis**: Identifies differences in specific creator fields
- **Automated Reporting**: Generates detailed comparison reports with timestamps
- **Multi-Platform Support**: Works with TikTok, Instagram, and YouTube results

**Architecture**:
```typescript
// Comparison workflow
Latest Results (search-matrix/) + Legacy Results (search-matrix-legacy/)
→ Field-by-field comparison
→ Detailed difference report (search-comparison/)
```

**Output Analysis**:
- **Presence Differences**: Creators present in one version but not the other
- **Field Value Differences**: Changes in bio, follower count, verification status
- **Summary Statistics**: Total presence vs field value differences

#### **Platform-Specific Test Suites**

##### **TikTok Testing (`/test-scripts/search/keyword/` & `/test-scripts/search/similar/`)**
- **`tiktok-keyword.test.ts`** *(192 lines): TikTok keyword search with enhanced bio extraction
- **`tiktok-similar.test.ts`** *(180+ lines): TikTok similar user search testing

**Features**:
- **Enhanced Bio Fetching**: Secondary API calls for complete profile data
- **Email Extraction**: Regex-based email detection from bios
- **Performance Timing**: API response time measurement
- **CSV Export**: Structured result logging with metadata
- **Error Recovery**: Graceful handling of profile fetch failures

##### **Instagram Testing (`/test-scripts/search/keyword/` & `/test-scripts/search/similar/`)**
- **`instagram-enhanced.test.ts`**: Instagram keyword search with Apify integration
- **`instagram-similar.test.ts`**: Instagram similar search testing

**Features**:
- **Dual API Integration**: ScrapeCreators + Apify for comprehensive data
- **Profile Enhancement**: Secondary profile fetching for complete data
- **Reels Search**: Instagram Reels-specific search functionality
- **Bio Enhancement**: Extended bio fetching with email extraction

##### **YouTube Testing (`/test-scripts/search/keyword/` & `/test-scripts/search/similar/`)**
- **`youtube-keyword.test.ts`**: YouTube channel keyword search
- **`youtube-similar.test.ts`**: YouTube channel similarity testing

**Features**:
- **Channel Analysis**: YouTube channel-specific data extraction
- **Subscriber Metrics**: Accurate subscriber count and engagement data
- **Social Links**: Extraction of external social media links
- **Content Analysis**: Video content and channel description analysis

#### **Specialized Testing Modules**

##### **Dashboard Testing (`/test-scripts/dashboard/`)**
- **`follower-format.test.ts`** *(34 lines): Dashboard formatter unit tests

**Features**:
```typescript
describe('dashboard formatters', () => {
  it('format millions with one decimal place and suffix', () => {
    assert.equal(formatFollowerCount(2400000), '2.4M');
  });

  it('shows relative time for past dates', () => {
    assert.equal(formatRelativeTime('2025-09-24T12:00:00Z', reference), '2 days ago');
  });
});
```

##### **Modash Integration Testing (`/test-scripts/modash/`)**
- **`instagram-search.test.ts`**: Modash API Instagram search testing
- **`instagram-report.test.ts`**: Modash detailed report generation

**Features**:
- **Third-Party Integration**: Modash API integration testing
- **Report Generation**: Detailed influencer report validation
- **Data Quality**: Enhanced data quality verification

##### **Legacy Test Suite (`/test-scripts/legacy/`)**
- **`tiktok-keyword-old.test.ts`**: Legacy TikTok keyword implementation
- **`instagram-similar-old.test.ts`**: Legacy Instagram similar search

**Features**:
- **Backward Compatibility**: Maintains legacy test implementations
- **Performance Comparison**: Compares legacy vs current performance
- **Regression Testing**: Ensures new implementations don't break existing functionality

#### **Testing Framework Architecture**

##### **Common Testing Patterns**
```typescript
// Standard test structure across all platform tests
loadEnv({ path: path.join(process.cwd(), '.env.development') });

// Environment validation
const REQUIRED_VARS = ['API_KEY', 'API_URL'];
for (const key of REQUIRED_VARS) {
  assert(process.env[key], `Missing required env var: ${key}`);
}

// CSV generation with metadata
function writeCsv(searchType: string, platform: string, metadata: Record<string, unknown>, rows: Record<string, unknown>[]): string {
  const outputDir = path.join(process.cwd(), 'logs', 'search-matrix', searchType, platform);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `${platform}-${searchType}-${timestamp}.csv`);
  // ... CSV generation with metadata headers
}
```

##### **Result Logging Structure**
```
logs/
├── search-matrix/           # Current implementation results
│   ├── keyword/
│   │   ├── tiktok/         # TikTok keyword results
│   │   ├── instagram/      # Instagram keyword results
│   │   └── youtube/        # YouTube keyword results
│   └── similar/
│       ├── tiktok/         # TikTok similar search results
│       ├── instagram/      # Instagram similar search results
│       └── youtube/        # YouTube similar search results
├── search-matrix-legacy/    # Legacy implementation results
└── search-comparison/       # Comparison analysis results
```

#### **Testing Workflow & Usage**

##### **Individual Platform Testing**
```bash
# TikTok testing
TEST_TIKTOK_KEYWORD="beauty influencer" tsx test-scripts/search/keyword/tiktok-keyword.test.ts
tsx test-scripts/search/similar/tiktok-similar.test.ts

# Instagram testing
tsx test-scripts/search/keyword/instagram-enhanced.test.ts
tsx test-scripts/search/similar/instagram-similar.test.ts

# YouTube testing
tsx test-scripts/search/keyword/youtube-keyword.test.ts
tsx test-scripts/search/similar/youtube-similar.test.ts

# Dashboard unit tests
npm test test-scripts/dashboard/follower-format.test.ts
```

##### **Comparison Testing Workflow**
```bash
# 1. Run current implementation tests (generates search-matrix results)
tsx test-scripts/search/keyword/tiktok-keyword.test.ts

# 2. Run legacy implementation tests (generates search-matrix-legacy results)
tsx test-scripts/legacy/tiktok-keyword-old.test.ts

# 3. Compare results
COMPARE_TYPE=keyword COMPARE_PLATFORM=tiktok tsx test-scripts/compare-search-results.ts
```

##### **Bulk Testing Operations**
```bash
# Test all platforms for keyword search
for platform in tiktok instagram youtube; do
  tsx test-scripts/search/keyword/${platform}-keyword.test.ts
done

# Test all platforms for similar search
for platform in tiktok instagram youtube; do
  tsx test-scripts/search/similar/${platform}-similar.test.ts
done
```

#### **Enhanced Features & Quality Assurance**

##### **Platform-Specific Enhancements**
- **TikTok**: Enhanced bio extraction, HEIC image handling, rate limiting
- **Instagram**: Dual API integration (ScrapeCreators + Apify), Reels focus
- **YouTube**: Channel analysis, subscriber metrics, social link extraction
- **Universal**: Email extraction, performance timing, error recovery

##### **Data Quality Features**
- **Metadata Tracking**: Search parameters, timing, result counts
- **Performance Monitoring**: API response times, processing duration
- **Error Handling**: Graceful degradation, detailed error logging
- **Result Validation**: Field completeness, data format verification

##### **Testing Standards**
- **Modular Design**: Separate test files for each platform and search type
- **Comprehensive Coverage**: Keyword and similar search for all platforms
- **Data Persistence**: CSV exports with timestamp and metadata
- **Comparison Tools**: Automated difference detection and reporting

#### **Framework Dependencies**

**Required Technologies**:
- **Node.js 18+**: TypeScript execution environment with tsx
- **TypeScript**: Type-safe test implementation
- **Platform APIs**: ScrapeCreators, Apify, Modash integrations
- **Environment Variables**: API keys and configuration management

**Testing Libraries**:
```json
{
  "tsx": "TypeScript execution for test files",
  "node:assert/strict": "Assertion library for validation",
  "node:test": "Node.js native test runner",
  "dotenv": "Environment variable loading"
}
```

---

## Performance Monitoring & Benchmarking

### ⚡ Performance Analysis

#### **`scripts/benchmark-performance.js`**
**Purpose**: Comprehensive platform performance benchmarking
**Usage**: `node scripts/benchmark-performance.js`
**Features**:
- localStorage operation simulation (caching system)
- API call delay measurement
- Component rendering performance
- Cache hit/miss ratio analysis
- Performance comparison metrics

#### **`scripts/analyze-search-data.js`**
**Purpose**: Search operation performance and data quality analysis
**Usage**: `node scripts/analyze-search-data.js`
**Features**:
- Search result quality assessment
- API response time measurement
- Data transformation performance
- Cache effectiveness analysis
- Search accuracy evaluation

#### **`scripts/test-migration-status.js`**
**Purpose**: Database migration performance and status tracking
**Usage**: `node scripts/test-migration-status.js`
**Features**:
- Migration execution timing
- Schema change validation
- Performance impact assessment
- Rollback readiness verification

### 📈 System Monitoring

#### **`scripts/api-logger.js`**
**Purpose**: Advanced API request/response logging and analysis
**Usage**: `node scripts/api-logger.js`
**Features**:
- Real-time API call monitoring
- Request/response payload logging
- Performance metrics collection
- Error pattern identification
- Rate limiting analysis

#### **`scripts/simple-api-logger.js`**
**Purpose**: Lightweight API monitoring for development
**Usage**: `node scripts/simple-api-logger.js`
**Features**:
- Basic API call logging
- Response time measurement
- Error detection
- Simple metrics collection

#### **`scripts/view-api-logs.js`**
**Purpose**: API log analysis and visualization
**Usage**: `node scripts/view-api-logs.js`
**Features**:
- Historical API log review
- Performance trend analysis
- Error frequency tracking
- Usage pattern identification

---

## Subscription & Billing Management

### 💳 Plan Management

#### **`scripts/seed-subscription-plans.js`**
**Purpose**: Initialize subscription plans in database
**Usage**: `npm run db:seed:plans` or `node scripts/seed-subscription-plans.js`
**Features**:
- Predefined plan structure creation
- Plan limits and features configuration
- Pricing tier establishment
- Feature flag initialization

#### **`scripts/seed-plans-remote.js`**
**Purpose**: Remote database plan seeding for production environments
**Usage**: `node scripts/seed-plans-remote.js`
**Features**:
- Remote database connection
- Production plan configuration
- Environment-specific plan variations
- Safety checks for production seeding

### 🔄 Subscription System Testing

#### **`scripts/test-subscription-system.js`**
**Purpose**: Complete subscription workflow testing
**Usage**: `node scripts/test-subscription-system.js`
**Features**:
- Subscription lifecycle testing
- Payment flow validation
- Plan upgrade/downgrade testing
- Usage limit enforcement verification

#### **`scripts/test-subscription-fixed.js`**
**Purpose**: Subscription system bug fixes validation
**Usage**: `node scripts/test-subscription-fixed.js`
**Features**:
- Fixed subscription logic testing
- Edge case validation
- Error condition handling
- Integration consistency checking

#### **`scripts/analyze-billing-system.js`**
**Purpose**: Billing system analysis and health monitoring
**Usage**: `node scripts/analyze-billing-system.js`
**Features**:
- Billing state consistency checking
- Payment method validation
- Subscription status analysis
- Revenue tracking accuracy
- Stripe integration verification

### 📧 Trial & Email System

#### **`scripts/verify-email-trial-system.js`**
**Purpose**: Email automation system testing for trial workflows
**Usage**: `node scripts/verify-email-trial-system.js`
**Features**:
- Email template validation
- Scheduling system testing
- Trial sequence verification
- Email delivery confirmation
- Template rendering testing

#### **`scripts/verify-trial-ui.js`**
**Purpose**: Trial user interface component testing
**Usage**: `node scripts/verify-trial-ui.js`
**Features**:
- Trial countdown display validation
- UI component consistency
- State synchronization testing
- Frontend-backend integration

#### **`scripts/complete-onboarding-and-activate-plan.js`**
**Purpose**: Automated onboarding completion and plan activation
**Usage**: `node scripts/complete-onboarding-and-activate-plan.js`
**Features**:
- Automated onboarding flow completion
- Plan activation without payment
- Development environment setup
- User state synchronization

---

## Admin & System Management

### 🔧 Admin Utilities

#### **`scripts/migrate-admin-roles.js`**
**Purpose**: Admin role migration and management
**Usage**: `node scripts/migrate-admin-roles.js`
**Features**:
- Admin role assignment/revocation
- Permission level management
- Role hierarchy establishment
- Admin access verification

#### **`clean-all-test-data.js`** *(root)*
**Purpose**: Remove all test data from production database
**Usage**: `node clean-all-test-data.js`
**Features**:
- Test user identification and removal
- Test campaign data cleanup
- Test subscription removal
- Database integrity preservation

**⚠️ Production Use**: Exercise extreme caution in production environments.

### 🧹 Production Cleanup

#### **`scripts/cleanup-for-production.sh`**
**Purpose**: Production deployment preparation and cleanup
**Usage**: `./scripts/cleanup-for-production.sh`
**Features**:
- Test infrastructure removal
- Development-only file cleanup
- Environment variable guidance
- Production verification checklist
- Database cleanup instructions

**Production Checklist**:
- Remove test user data
- Update environment variables (Stripe live keys, production DB)
- Verify route accessibility
- Test production signup flow

---

## Specialized Development Scripts

### 🔍 Data Analysis Scripts

#### **Root Level Analysis Scripts**:
- **`test-instagram-basic.js`**: Instagram API basic functionality
- **`test-instagram-reels-api.js`**: Instagram Reels API testing
- **`test-instagram-structure-analysis.js`**: API response structure analysis
- **`test-parsing-comparison.js`**: Data parsing method comparison
- **`test-api-unit-economics.js`**: API cost and usage analysis
- **`test-unit-economics-direct.js`**: Direct unit economics calculation

#### **Research & Development**:
- **`/test-scripts/youtube-similar-research/`**: YouTube similar search research
- **`/test-scripts/youtube-similar-api-research/`**: YouTube API research

### 🛠️ Utility Functions

#### **Data Cleanup Scripts**:
- **`clean-test-subscription.js`** *(root)*: Test subscription cleanup
- **`fix-stripe-subscription.js`** *(root)*: Stripe subscription repair
- **`fix-test-subscription-issue.js`** *(root)*: Test subscription issue resolution

#### **Quick Testing Scripts**:
- **`quick-500-test.js`** *(root)*: 500-error reproduction testing
- **`test-security-fix.js`** *(root)*: Security patch validation

---

## Common Usage Patterns

### 🔄 Daily Development Workflow

```bash
# 1. Start development environment
npm run dev:wt2                    # Worktree-specific development
./scripts/setup-local-db.sh        # First-time local DB setup

# 2. User management during development
npm run find-user-id               # Find test user
npm run reset-user                 # Reset test user state
node scripts/list-users.js         # Check user states

# 3. API testing and validation
node scripts/check-env.js           # Verify API keys
node scripts/test-all-searches.js  # Test all search endpoints
node scripts/benchmark-performance.js  # Performance monitoring

# 4. Database normalization testing (NEW)
node run-all-tests.js              # Complete testing framework
tsx test-normalized-database.ts    # Database schema verification
tsx test-api-endpoints.ts          # API endpoint testing

# 5. Database operations
npm run db:studio:local            # Visual database management
node scripts/analyze-database.js   # Database health check
npm run db:seed:plans             # Refresh subscription plans
```

### 🧪 Testing & Quality Assurance

```bash
# NEW: Master testing framework (complete system verification)
node run-all-tests.js                       # Complete 4-suite testing framework
tsx test-normalized-database.ts             # Database normalization verification  
tsx test-api-endpoints.ts                   # API integration testing
node test-migration.js                      # Database migration safety
node verify-refactor.js                     # End-to-end system validation

# Comprehensive testing sequence
node scripts/test-all-searches.js           # All 6 search combinations
node test-complete-flow.js                  # End-to-end workflow
node validate-test-results.js              # Result validation
node scripts/benchmark-performance.js       # Performance verification

# Individual platform testing
node run-tiktok-test.js                     # TikTok functionality
node scripts/quick-test-instagram-apis.js   # Instagram APIs
node scripts/test-subscription-system.js   # Billing system

# Data quality and cleanup
node scripts/analyze-search-data.js         # Search quality analysis
node clean-all-test-data.js                # Test data cleanup (with caution)
```

### 🚀 Production Deployment

```bash
# Pre-deployment preparation
./scripts/cleanup-for-production.sh         # Remove test infrastructure
node scripts/analyze-billing-system.js     # Verify billing system health
node scripts/analyze-database.js           # Database integrity check

# Environment preparation
node scripts/check-env.js                  # Environment validation
./setup-testing-environment.sh             # Staging environment setup

# Post-deployment verification
node scripts/test-subscription-system.js   # Verify billing functionality
node scripts/verify-email-trial-system.js  # Verify email automation
```

### 🔧 User Support & Administration

```bash
# User troubleshooting
npm run find-user-id                       # Locate user account
node scripts/inspect-user-state.js         # Analyze user issues
node scripts/fix-user-billing-state.js     # Fix billing inconsistencies

# User management actions
node scripts/reset-user-to-fresh-state.js  # Fresh user reset (destructive)
node scripts/start-trial-for-existing-user.js  # Manual trial activation
node scripts/copy-trial-to-current-user.js # Clone trial configuration

# Administrative tasks
node scripts/migrate-admin-roles.js        # Admin role management
node scripts/delete-duplicate-users.js     # Cleanup duplicates
node scripts/list-users.js                 # User overview
```

---

## Safety Guidelines & Best Practices

### ⚠️ Destructive Operations

**High-Risk Scripts** (require extreme caution):
- `scripts/delete-user-completely.js` - Permanent user data deletion
- `scripts/reset-user-to-fresh-state.js` - Complete user data reset
- `clean-all-test-data.js` - Test data removal
- `scripts/cleanup-for-production.sh` - Production cleanup

**Safety Practices**:
1. **Always backup before destructive operations**
2. **Test scripts in development/staging first**
3. **Verify target user/environment before execution**
4. **Read script confirmation prompts carefully**

### 🔐 Environment Security

**Environment Best Practices**:
- Use `.env.local` for development secrets
- Never commit API keys or database URLs
- Use separate testing environments for experiments
- Validate environment setup with `scripts/check-env.js`

### 📋 Script Dependencies

**Common Dependencies**:
- Node.js 18+ required for all JavaScript scripts
- Bash shell for `.sh` scripts (Unix/macOS/WSL)
- Docker for local database scripts
- Supabase CLI for database management scripts
- Active internet connection for API testing scripts

**Package Requirements**:
```json
"drizzle-orm": "Database ORM operations"
"postgres": "PostgreSQL connectivity"
"dotenv": "Environment variable loading"
"node-fetch": "API testing and HTTP requests"
```

---

## Troubleshooting & Support

### 🔍 Common Issues

**Database Connection Problems**:
```bash
node scripts/test-local-db.js       # Test database connectivity
./scripts/setup-local-db.sh         # Reinitialize local database
node scripts/check-env.js           # Verify database URL
```

**API Integration Issues**:
```bash
node scripts/check-env.js           # Verify API keys
node scripts/test-all-searches.js   # Test API endpoints
node scripts/api-logger.js          # Monitor API calls
```

**User State Inconsistencies**:
```bash
node scripts/inspect-user-state.js  # Analyze user state
node scripts/fix-user-billing-state.js  # Fix billing issues
npm run find-user-id                # Locate user accounts
```

**Performance Issues**:
```bash
node scripts/benchmark-performance.js  # Measure performance
node scripts/analyze-search-data.js    # Analyze search performance
node scripts/test-db-performance.js    # Database performance
```

### 📞 Script Support

**Getting Help**:
1. Check script headers for usage instructions
2. Run scripts with `--help` flag when available
3. Review environment requirements in script comments
4. Test in development environment before production use

**Contributing New Scripts**:
1. Add comprehensive header comments with purpose and usage
2. Include error handling and validation
3. Document dependencies and environment requirements
4. Add logging for troubleshooting
5. Update this documentation with script details

---

*Last Updated: 2025-09-27*
*Script Count: 85+ development and operational utilities*
*NEW: Database Normalization & Testing Framework with 1500+ lines of test code + Platform Testing Framework with 600+ lines of platform-specific tests*
*ENHANCED: Migration scripts updated for normalized table support*
*Maintained by: Development Team*