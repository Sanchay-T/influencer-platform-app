# 🔍 Diagnostic Report: MASTER_CSV Error

**Date:** 2025-10-16
**Error:** `ReferenceError: MASTER_CSV is not defined`
**Location:** `/us-reels-agent/src/storage/master-merger.ts:84`
**Environment:** Vercel Production (Serverless)

---

## 📊 Investigation Summary

### **7 Possible Sources Analyzed:**

1. ✅ **Undefined Variable Usage** - **PRIMARY ROOT CAUSE**
2. ✅ **Module Bundling Difference (Dev vs Prod)** - **SECONDARY FACTOR**
3. ⚠️ **Tree-Shaking/Dead Code Elimination** - Possible contributor
4. ❌ **Scope/Hoisting Issue** - Not applicable (ES modules)
5. ❌ **Missing Export/Import Chain** - Correct diagnosis, but variable never existed
6. ❌ **Environment Variable Mix-up** - Not the case
7. ❌ **TypeScript Transpilation Issue** - Not relevant

---

## 🎯 Root Cause (Distilled to Most Likely):

### **1. Undefined Variable Reference (Primary)**
- **Line 84** in `master-merger.ts`: `` log.success(`Master CSV updated: ${MASTER_CSV}`); ``
- **`MASTER_CSV` is NEVER defined** in the file
- No import, no declaration, no environment variable

### **2. Code Refactoring Artifact (Context)**
Based on documentation and shell scripts in `us-reels-agent/`:
- **Original Design:** Used physical file `data/master.csv`
- **Current Implementation:** Uses in-memory `Map<string, ReelRow>` (no file)
- **Leftover Code:** The log message was never updated during refactoring

### **Evidence:**
```typescript
// OLD PATTERN (from docs/scripts):
// MASTER_CSV = 'data/master.csv' (file-based)

// NEW PATTERN (actual code):
const masterRowsMap = new Map<string, ReelRow>(); // in-memory

// LEFTOVER BUG:
log.success(`Master CSV updated: ${MASTER_CSV}`); // ❌ Variable doesn't exist
```

---

## 🔬 Diagnostic Logs Added

### **Module Load Check:**
```typescript
// At top of master-merger.ts
console.log('[US_REELS][DIAGNOSTIC] master-merger.ts loaded');
console.log('[US_REELS][DIAGNOSTIC] typeof MASTER_CSV:', typeof (globalThis as any).MASTER_CSV);
console.log('[US_REELS][DIAGNOSTIC] process.env check:', {
  US_REELS_AGENT_DATA_DIR: process.env.US_REELS_AGENT_DATA_DIR,
  hasMasterCsvEnv: !!process.env.MASTER_CSV
});
```

### **Runtime Check:**
```typescript
// Before the error line
console.log('[US_REELS][DIAGNOSTIC] About to log success with MASTER_CSV');
console.log('[US_REELS][DIAGNOSTIC] Current scope has MASTER_CSV?', typeof MASTER_CSV);
console.log('[US_REELS][DIAGNOSTIC] sessionCsvPath was:', sessionCsvPath);
```

### **Temporary Fix Applied:**
```typescript
// COMMENTED OUT problematic line
// log.success(`Master CSV updated: ${MASTER_CSV}`);

// TEMPORARY replacement
log.success(`Master CSV updated in memory (${finalRows.length} rows) - session: ${sessionCsvPath}`);
```

---

## 🧪 Validation Steps

### **Deploy and Monitor:**
1. Deploy this branch to Vercel
2. Run an Instagram US Reels search for "airpods pro"
3. Check Vercel function logs for:
   - `[US_REELS][DIAGNOSTIC]` messages
   - Whether the error still occurs
   - What `typeof MASTER_CSV` returns

### **Expected Results:**
- ✅ `typeof MASTER_CSV` will be `"undefined"`
- ✅ No environment variable `MASTER_CSV` exists
- ✅ The temporary fix prevents the error
- ✅ Confirms our hypothesis that it's simply an undefined variable

---

## 🛠️ Proposed Permanent Fix

Once validated, the permanent fix is straightforward:

### **Option 1: Remove the Reference (Recommended)**
```typescript
// Since master CSV is now in-memory, just log the statistics
log.success(`Master CSV updated in memory (${finalRows.length} rows)`);
```

### **Option 2: Define the Constant (If file path is needed)**
```typescript
// At top of file
const MASTER_CSV_PATH = 'data/master.csv'; // For reference only (not used)

// In log message
log.success(`Master CSV updated in memory (${finalRows.length} rows, originally from ${MASTER_CSV_PATH})`);
```

### **Option 3: Use Environment Variable**
```typescript
// If this should be configurable
const MASTER_CSV = process.env.US_REELS_MASTER_CSV || 'data/master.csv';
```

---

## 📈 Why It Works in Development but Fails in Production

### **Development (Local):**
- Might use cached builds
- Webpack dev server has looser error handling
- TypeScript might suppress or cache past runtime errors
- The log line might not execute in dev due to different code paths

### **Production (Vercel):**
- Fresh build with strict bundling
- Serverless functions have stricter error handling
- All code paths execute, including the problematic log line
- ES module strict mode catches undefined variables immediately

---

## ✅ Next Steps

1. **Deploy with diagnostic logs** ✅ (Current status)
2. **Monitor Vercel logs** for diagnostic output
3. **Validate hypothesis** by checking typeof results
4. **Apply permanent fix** once confirmed
5. **Remove diagnostic logs** after validation

---

## 📝 Lessons Learned

1. **Always update log messages during refactoring** - Leftover references to old implementations cause production errors
2. **Dev/prod parity matters** - Code that works in development can fail in production due to bundling differences
3. **Undefined variable references** - ES modules have strict scoping; always define variables before use
4. **Diagnostic logging is crucial** - Before fixing, validate assumptions with strategic logging

---

**Status:** ✅ Diagnostic logs added, temporary fix in place, ready for deployment validation
