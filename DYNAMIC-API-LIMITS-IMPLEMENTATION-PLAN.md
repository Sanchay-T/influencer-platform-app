# 🎯 Dynamic API Limits Implementation Plan
## Based on Real Unit Economics Data Analysis

### 📊 **Key Findings from Unit Economics Analysis**

| Platform + Search | Creators/Call | Calls for 100 | Calls for 500 | Calls for 1000 | Efficiency |
|-------------------|---------------|----------------|----------------|-----------------|------------|
| **TikTok Keyword** | 25 | 4 | 20 | 40 | 100% |
| **Instagram Reels** | 37 | 3 | 14 | 28 | 74% |
| **TikTok Similar** | 10 | 10 | 50 | 100 | 83% filtered |
| **YouTube Keyword** | 20 | 5 | 25 | 50 | 100% |

### 🚨 **Critical Issues Identified**

1. **TikTok Similar Search**: Needs 100+ API calls for 1000 creators (exceeds reasonable limits)
2. **All platforms**: Currently limited to 1 API call in testing, severely limiting results
3. **Production gap**: Frontend slider promises 100-1000 creators, but testing only delivers 10-37

---

## 🛠️ **Implementation Strategy**

### **Phase 1: Create Dynamic API Calculator**

```javascript
// lib/utils/api-limits.js
export function calculateApiCallLimit(targetResults, platform, searchType, mode = process.env.API_MODE) {
  // Unit economics data from actual testing
  const PLATFORM_EFFICIENCY = {
    'TikTok_keyword': { creatorsPerCall: 25, maxCalls: 40 },
    'Instagram_reels': { creatorsPerCall: 37, maxCalls: 28 },
    'TikTok_similar': { creatorsPerCall: 10, maxCalls: 50 }, // Capped due to inefficiency
    'YouTube_keyword': { creatorsPerCall: 20, maxCalls: 50 },
    'Instagram_similar': { creatorsPerCall: 35, maxCalls: 30 }, // Estimated
    'YouTube_similar': { creatorsPerCall: 15, maxCalls: 50 }   // Estimated
  };
  
  if (mode === 'development') {
    return 1; // Single call for testing flow
  }
  
  const key = `${platform}_${searchType}`;
  const efficiency = PLATFORM_EFFICIENCY[key];
  
  if (!efficiency) {
    console.warn(`Unknown platform combination: ${key}`);
    return Math.min(Math.ceil(targetResults / 20), 25); // Conservative fallback
  }
  
  const calculatedCalls = Math.ceil(targetResults / efficiency.creatorsPerCall);
  const finalCalls = Math.min(calculatedCalls, efficiency.maxCalls);
  
  console.log(`🔢 [API-LIMITS] ${key}: ${targetResults} creators → ${calculatedCalls} calls → ${finalCalls} (capped)`);
  
  return finalCalls;
}
```

### **Phase 2: Update Environment Configuration**

**Add to `.env.local` (Development):**
```bash
API_MODE=development
NODE_ENV=development
```

**Add to Production Environment:**
```bash
API_MODE=production
NODE_ENV=production
```

### **Phase 3: Update Platform Handlers**

#### **1. Instagram Similar Handler** (`lib/platforms/instagram-similar/handler.ts`)
```javascript
// BEFORE: const MAX_API_CALLS_FOR_TESTING = 1;
// AFTER:
import { calculateApiCallLimit } from '@/lib/utils/api-limits';
const MAX_API_CALLS = calculateApiCallLimit(job.targetResults, 'Instagram', 'similar');
```

#### **2. YouTube Handler** (`lib/platforms/youtube/handler.ts`)
```javascript
// BEFORE: const MAX_API_CALLS_FOR_TESTING = 1;  
// AFTER:
import { calculateApiCallLimit } from '@/lib/utils/api-limits';
const MAX_API_CALLS = calculateApiCallLimit(job.targetResults, 'YouTube', 'keyword');
```

#### **3. YouTube Similar Handler** (`lib/platforms/youtube-similar/handler.ts`)
```javascript
// BEFORE: const MAX_API_CALLS_FOR_TESTING = 10;
// AFTER:
import { calculateApiCallLimit } from '@/lib/utils/api-limits';
const MAX_API_CALLS = calculateApiCallLimit(job.targetResults, 'YouTube', 'similar');
```

#### **4. TikTok Similar Handler** (Already uses SystemConfig - enhance it)
```javascript
// ENHANCE EXISTING: 
const MAX_API_CALLS_FOR_TESTING = await SystemConfig.get('api_limits', 'max_api_calls_tiktok_similar');
// ADD FALLBACK:
const fallbackLimit = calculateApiCallLimit(job.targetResults, 'TikTok', 'similar');
const MAX_API_CALLS = MAX_API_CALLS_FOR_TESTING || fallbackLimit;
```

### **Phase 4: Update Main QStash Processor**

