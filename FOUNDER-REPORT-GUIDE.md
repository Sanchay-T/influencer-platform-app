# 📊 Founder Usage Report - Quick Reference Guide

## 🚀 Quick Start

Generate the comprehensive usage report with a single command:

```bash
npm run report:founder
```

This will generate **7 CSV files** in your project root directory, ready to open in Excel or Google Sheets.

---

## 📁 Generated Files

### 1. **`founder-report-executive-summary.csv`**
**Purpose**: High-level metrics for quick overview

**Key Metrics**:
- Total users and active users
- Campaign and job statistics
- Total creators discovered
- Trial conversion rate
- Platform usage breakdown
- Average metrics (campaigns per user, creators per campaign)

**Use Case**: Board meetings, investor updates, executive dashboards

---

### 2. **`founder-report-users.csv`**
**Purpose**: Complete user database with engagement metrics

**Columns**:
- User identification (email, name, business)
- Current plan and trial status
- Subscription status
- Onboarding completion
- Activity metrics (campaigns, creators, lists)
- Last activity date

**Use Case**: User segmentation, retention analysis, customer support

---

### 3. **`founder-report-campaigns.csv`**
**Purpose**: All search campaigns with performance data

**Columns**:
- Campaign details (name, type, status)
- Job statistics (total, completed)
- Creator discovery metrics
- Creation and update timestamps

**Use Case**: Campaign performance analysis, search quality assessment

---

### 4. **`founder-report-jobs.csv`**
**Purpose**: Detailed job execution data

**Columns**:
- Job configuration (platform, search type, keywords)
- Progress tracking (status, processed results, target)
- Performance metrics (duration, completion rate)
- Timestamps (created, completed)

**Use Case**: System performance monitoring, API usage tracking

---

### 5. **`founder-report-lists.csv`**
**Purpose**: Creator list management and engagement

**Columns**:
- List metadata (name, type)
- Engagement metrics (items, collaborators, exports)
- Ownership information
- Activity timestamps

**Use Case**: Feature adoption analysis, collaboration metrics

---

### 6. **`founder-report-platform-breakdown.csv`**
**Purpose**: Platform-specific performance comparison

**Platforms**: TikTok, Instagram, YouTube

**Metrics per Platform**:
- Total jobs executed
- Success rate
- Average creators per job
- Total creators discovered

**Use Case**: Platform ROI analysis, resource allocation decisions

---

### 7. **`founder-report-trial-funnel.csv`**
**Purpose**: Trial system performance and conversion metrics

**Metrics**:
- Signup → Trial conversion rate
- Active vs expired trials
- Trial → Paid conversion rate
- Average days to conversion

**Use Case**: Growth strategy, trial optimization, revenue forecasting

---

## 🎯 Common Analysis Workflows

### **User Growth Analysis**
1. Open `founder-report-users.csv`
2. Sort by `signupDate` descending
3. Create pivot table by `signupDate` and `currentPlan`
4. Visualize user growth over time

### **Platform Performance Comparison**
1. Open `founder-report-platform-breakdown.csv`
2. Compare `successRate` and `avgCreatorsPerJob` across platforms
3. Identify best-performing platform
4. Allocate resources accordingly

### **Trial Conversion Optimization**
1. Open `founder-report-trial-funnel.csv`
2. Review `conversionRate` and `avgDaysToConversion`
3. Cross-reference with `founder-report-users.csv` for cohort analysis
4. Identify conversion blockers

### **Campaign Quality Assessment**
1. Open `founder-report-campaigns.csv`
2. Calculate completion rate: `completedJobs / jobCount`
3. Analyze `totalCreators` distribution
4. Identify high-performing campaign patterns

---

## 📈 Key Metrics Definitions

### **Active Users**
Users with at least one of:
- Active or converted trial status
- Active subscription
- Created at least one campaign

### **Success Rate**
Percentage of jobs that completed successfully (status = 'completed')

### **Trial Conversion Rate**
`(Converted Trials / Started Trials) * 100`

### **Avg Creators Per Campaign**
`Total Creators Discovered / Completed Campaigns`

---

## 🔧 Technical Details

### **Database Connection**
- **Read-only** connection to production database
- **Single connection** for safety (no concurrent load)
- **Automatic cleanup** after report generation

### **Data Freshness**
- Report pulls **real-time data** from production database
- Timestamp included in executive summary
- Run report daily/weekly for trend analysis

### **Error Handling**
- Graceful handling of empty tables
- Missing data displayed as `N/A` or `null`
- Detailed error messages in console

---

## 💡 Tips for Excel/Google Sheets

### **Excel Tips**
1. **Enable CSV Import Wizard**: Data → From Text/CSV
2. **Auto-format Numbers**: Select column → Format → Number
3. **Create Pivot Tables**: Insert → PivotTable
4. **Charts**: Highlight data → Insert → Chart

