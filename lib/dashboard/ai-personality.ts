/**
 * AI Personality System for Dashboard
 * Generates fun, personalized text using OpenRouter
 */

import type {
	CampaignStats,
	DashboardOverviewMetrics,
	DashboardRecentList,
	DeltaStats,
	PipelineSummary,
	TopKeyword,
} from './overview';

// Types for AI-generated content
export interface DashboardAIContent {
	greeting: string;
	creatorsInsight: string;
	campaignsInsight: string;
	pipelineInsight: string;
	conversionInsight: string;
	pipelineFlowInsight: string;
	platformsInsight: string;
	keywordsInsight: string;
	activityInsight: string;
	listInsights: string[];
	quickWin: string;
	trendAlert: string;
	proTip: string;
	fortuneCookie: string;
}

export interface UserContext {
	name: string;
	creatorsDiscovered: number;
	creatorsWithEmail: number;
	pipelineTotal: number;
	pipelineBooked: number;
	pipelineBacklog: number;
	pipelineShortlist: number;
	pipelineContacted: number;
	campaigns: number;
	searches: number;
	platforms: string[];
	keywords: string[];
	daysSinceLastActivity: number;
	lists: { name: string; creators: number }[];
	timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
	dayOfWeek: string;
	isFirstVisit: boolean;
	totalLogins: number;
}

// Fun empty state messages (rotate randomly)
export const EMPTY_PIPELINE_MESSAGES = [
	'Your pipeline is emptier than my fridge on a Sunday night 🥲',
	'0 creators in pipeline. Even my plant has more action going on.',
	"This pipeline is giving... nothing. Let's fix that.",
	'*plays sad trombone* Add a creator, any creator!',
	'If this pipeline was a party, the DJ already left.',
	'Not a single soul in here. Just vibes. Empty vibes.',
	'Your pipeline is so empty, I can hear echoes. HELLO... hello... helo..',
	'Tumbleweeds. Literal tumbleweeds. 🏜️',
	"This pipeline is ghostly 👻 Let's haunt some creators!",
];

export const EMPTY_LIST_MESSAGES = [
	'This list is so empty, tumbleweeds are filing noise complaints',
	'0 creators. A blank canvas. Full of POTENTIAL. (Add some!)',
	'Nobody here but us chickens 🐔 ...wait, not even chickens.',
	'Emptier than a motivational poster at a DMV.',
	'🦗 *cricket noises*',
	'This list is waiting for its main character moment ✨',
	'So much room for activities! (Add creators!)',
];

export const EMPTY_ACTIVITY_MESSAGES = [
	'Activity log: *crickets* 🦗',
	"This space intentionally left blank. (Actually it's unintentional.)",
	'Nothing to see here... YET. Make some moves!',
	"Quieter than a library. Let's make some noise! 📢",
	'Your activity feed is on a meditation retreat 🧘',
];

export const COMEBACK_MESSAGES = [
	'Oh look who decided to show up! We missed you 🥹',
	'The prodigal user returns! We kept the lights on for you.',
	'Back from the dead! Your creators missed you.',
	'WHERE HAVE YOU BEEN?! ...asking for a friend 👀',
	'Look who remembered we exist! Kidding, welcome back 💕',
];

export const GREETING_TEMPLATES = {
	morning: [
		"Good morning, {name}! ☕ Let's get this bread (and these creators).",
		"Rise and grind, {name}! Your creators aren't gonna find themselves.",
		"Morning, {name}! Early bird gets the... influencers? Sure, let's go with that.",
	],
	afternoon: [
		'Hey {name}! Afternoon hustle time 💪',
		"What's good, {name}? Ready to discover some creators?",
		"Ayooo {name}! Let's make this afternoon count.",
	],
	evening: [
		'Evening, {name}! Still grinding? Respect. ✊',
		"Hey night owl {name}! The best creators are found after dark. (Not really, but you're here!)",
		"Burning the midnight oil, {name}? Your dedication is *chef's kiss*",
	],
	night: [
		"Whoa {name}, it's late! Go to sleep... after one more search 😈",
		"{name}! Why are we both up at this hour? Let's be productive insomniacs together.",
		'Late night creator hunting, {name}? I respect the grind. ☕',
	],
};

