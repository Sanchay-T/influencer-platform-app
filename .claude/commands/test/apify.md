---
description: Test Apify Instagram integration and actors
argument-hint: [keyword]
allowed-tools: Bash(node:*/test-apify*.js*)
---

# Test Apify Integration

Test Apify Instagram actors and integration. Validates Apify-specific functionality and data extraction.

## Arguments

- `$1`: **[Optional]** Keyword to test (uses default if not provided)

## Execution

Run the Apify test:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/test-apify-instagram-correct.js ${1:-}
```

## Output Analysis

Report:

1. **Apify Connection**:
   - API key validated
   - Actor availability
   - Connection status

2. **Actor Execution**:
   - Actor started successfully
   - Run ID
   - Execution time
   - Status (running/succeeded/failed)

3. **Results Retrieved**:
   - Number of results
   - Data structure validation
   - Required fields present

4. **Data Quality**:
   - Usernames extracted
   - Profile data completeness
   - Follower counts accuracy
   - Bio and description quality
   - Media URLs validity

5. **Performance Metrics**:
   - Queue time
   - Execution time
   - Total time
   - Cost in Apify credits

6. **Actor-Specific Info**:
   - Actor ID and version
   - Input configuration
   - Output dataset ID
   - Memory usage

## Example Usage

```
/test/apify
/test/apify fitness
/test/apify yoga
```

## Apify Actors Tested

- **Instagram Profile Scraper**: Extract profile data
- **Instagram Hashtag Scraper**: Search by hashtag
- **Instagram Post Scraper**: Get post details
- **Instagram Reels Scraper**: Extract Reels content

## What This Tests

- Apify API authentication
- Actor availability and versions
- Input parameter handling
- Data extraction accuracy
- Error handling and retries
- Cost tracking
- Rate limiting compliance

## Success Criteria

- Actor runs to completion
- Results count > 0
- All required fields populated
- Data quality score > 80%
- Execution time reasonable
- Cost within budget

## Common Issues

### Issue 1: Actor Failed
**Solution**: Check actor status on Apify dashboard, verify input parameters

### Issue 2: No Results Returned
**Solution**: Verify keyword is valid, check actor configuration

### Issue 3: Timeout Errors
**Solution**: Increase timeout, check actor performance settings

### Issue 4: High Cost
**Solution**: Review actor settings, consider using cheaper alternatives

### Issue 5: Rate Limited
**Solution**: Check Apify account limits and usage

## Apify-Specific Debugging

Check Apify dashboard:
- Run history and logs
- Actor performance metrics
- Credit usage
- Failed run details

## Cost Monitoring

Typical costs per actor run:
- Profile scraper: 0.01-0.05 credits
- Hashtag scraper: 0.1-0.5 credits
- Post scraper: 0.05-0.2 credits

## Related Commands

- `/test/instagram <keyword>` - Compare Apify vs other providers
- `/test/all-searches` - Test all platforms including Apify
- `/dev/check-env` - Verify APIFY_API_KEY configured
