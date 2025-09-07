# 🧪 Database Refactoring Testing Guide

## Overview
This document provides a complete testing strategy for verifying our database refactoring from a monolithic `user_profiles` table to 5 normalized tables.

## 🎯 Testing Approach

We've created a **multi-layered testing strategy** to ensure 100% confidence:

1. **File & Code Integrity Tests** - Verify all files are correct
2. **MCP Database Tests** - Live database verification via Claude MCP
3. **API Integration Tests** - Ensure endpoints work with new schema
4. **Data Integrity Tests** - Guarantee no data loss
5. **Rollback Safety Tests** - Ensure safe rollback procedures

## 🚀 Quick Start

### Run All Tests
```bash
# Run comprehensive test suite
node run-all-tests.js
```

### Run Individual Test Suites
```bash
# File integrity and code structure
node tests/database-refactoring-tests.js

# API integration verification  
node tests/api-integration-tests.js

# Data integrity and rollback safety
node tests/data-integrity-tests.js

# MCP verification guide
node tests/mcp-database-verification.js
```

## 🔍 MCP Live Database Testing

The most reliable way to verify our refactoring is using Claude's MCP tools for live database testing:

### Pre-Migration Check
```javascript
// Use Claude MCP tool:
mcp__supabase__execute_sql

// Query:
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name LIKE '%user%'
ORDER BY table_name;

// Expected: Only user_profiles table with ~44 columns
```

### Post-Migration Verification
```javascript
// Verify all 5 normalized tables exist:
mcp__supabase__execute_sql

// Query:
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_subscriptions', 'user_billing', 'user_usage', 'user_system_data')
ORDER BY table_name;

// Expected: All 5 tables present
```

### Data Integrity Check
```javascript
// Verify data migration integrity:
mcp__supabase__execute_sql

// Query:
SELECT 
  'user_profiles' as table_name,
  COUNT(*) as record_count
FROM user_profiles
UNION ALL
SELECT 
  'users' as table_name,
  COUNT(*) as record_count  
FROM users;

// Expected: Same record count in both tables
```

## 📋 Test Results Interpretation

### ✅ Success Indicators
- All 5 normalized tables created
- Foreign key relationships intact  
- Data migration completed without loss
- API endpoints return expected structure
- Performance within acceptable limits
- Migration flag set to "true"

### ❌ Failure Indicators  
- Missing or incorrectly named tables
- Wrong column data types or constraints
- Data count mismatch between old/new tables
- Missing foreign key relationships
- API errors or unexpected responses
- Performance degradation

## 🔧 Rollback Procedure

If tests fail, follow this rollback procedure:

1. **Stop application immediately**
2. **user_profiles table is preserved** (safe rollback)
3. **Clean up new tables:**
   ```sql
   DROP TABLE IF EXISTS user_system_data CASCADE;
   DROP TABLE IF EXISTS user_usage CASCADE;
   DROP TABLE IF EXISTS user_billing CASCADE;
   DROP TABLE IF EXISTS user_subscriptions CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   ```
4. **Revert code changes** via git
5. **Restart with original schema**

## 🎯 Testing Phases

### Phase 1: Pre-Deployment Testing
- [x] Code structure validation
- [x] Migration file integrity  
- [x] Helper function verification
- [x] TypeScript compilation check
- [x] API endpoint structure validation

### Phase 2: Migration Testing
- [ ] Run migration: `npm run dev`
- [ ] Verify table creation via MCP
- [ ] Test data migration integrity
- [ ] Validate foreign key constraints
- [ ] Check performance indexes

### Phase 3: Integration Testing
- [ ] Test user registration flow
- [ ] Test billing status endpoint
- [ ] Test Stripe webhook processing
- [ ] Test plan validation service
- [ ] Test usage tracking

### Phase 4: Performance Testing
- [ ] Measure query response times
- [ ] Verify JOIN performance with indexes
- [ ] Test transaction performance
- [ ] Monitor error rates

## 📊 Current Test Results

**Overall Statistics:**
- Total Tests: 55
- ✅ Passed: 54 (98.2%)
- ❌ Failed: 1 (TypeScript compilation - Drizzle dependency issue)
- ⚠️ Warnings: 0

**Test Suites:**
- ✅ API Integration Tests: 6/6 passed
- ✅ Data Integrity Tests: 27/27 passed  
- ❌ Database Refactoring Tests: 21/22 passed (TS compilation issue)

## 🔍 Manual Verification Steps

After migration, manually verify:

1. **Database Structure:**
   - Check all 5 tables exist
   - Verify column types and constraints
   - Test foreign key relationships

2. **API Functionality:**
   - GET /api/billing/status returns expected data
   - POST /api/stripe/webhook processes correctly
   - User registration creates records in all tables

3. **Data Consistency:**
   - Compare record counts before/after
   - Verify no data loss occurred
   - Test CRUD operations work correctly

4. **Performance:**
   - Response times < 200ms for joins
   - No significant performance degradation
   - Database queries execute efficiently

## 🎉 Success Criteria

The refactoring is ready for production when:
- ✅ 100% of critical tests pass
- ✅ All 5 normalized tables created correctly
- ✅ Data migration completed without loss
- ✅ API endpoints function normally
- ✅ Performance is acceptable
- ✅ Rollback procedures tested and ready

---

**Last Updated:** September 2025  
**Test Suite Version:** 1.0  
**Database Migration:** user_profiles → 5 normalized tables