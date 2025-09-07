# 🔧 Scripts & Utilities Documentation - Influencer Platform

## Overview

The influencer platform includes a comprehensive suite of development scripts, automation tools, and utilities designed to streamline database management, user administration, testing, monitoring, and deployment workflows. These scripts are organized across the root directory and `/scripts` folder, providing essential development and operational capabilities.

**Total Scripts**: 60+ utility scripts and tools
**Categories**: Database Management, User Administration, API Testing, Performance Monitoring, Development Tools, Production Deployment

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

# 4. Database operations
npm run db:studio:local            # Visual database management
node scripts/analyze-database.js   # Database health check
npm run db:seed:plans             # Refresh subscription plans
```

### 🧪 Testing & Quality Assurance

```bash
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

*Last Updated: 2024-09-07*
*Script Count: 60+ development and operational utilities*
*Maintained by: Development Team*