**Enhance existing SystemConfig approach:**
```javascript
// app/api/qstash/process-scraping/route.ts
const MAX_API_CALLS_FOR_TESTING = await SystemConfig.get('api_limits', 'max_api_calls_for_testing');

// ADD: Fallback to dynamic calculation if SystemConfig not available
if (!MAX_API_CALLS_FOR_TESTING || process.env.API_MODE === 'production') {
  // Extract platform and search type from job
  const platform = job.platform;
  const searchType = job.targetUsername ? 'similar' : 'keyword'; // Infer from job structure
  const dynamicLimit = calculateApiCallLimit(job.targetResults, platform, searchType);
  
  const FINAL_API_LIMIT = MAX_API_CALLS_FOR_TESTING || dynamicLimit;
  console.log('🔧 [API-LIMITS] Using limit:', FINAL_API_LIMIT, 'for', job.targetResults, 'target results');
}
```

---

## 📈 **Expected Behavior After Implementation**

### **Development Mode (`API_MODE=development`):**
- **All searches**: 1 API call only
- **Results**: 10-37 creators (enough to test UI/flow)
- **Purpose**: Fast development iteration

### **Production Mode (`API_MODE=production`):**

#### **Frontend Slider: 100 Creators**
- TikTok Keyword: 4 API calls → ~100 creators ✅
- Instagram Reels: 3 API calls → ~111 creators ✅  
- TikTok Similar: 10 API calls → ~100 creators ✅
- YouTube Keyword: 5 API calls → ~100 creators ✅

#### **Frontend Slider: 500 Creators**
- TikTok Keyword: 20 API calls → ~500 creators ✅
- Instagram Reels: 14 API calls → ~518 creators ✅
- TikTok Similar: 50 API calls → ~500 creators ✅ (capped)
- YouTube Keyword: 25 API calls → ~500 creators ✅

#### **Frontend Slider: 1000 Creators**
- TikTok Keyword: 40 API calls → ~1000 creators ✅
- Instagram Reels: 28 API calls → ~1036 creators ✅
- TikTok Similar: 50 API calls → ~500 creators ⚠️ (limited due to efficiency)
- YouTube Keyword: 50 API calls → ~1000 creators ✅

---

## 🚨 **Special Handling for TikTok Similar Search**

**Problem**: Needs 100+ calls for 1000 creators (too expensive)

**Solutions**:
1. **Cap at 50 calls** → delivers ~500 creators max
2. **Add UI warning** for TikTok Similar at 1000 creator selection
3. **Suggest alternative** (TikTok Keyword) for high volume needs

**Frontend Enhancement**:
```javascript
// In keyword-search-form.jsx
if (selectedPlatform === 'tiktok' && searchType === 'similar' && creatorsCount === 1000) {
  showWarning('TikTok Similar search is optimized for up to 500 creators. Consider TikTok Keyword search for 1000+ creators.');
}
```

---

## 🎯 **Implementation Priority**

### **High Priority** (Immediate):
1. ✅ Create `lib/utils/api-limits.js` calculator
2. ✅ Add `API_MODE` environment variable
3. ✅ Update Instagram Similar handler (currently hard-coded to 1)
4. ✅ Update YouTube handlers (currently hard-coded to 1 & 10)

### **Medium Priority** (This week):
5. ✅ Enhance TikTok Similar with fallback logic
6. ✅ Update main QStash processor with mode detection
7. ✅ Add TikTok Similar UI warning for 1000 creators

### **Low Priority** (Future):
8. ⭕ Add SystemConfig entries for all platforms
9. ⭕ Create admin dashboard for API limit management
10. ⭕ Add cost calculation and usage tracking

---

## 📊 **Cost Analysis Based on Real Data**

**API Call Costs** (estimated based on our current usage):

| Slider Value | TikTok Keyword | Instagram Reels | YouTube Keyword | TikTok Similar |
|-------------|----------------|-----------------|-----------------|----------------|
| **100 creators** | 4 calls | 3 calls | 5 calls | 10 calls |
| **500 creators** | 20 calls | 14 calls | 25 calls | 50 calls |
| **1000 creators** | 40 calls | 28 calls | 50 calls | 50 calls* |

*\*TikTok Similar capped at 50 calls (delivers ~500 creators)*

**Monthly Usage Example** (100 searches):
- Current (testing): 100 API calls total
- Production (mixed usage): ~2,000-5,000 API calls per month

---

## ✅ **Success Metrics**

### **Development:**
- ✅ All searches complete with 1 API call
- ✅ UI flows work correctly
- ✅ Bio/email enhancement visible

### **Production:**
- ✅ Frontend slider values match actual results delivered
- ✅ No more "only getting 25 creators for 1000 slider" issues
- ✅ Reasonable API usage costs
- ✅ All platforms respect their efficiency characteristics

---

## 🚀 **Ready to Implement**

This plan is based on **real unit economics data** and provides:
1. **Immediate solution** for dev vs prod API limits
2. **Data-driven calculations** based on actual efficiency rates
3. **Cost-conscious approach** with reasonable caps
4. **Scalable architecture** for future platform additions

**Next step**: Begin implementation starting with the API calculator utility. 🎯