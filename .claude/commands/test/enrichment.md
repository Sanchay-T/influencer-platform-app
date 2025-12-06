---
description: Test creator enrichment API and data quality
argument-hint: <username>
allowed-tools: Bash(node:*/test-enrichment*.js*)
---

# Test Enrichment API

Test the creator enrichment API by enriching a specific Instagram username. Validates enrichment data quality and API functionality.

## Arguments

- `$1`: **[Optional]** Instagram username to enrich (uses default test username if not provided)

## Execution

Run the enrichment test:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/test-enrichment-api.js ${1:-}
```

## Output Analysis

Report:

1. **API Response**:
   - HTTP status code
   - Response time
   - Success/error status

2. **Enriched Data Quality**:
   - **Profile Data**:
     - Full name
     - Bio/description
     - Profile picture URL
     - Verified status

   - **Audience Metrics**:
     - Follower count
     - Following count
     - Post count
     - Engagement rate

   - **Content Analysis**:
     - Recent posts analyzed
     - Content categories
     - Posting frequency
     - Average likes/comments

   - **Additional Insights**:
     - Estimated reach
     - Audience demographics
     - Brand affinity scores
     - Contact information

3. **Data Completeness**:
   - Fields populated vs expected
   - Missing data points
   - Data quality score (0-100)

4. **Performance Metrics**:
   - Enrichment time
   - API latency
   - Cost per enrichment

## Example Usage

```
/test/enrichment
/test/enrichment cristiano
/test/enrichment natgeo
```

## What This Tests

- Enrichment API connectivity
- Data extraction accuracy
- Response format compliance
- Error handling
- Rate limiting behavior
- Cost tracking

## Success Criteria

- API returns 200 OK
- All required fields present
- Data quality score > 85%
- Response time < 5 seconds
- Cost within expected range

## Common Issues

### Issue 1: API Key Invalid
**Solution**: Check ENRICHMENT_API_KEY with `/dev/check-env`

### Issue 2: Username Not Found
**Solution**: Verify username exists on Instagram

### Issue 3: Rate Limited
**Solution**: Wait and retry, check rate limit headers

### Issue 4: Incomplete Data
**Solution**: Check if account is private or has limited data

## Related Commands

- `/test/instagram <keyword>` - Test search before enrichment
- `/api/test creators/enrich` - Test enrichment endpoint
- `/dev/check-env` - Verify enrichment API credentials
