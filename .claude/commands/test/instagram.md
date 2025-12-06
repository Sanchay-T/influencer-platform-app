---
description: Test Instagram search with keyword comparison across providers
argument-hint: <keyword>
allowed-tools: Bash(node:*/test-instagram-keyword*.js*), Read
---

# Test Instagram Search

Compare Instagram search results across different providers (Apify, ScrapeCreators, etc.) for a given keyword. Essential for validating search quality and provider performance.

## Arguments

- `$1`: **[Required]** Search keyword or hashtag (e.g., "fitness", "yoga", "#travel")

## Execution

Run the comparison test:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/test-instagram-keyword-comparison.js "$1"
```

## Output Analysis

Parse and report:

1. **Test Summary**:
   - Keyword tested
   - Providers tested
   - Execution time per provider
   - Total cost per provider

2. **Results Per Provider**:
   - Number of creators found
   - Data quality score
   - Response time
   - Cost per result
   - Success/failure status

3. **Quality Metrics**:
   - Username accuracy
   - Follower count accuracy
   - Bio completeness
   - Profile picture availability
   - Engagement rate data

4. **Provider Comparison**:
   - Best provider by quality
   - Fastest provider
   - Most cost-effective
   - Recommendations

5. **Sample Results**:
   - Show 3-5 example creators from each provider
   - Highlight differences in data quality

## Example Usage

```
/test/instagram fitness
/test/instagram yoga
/test/instagram "#travel"
```

## What This Tests

- **Provider Availability**: All configured providers responding
- **Data Quality**: Accuracy and completeness of results
- **Performance**: Response times and rate limiting
- **Cost**: API usage and costs per search
- **Consistency**: Similar results across providers

## Interpreting Results

### Success Indicators:
- All providers return results
- Data quality score > 80%
- Response time < 30 seconds
- No rate limit errors

### Warning Signs:
- Quality score < 70%
- High cost per result
- Slow response times
- Missing required fields

### Failure Indicators:
- Provider timeouts
- Authentication errors
- Empty result sets
- Malformed data

## Common Issues

### Issue 1: Rate Limiting
**Solution**: Reduce concurrent requests or add delays

### Issue 2: Empty Results
**Solution**: Verify keyword is valid and popular enough

### Issue 3: Provider Down
**Solution**: Check provider status and API keys with `/dev/check-env`

### Issue 4: Quality Score Low
**Solution**: Review data mapping and parsing logic

## Related Commands

- `/test/apify` - Test only Apify provider
- `/test/all-searches` - Test all platform searches
- `/api/test search/instagram-us-reels` - Test API endpoint directly
- `/dev/check-env` - Verify API keys configured