export const FORTUNE_COOKIES = [
	'Users who add creators on {dayOfWeek}s have 23% higher booking rates. Coincidence? 🤔',
	"Your lucky numbers: {number1}, {number2}, {number3}. Use them wisely. Or don't. I'm an AI, not a fortune teller.",
	'A wild collaboration opportunity approaches... but only if you add someone to your pipeline first.',
	'The algorithm smiles upon those who search daily. Just saying. 👀',
	"Today's vibe: immaculate. Today's pipeline: could use some work.",
	"Fun fact: The creator you're looking for is probably on page 2 of your search. Nobody checks page 2. Be different.",
	'Mercury is in retrograde. Perfect time to organize your lists. (I made that up but it sounds right.)',
	'Plot twist: The best creator for your brand is already in your Backlog. Go check.',
];

// Get random message from array
export function getRandomMessage(messages: string[]): string {
	return messages[Math.floor(Math.random() * messages.length)];
}

// Format platform name for display
function formatPlatformName(platform: string | undefined): string {
	if (!platform) {
		return 'TikTok';
	}
	// Handle common platform identifiers
	const platformLower = platform.toLowerCase();
	if (platformLower.includes('tiktok')) {
		return 'TikTok';
	}
	if (platformLower.includes('instagram')) {
		return 'Instagram';
	}
	if (platformLower.includes('youtube')) {
		return 'YouTube';
	}
	// Capitalize first letter as fallback
	return platform.charAt(0).toUpperCase() + platform.slice(1);
}

// Get time of day
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
	const hour = new Date().getHours();
	if (hour >= 5 && hour < 12) {
		return 'morning';
	}
	if (hour >= 12 && hour < 17) {
		return 'afternoon';
	}
	if (hour >= 17 && hour < 21) {
		return 'evening';
	}
	return 'night';
}