### **Google Sheets Tips**
1. **Import CSVs**: File → Import → Upload
2. **Connect Multiple Sheets**: Use `VLOOKUP` or `IMPORTRANGE`
3. **Auto-refresh**: Use Google Sheets API for scheduled updates
4. **Share Reports**: Share with specific stakeholders

---

## 🔒 Security & Privacy

### **Data Handling**
- Generated CSVs contain **production user data**
- Store securely and restrict access
- Do not commit to version control
- Delete after analysis if sensitive

### **GDPR Compliance**
- User emails and personal data included
- Handle according to privacy policy
- Consider anonymization for broad distribution

---

## 🐛 Troubleshooting

### **"No such file or directory" Error**
```bash
# Ensure you're in project root
cd /Users/sanchay/Documents/projects/personal/influencerplatform-wt2
npm run report:founder
```

### **Database Connection Error**
Check that production database credentials in `.env.production` are valid:
```bash
# Test database connection
node -e "const postgres = require('postgres'); const sql = postgres(process.env.DATABASE_URL); sql\`SELECT 1\`.then(() => console.log('✓ Connected')).catch(e => console.error('✗ Error:', e.message))"
```

### **Empty Report Files**
- **Cause**: Database tables are empty or don't exist
- **Solution**: Verify production database has data
- **Check**: Run `node scripts/analyze-database.js` to inspect schema

### **Script Execution Permission Denied**
```bash
chmod +x scripts/generate-founder-report.ts
```

---

## 📊 Sample Report Interpretation

### **Executive Summary Example**
```csv
reportDate,totalUsers,activeUsers,totalCampaigns,completedCampaigns,...
2025-10-16T10:30:00Z,42,28,156,134,...
```

**Interpretation**:
- **42 total users** signed up
- **28 active users** (66.7% activation rate)
- **156 campaigns** created
- **134 campaigns** completed (86% completion rate)

### **Platform Breakdown Example**
```csv
platform,totalJobs,completedJobs,totalCreators,avgCreatorsPerJob,successRate
TikTok,45,42,4200,100,93.3%
Instagram,38,35,3150,90,92.1%
YouTube,29,26,2340,90,89.7%
```

**Interpretation**:
- **TikTok has highest success rate** (93.3%)
- **TikTok discovers most creators per job** (100 avg)
- **All platforms performing well** (>89% success)

---

## 🔄 Scheduling Regular Reports

### **Manual Generation**
Run whenever needed:
```bash
npm run report:founder
```

### **Automated Daily Reports** (Optional)
Add to cron job or CI/CD pipeline:
```bash
# Daily at 9 AM
0 9 * * * cd /path/to/project && npm run report:founder && echo "Report generated $(date)" >> report-log.txt
```

### **Vercel Cron** (Production)
Create API endpoint that generates and emails report:
```typescript
// app/api/cron/founder-report/route.ts
export async function GET(request: Request) {
  // Run report generation
  // Email to founder
  return Response.json({ success: true });
}
```

---

## 📞 Support & Questions

### **Report Issues**
If the report fails or produces unexpected results:
1. Check console output for detailed error messages
2. Verify database connection
3. Inspect individual CSV files for data quality
4. Contact development team with error details

### **Feature Requests**
To add additional metrics or modify the report:
1. Edit `scripts/generate-founder-report.ts`
2. Modify SQL queries to fetch desired data
3. Update CSV generation to include new fields
4. Test with development database first

---

## 🎓 Example Use Cases

### **Weekly Board Meeting**
```bash
# Generate fresh report
npm run report:founder

# Open executive summary
open founder-report-executive-summary.csv

# Key slides:
# 1. Total users (growth vs last week)
# 2. Trial conversion rate (target: >15%)
# 3. Platform performance (focus on strongest)
# 4. Active user engagement (campaigns per user)
```

### **Customer Success Review**
```bash
# Generate report
npm run report:founder

# Open users file
open founder-report-users.csv

# Analysis:
# - Filter users with 0 campaigns → reach out for onboarding help
# - Identify users with expired trials → conversion campaign
# - Check last activity → re-engagement strategy
```

### **Product Development Planning**
```bash
# Generate report
npm run report:founder

# Open platform breakdown
open founder-report-platform-breakdown.csv

# Decisions:
# - Which platform to optimize first? (highest usage)
# - Where to invest API budget? (best ROI)
# - Feature priorities based on user behavior
```

---

**Report Generation Time**: ~2-5 seconds
**Database Impact**: Minimal (read-only queries)
**File Size**: ~10-100KB per CSV (depends on data volume)

✅ **Ready to generate your founder report!** Run `npm run report:founder` now.
