---
description: Test all platform search endpoints comprehensively
argument-hint:
allowed-tools: Bash(node:*/test-all-searches*.js*)
---

# Test All Search Platforms

Run comprehensive tests across all search platform integrations (Instagram, YouTube, TikTok, etc.). Validates all search providers are working correctly.

## Arguments

None required. Tests all platforms with predefined keywords.

## Execution

Run the comprehensive search test:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/test-all-searches.js
```

## Output Analysis

Parse and report:

1. **Overall Summary**:
   - Total platforms tested
   - Platforms passing
   - Platforms failing
   - Total execution time
   - Total cost

2. **Per Platform Results**:

   **For Each Platform (Instagram, YouTube, TikTok, Twitter):**

   - Platform name
   - Status (PASS/FAIL)
   - Execution time
   - Cost
   - Creators found
   - Data quality score

3. **Detailed Metrics**:
   - Response times by platform
   - Cost breakdown
   - Results count comparison
   - Quality scores

4. **Issues Detected**:
   - Failed platforms
   - Slow platforms (>30s)
   - Low quality results (<70%)
   - High cost outliers

5. **Recommendations**:
   - Platforms needing attention
   - Configuration updates needed
   - Performance optimizations

## Example Usage

```
/test/all-searches
```

## Test Coverage

Tests all platform integrations:
- Instagram (US Reels, Profile, Hashtag)
- YouTube (Channel search, Video search)
- TikTok (User search, Hashtag search)
- Twitter/X (User search, Topic search)

For each platform:
- Multiple search providers tested
- Various keyword types
- Edge cases (special characters, long keywords)
- Error handling

## Success Criteria

All platforms should:
- Return results within 30 seconds
- Have data quality score > 70%
- Cost per search < expected threshold
- Handle errors gracefully
- Return at least 10 results

## Performance Benchmarks

- **Fast**: < 10 seconds
- **Acceptable**: 10-30 seconds
- **Slow**: > 30 seconds (needs optimization)

## Common Issues

### Issue 1: Multiple Platforms Failing
**Solution**: Check network connectivity and base API configuration

### Issue 2: Specific Platform Failing
**Solution**: Verify platform-specific API keys with `/dev/check-env`

### Issue 3: Slow Performance
**Solution**: Review rate limiting and concurrent request settings

### Issue 4: High Costs
**Solution**: Check if premium providers being used unnecessarily

## When To Use

- Pre-deployment validation
- After provider configuration changes
- Monthly platform health checks
- Investigating search issues
- Performance regression testing

## Related Commands

- `/test/instagram <keyword>` - Test Instagram specifically
- `/test/apify` - Test Apify provider
- `/dev/check-env` - Verify all API keys
- `/api/test search/<platform>` - Test specific platform API