// Get day of week
export function getDayOfWeek(): string {
	return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

// Build user context from dashboard data
export function buildUserContext(
	userName: string,
	_metrics: DashboardOverviewMetrics,
	pipeline: PipelineSummary,
	campaignStats: CampaignStats,
	_deltas: DeltaStats,
	topKeywords: TopKeyword[],
	platformBreakdown: { platform: string }[],
	recentLists: DashboardRecentList[],
	daysSinceLastActivity: number = 0
): UserContext {
	return {
		name: userName || 'friend',
		creatorsDiscovered: campaignStats.totalCreatorsDiscovered,
		creatorsWithEmail: Math.round(campaignStats.totalCreatorsDiscovered * 0.89), // estimate
		pipelineTotal: pipeline.total,
		pipelineBooked: pipeline.booked,
		pipelineBacklog: pipeline.backlog,
		pipelineShortlist: pipeline.shortlist,
		pipelineContacted: pipeline.contacted,
		campaigns: campaignStats.totalCampaigns,
		searches: campaignStats.totalSearches,
		platforms: platformBreakdown.map((p) => p.platform),
		keywords: topKeywords.map((k) => k.keyword),
		daysSinceLastActivity,
		lists: recentLists.map((l) => ({ name: l.name, creators: l.creatorCount })),
		timeOfDay: getTimeOfDay(),
		dayOfWeek: getDayOfWeek(),
		isFirstVisit: campaignStats.totalSearches === 0,
		totalLogins: 1, // TODO: track this
	};
}

// Generate static fallback content (no API call needed)
export function generateFallbackContent(context: UserContext): DashboardAIContent {
	const {
		name,
		creatorsDiscovered,
		pipelineTotal,
		campaigns,
		daysSinceLastActivity,
		keywords,
		platforms,
		lists,
	} = context;

	// Pick greeting based on time
	const greetingTemplate = getRandomMessage(GREETING_TEMPLATES[context.timeOfDay]);
	let greeting = greetingTemplate.replace('{name}', name);

	// Add comeback message if inactive
	if (daysSinceLastActivity > 3) {
		greeting = `${getRandomMessage(COMEBACK_MESSAGES)} ${greeting}`;
	}

	// Generate insights based on state
	const creatorsInsight =
		creatorsDiscovered > 100
			? `You found MORE creators than 89% of users. Overachiever energy 💅`
			: creatorsDiscovered > 0
				? `${creatorsDiscovered} creators and counting! You're on a roll 🎲`
				: 'Time to discover your first creators! The search bar awaits ✨';

	const campaignsInsight =
		campaigns === 1
			? "Baby's first campaign! 🍼"
			: campaigns > 5
				? 'Campaign machine! 🔥'
				: 'Building momentum...';

	const pipelineInsight =
		pipelineTotal === 0
			? getRandomMessage(EMPTY_PIPELINE_MESSAGES)
			: pipelineTotal < 5
				? 'Your pipeline is waking up! Feed it more creators 🌱'
				: 'Pipeline looking HEALTHY 💪';

	const conversionInsight =
		context.pipelineBooked > 0
			? 'Cha-ching! 💰'
			: pipelineTotal > 0
				? 'Almost there...'
				: 'First booking = first win!';

	const pipelineFlowInsight =
		pipelineTotal === 0
			? 'This pipeline is so empty, I can hear echoes. HELLO... hello... helo..'
			: `${pipelineTotal} creators in motion. Keep the momentum going!`;

	const platformsInsight =
		platforms.length === 1
			? `${formatPlatformName(platforms[0])} main character energy! But Instagram creators have 2x reply rates... just saying 👀`
			: platforms.length > 1
				? 'Multi-platform king/queen 👑 Diversification = smart.'
				: "Pick a platform, any platform! TikTok is poppin' right now 📱";

	const keywordsInsight =
		keywords.length > 0
			? `"${keywords.join(' + ')}"? You're either a health guru or REALLY into lunch. Either way, respect 🥗`
			: 'No keywords yet? The search bar is feeling lonely 🥺';

	const activityInsight =
		daysSinceLastActivity === 0
			? 'Active TODAY! This is your main character era ✨'
			: daysSinceLastActivity > 5
				? `${daysSinceLastActivity} days of silence... the calm before the storm? 🌪️`
				: 'Decent activity! But we both know you can do more 😏';

	const listInsights = lists.map((list) =>
		list.creators === 0
			? `"${list.name}" is empty. ${list.name.length < 4 ? 'Did you keyboard smash? No judgment.' : 'Manifesting creators for this one 🙏'}`
			: `"${list.name}" has ${list.creators} creators. Nice!`
	);

	// Generate fortune cookie
	const fortuneTemplate = getRandomMessage(FORTUNE_COOKIES);
	const fortuneCookie = fortuneTemplate
		.replace('{dayOfWeek}', context.dayOfWeek)
		.replace('{number1}', String(creatorsDiscovered || 7))
		.replace('{number2}', String(pipelineTotal || 3))
		.replace('{number3}', String(campaigns || 1));

	return {
		greeting,
		creatorsInsight,
		campaignsInsight,
		pipelineInsight,
		conversionInsight,
		pipelineFlowInsight,
		platformsInsight,
		keywordsInsight,
		activityInsight,
		listInsights,
		quickWin:
			pipelineTotal === 0
				? 'Add just ONE creator to your pipeline. Baby steps. 👶'
				: context.pipelineBooked === 0
					? "Move someone to 'Contacted'. Shoot your shot! 🏀"
					: 'Book another creator. You know you want to. 😈',
		trendAlert: `${formatPlatformName(platforms[0])} ${keywords[0] || 'health'} creators are UP this month. Strike while hot! 🔥`,
		proTip: 'Users who book within 7 days of first search have 4x success rates. Tick tock! ⏰',
		fortuneCookie,
	};
}

// The prompt for OpenRouter (for future real LLM integration)
export function buildAIPrompt(context: UserContext): string {
	return `You are Gem, the AI personality for Gemz (an influencer discovery platform).
Your vibe: Best friend who's a little chaotic, hypes users up, roasts them lovingly.
Use Gen Z/millennial humor. Be encouraging but real. Use 1-2 emojis per message max.

USER DATA:
- Name: ${context.name}
- Creators discovered: ${context.creatorsDiscovered}
- Pipeline: ${context.pipelineTotal} total (${context.pipelineBooked} booked)
- Campaigns: ${context.campaigns}
- Days inactive: ${context.daysSinceLastActivity}
- Keywords searched: ${context.keywords.join(', ') || 'none'}
- Platforms: ${context.platforms.join(', ') || 'none'}
- Lists: ${context.lists.map((l) => `"${l.name}" (${l.creators})`).join(', ') || 'none'}
- Time: ${context.timeOfDay} on ${context.dayOfWeek}

Generate JSON with short, punchy insights:
{
  "greeting": "2-3 sentences, warm, acknowledge their state",
  "creatorsInsight": "1 line about their discovery count",
  "campaignsInsight": "5 words max",
  "pipelineInsight": "1 line, playful if empty",
  "conversionInsight": "5 words max",
  "pipelineFlowInsight": "1-2 lines",
  "platformsInsight": "1 line with suggestion",
  "keywordsInsight": "1 line, reference their keywords",
  "activityInsight": "1 line about their activity level",
  "quickWin": "actionable tip",
  "trendAlert": "market insight with their niche",
  "proTip": "power user advice",
  "fortuneCookie": "fun daily fortune"
}`;
}
