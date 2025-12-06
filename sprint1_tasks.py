# Sprint 1 Task Categorization for CSV Export
# Save this as: sprint1_tasks.py

tasks_data = [
    # Format: (Task, Description, Effort_Level, Effort_Hours, Priority, Dependencies, Files_Affected, Technical_Complexity)

    # === TRIVIAL TASKS (< 2 hours) ===
    {
        "task_id": "S1-T01",
        "task_name": "Sidebar Pinned by Default",
        "description": "Update default user preferences to have sidebar pinned on first login",
        "effort_level": "Trivial",
        "estimated_hours": 1,
        "priority": "Low",
        "sprint_week": 2,
        "dependencies": None,
        "files_affected": [
            "lib/db/schema.ts (user preferences)",
            "app/components/Sidebar.tsx"
        ],
        "technical_complexity": "Simple state management change",
        "business_impact": "UX improvement, minor retention boost",
        "risk_level": "Very Low"
    },
    {
        "task_id": "S1-T02",
        "task_name": "Remove Indian Filtering",
        "description": "Remove geo-filtering logic that excludes Indian creators from results",
        "effort_level": "Trivial",
        "estimated_hours": 1.5,
        "priority": "High",
        "sprint_week": 1,
        "dependencies": None,
        "files_affected": [
            "lib/platforms/tiktok-client.ts",
            "lib/platforms/instagram-client.ts",
            "lib/platforms/youtube-client.ts"
        ],
        "technical_complexity": "Simple filter removal, may need to verify no downstream dependencies",
        "business_impact": "Expands search results, improves international coverage",
        "risk_level": "Low - just removing logic"
    },

    # === EASY TASKS (2-8 hours) ===
    {
        "task_id": "S1-E01",
        "task_name": "Google Analytics Integration",
        "description": "Add GA4 tracking script and configure basic page view tracking",
        "effort_level": "Easy",
        "estimated_hours": 4,
        "priority": "Medium",
        "sprint_week": 1,
        "dependencies": None,
        "files_affected": [
            "app/layout.tsx",
            "lib/analytics/google-analytics.ts (new)",
            ".env.development",
            ".env.production"
        ],
        "technical_complexity": "Next.js Script component integration, environment config",
        "business_impact": "Essential for marketing attribution and user behavior analysis",
        "risk_level": "Low - standard integration pattern"
    },
    {
        "task_id": "S1-E02",
        "task_name": "LogSnag Event Tracking",
        "description": "Integrate LogSnag API for key events (signup, trial, purchase, campaign creation)",
        "effort_level": "Easy",
        "estimated_hours": 6,
        "priority": "Medium",
        "sprint_week": 2,
        "dependencies": None,
        "files_affected": [
            "lib/events/logsnag.ts (new)",
            "app/api/auth/signup/route.ts",
            "app/api/scraping/[platform]/route.ts",
            "lib/services/subscription-service.ts"
        ],
        "technical_complexity": "REST API integration with event triggers",
        "business_impact": "Real-time operational monitoring and alerting",
        "risk_level": "Low - async fire-and-forget events"
    },
    {
        "task_id": "S1-E03",
        "task_name": "Coupon Code Bypass System",
        "description": "Add Stripe checkout coupon functionality to grant free access for seeding creators",
        "effort_level": "Easy",
        "estimated_hours": 8,
        "priority": "Medium",
        "sprint_week": 2,
        "dependencies": None,
        "files_affected": [
            "app/api/billing/create-checkout-session/route.ts",
            "lib/db/schema.ts (user_billing table)",
            "app/components/billing/CheckoutForm.tsx (new)",
            "supabase/migrations/XXX_add_coupon_tracking.sql (new)"
        ],
        "technical_complexity": "Stripe API integration with coupon validation",
        "business_impact": "Critical for creator seeding strategy and partnerships",
        "risk_level": "Medium - payment flow changes require careful testing"
    },

    # === MEDIUM TASKS (1-3 days / 8-24 hours) ===
    {
        "task_id": "S1-M01",
        "task_name": "Google Tag Manager + Server-Side Events",
        "description": "Configure GTM container, set up server-side tracking for signup, trial, purchase events",
        "effort_level": "Medium",
        "estimated_hours": 12,
        "priority": "High",
        "sprint_week": 1,
        "dependencies": ["S1-E01"],
        "files_affected": [
            "app/layout.tsx",
            "lib/analytics/gtm.ts (new)",
            "lib/analytics/server-events.ts (new)",
            "app/api/events/track/route.ts (new)",
            ".env.development",
            ".env.production"
        ],
        "technical_complexity": "GTM container setup, server-side event API, conversion tracking configuration",
        "business_impact": "Essential for ad campaign optimization and ROAS measurement",
        "risk_level": "Medium - requires testing across multiple ad platforms"
    },
    {
        "task_id": "S1-M02",
        "task_name": "TikTok Similar Creator Enhancement",
        "description": "Improve/crack TikTok similar creator search beyond current InfluencersClub API limitations",
        "effort_level": "Medium",
        "estimated_hours": 16,
        "priority": "High",
        "sprint_week": 1,
        "dependencies": None,
        "files_affected": [
            "lib/platforms/tiktok-client.ts",
            "app/api/scraping/tiktok-similar/route.ts",
            "test-scripts/tiktok-similar-test.js"
        ],
        "technical_complexity": "May require new API provider research, TikTok Research API integration, or custom scraping",
        "business_impact": "Differentiating feature for competitive analysis use case",
        "risk_level": "Medium-High - depends on data source availability and reliability"
    },
    {
        "task_id": "S1-M03",
        "task_name": "AI Keyword Suggestions System",
        "description": "LLM-powered keyword expansion from user prompts to improve search accuracy",
        "effort_level": "Medium",
        "estimated_hours": 20,
        "priority": "Very High",
        "sprint_week": 1,
        "dependencies": None,
        "files_affected": [
            "app/api/ai/suggest-keywords/route.ts (new)",
            "lib/ai/keyword-expander.ts (new)",
            "app/components/campaign/KeywordSuggestionUI.tsx (new)",
            "supabase/migrations/XXX_add_keyword_suggestions.sql (new)",
            "lib/db/schema.ts (keyword_suggestions table)"
        ],
        "technical_complexity": "LLM integration (OpenAI/Anthropic), prompt engineering, UI for suggestion acceptance",
        "business_impact": "HUGE - solves major user friction point, increases search quality, reduces bounce rate",
        "risk_level": "Medium - LLM costs need monitoring, suggestion quality needs validation"
    },
    {
        "task_id": "S1-M04",
        "task_name": "Creator Cards/Profiles (Gemz Integration)",
        "description": "Enhanced creator profile modal with detailed stats, contact info, social links",
        "effort_level": "Medium",
        "estimated_hours": 18,
        "priority": "High",
        "sprint_week": 2,
        "dependencies": None,
        "files_affected": [
            "app/components/results/CreatorCard.tsx",
            "app/components/results/CreatorProfileModal.tsx (new)",
            "lib/services/creator-enrichment.ts (new)",
            "app/api/creators/[id]/profile/route.ts (new)"
        ],
        "technical_complexity": "UI component design, data aggregation from multiple sources, responsive design",
        "business_impact": "Critical UX improvement, increases time-on-site and decision confidence",
        "risk_level": "Low - pure frontend enhancement with backend data aggregation"
    },
    {
        "task_id": "S1-M05",
        "task_name": "FirstPromoter Affiliate Integration",
        "description": "Integrate affiliate tracking system with referral links, commission tracking, and payout management",
        "effort_level": "Medium",
        "estimated_hours": 20,
        "priority": "High",
        "sprint_week": 2,
        "dependencies": ["S1-E03"],
        "files_affected": [
            "app/api/affiliates/webhook/route.ts (new)",
            "lib/services/affiliate-service.ts (new)",
            "supabase/migrations/XXX_add_affiliates.sql (new)",
            "lib/db/schema.ts (affiliates table)",
            "app/components/affiliates/Dashboard.tsx (new)",
            "app/api/auth/signup/route.ts (referral tracking)"
        ],
        "technical_complexity": "Webhook integration, referral tracking cookies, commission calculation logic",
        "business_impact": "Growth multiplier - enables partner/influencer-driven acquisition",
        "risk_level": "Medium - financial calculations must be accurate, requires thorough testing"
    },

    # === HARD TASKS (3-5 days / 24-40 hours) ===
    {
        "task_id": "S1-H01",
        "task_name": "Instagram Keyword Search (Crack Implementation)",
        "description": "Build true keyword/hashtag search for Instagram beyond current Reels/Similar limitations",
        "effort_level": "Hard",
        "estimated_hours": 32,
        "priority": "Critical",
        "sprint_week": 1,
        "dependencies": None,
        "files_affected": [
            "lib/platforms/instagram-client.ts",
            "app/api/scraping/instagram-keyword/route.ts (new)",
            "lib/scrapers/instagram-hashtag-scraper.ts (new)",
            "test-scripts/instagram-keyword-test.js (new)",
            "lib/services/instagram-enrichment.ts"
        ],
        "technical_complexity": "Instagram has no public keyword API - requires SERP scraping, Apify integration, or custom scraper. Need to handle rate limits, CAPTCHAs, data normalization",
        "business_impact": "CRITICAL - Instagram is primary platform for influencer marketing, keyword search is table stakes",
        "risk_level": "High - scraping is fragile, may need multiple fallback strategies"
    }
]

# Effort level mapping for CSV column
effort_mapping = {
    "Trivial": 1,
    "Easy": 2,
    "Medium": 3,
    "Hard": 4,
    "Very Hard": 5
}

# Generate CSV
import csv
from datetime import datetime

def generate_sprint_csv(filename="sprint1_tasks.csv"):
    """
    Generate CSV file with all Sprint 1 tasks categorized by effort
    """
    fieldnames = [
        "Task ID",
        "Task Name",
        "Description",
        "Effort Level",
        "Effort Numeric (1-5)",
        "Estimated Hours",
        "Priority",
        "Sprint Week",
        "Dependencies",
        "Files Affected Count",
        "Files Affected",
        "Technical Complexity",
        "Business Impact",
        "Risk Level"
    ]

    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        # Sort by effort level (easy to hard)
        sorted_tasks = sorted(tasks_data, key=lambda x: effort_mapping[x['effort_level']])

        for task in sorted_tasks:
            files = task['files_affected']
            writer.writerow({
                "Task ID": task['task_id'],
                "Task Name": task['task_name'],
                "Description": task['description'],
                "Effort Level": task['effort_level'],
                "Effort Numeric (1-5)": effort_mapping[task['effort_level']],
                "Estimated Hours": task['estimated_hours'],
                "Priority": task['priority'],
                "Sprint Week": task['sprint_week'],
                "Dependencies": task['dependencies'] if task['dependencies'] else "None",
                "Files Affected Count": len(files),
                "Files Affected": " | ".join(files),
                "Technical Complexity": task['technical_complexity'],
                "Business Impact": task['business_impact'],
                "Risk Level": task['risk_level']
            })

    print(f"✅ CSV generated: {filename}")
    print(f"📊 Total tasks: {len(tasks_data)}")
    print(f"⏱️  Total estimated hours: {sum(t['estimated_hours'] for t in tasks_data)}")

    # Print summary by effort level
    print("\n📋 Task Breakdown by Effort:")
    for effort_level in ["Trivial", "Easy", "Medium", "Hard", "Very Hard"]:
        tasks_at_level = [t for t in tasks_data if t['effort_level'] == effort_level]
        hours_at_level = sum(t['estimated_hours'] for t in tasks_at_level)
        print(f"  {effort_level}: {len(tasks_at_level)} tasks ({hours_at_level} hours)")

if __name__ == "__main__":
    generate_sprint_csv()
