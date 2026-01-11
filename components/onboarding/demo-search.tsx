import { ExternalLink, Mail, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DemoSearch({ businessName }: { businessName: string }) {
	const [isSearching, setIsSearching] = useState(false);
	type DemoInfluencer = {
		name: string;
		platform: 'TikTok' | 'Instagram' | 'YouTube';
		followers: string;
		engagement: string;
		bio: string;
		email: string;
		avatar: string;
		url: string;
	};
	const [results, setResults] = useState<DemoInfluencer[]>([]);

	const demoInfluencers: DemoInfluencer[] = [
		{
			name: 'Sarah Johnson',
			platform: 'TikTok',
			followers: '125K',
			engagement: '4.2%',
			bio: 'Fashion & lifestyle creator | NYC based | Email: sarah@example.com',
			email: 'sarah@example.com',
			avatar: '/demo/sarah.jpg',
			url: 'https://tiktok.com/@sarah',
		},
		{
			name: 'Alex Chen',
			platform: 'Instagram',
			followers: '89K',
			engagement: '5.8%',
			bio: 'Tech reviewer & entrepreneur | Collabs: alex.business@gmail.com',
			email: 'alex.business@gmail.com',
			avatar: '/demo/alex.jpg',
			url: 'https://instagram.com/alex',
		},
		{
			name: 'Maya Rodriguez',
			platform: 'YouTube',
			followers: '200K',
			engagement: '3.1%',
			bio: 'Beauty & wellness | Sponsored content: maya.collabs@email.com',
			email: 'maya.collabs@email.com',
			avatar: '/demo/maya.jpg',
			url: 'https://youtube.com/maya',
		},
	];

	const runDemoSearch = async () => {
		setIsSearching(true);
		// Simulate search delay
		await new Promise((resolve) => setTimeout(resolve, 2000));
		setResults(demoInfluencers);
		setIsSearching(false);
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Search className="w-5 h-5" />
					See Gemz in Action
				</CardTitle>
				<p className="text-sm text-gray-600">
					Let's find influencers perfect for {businessName} in 30 seconds
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{results.length ? (
					<div className="space-y-3">
						<div className="flex items-center justify-between text-sm">
							<span className="text-green-600 font-medium">
								✅ Found {results.length} perfect matches
							</span>
							<span className="text-gray-500">Search time: 2.3s</span>
						</div>

						{results.map((influencer, index) => (
							<div key={index} className="border rounded-lg p-3 hover:bg-gray-50">
								<div className="flex items-start justify-between">
									<div className="flex items-center space-x-3">
										<img
											src={influencer.avatar}
											alt={influencer.name}
											className="w-10 h-10 rounded-full"
										/>
										<div>
											<div className="flex items-center space-x-2">
												<h4 className="font-medium">{influencer.name}</h4>
												<span className="text-xs bg-blue-100 px-2 py-1 rounded">
													{influencer.platform}
												</span>
											</div>
											<div className="flex items-center space-x-4 text-sm text-gray-600">
												<span className="flex items-center gap-1">
													<Users className="w-3 h-3" />
													{influencer.followers}
												</span>
												<span>Engagement: {influencer.engagement}</span>
											</div>
										</div>
									</div>
									<div className="flex items-center space-x-2">
										<a
											href={`mailto:${influencer.email}`}
											className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
										>
											<Mail className="w-3 h-3" />
											Contact
										</a>
										<a
											href={influencer.url}
											className="flex items-center gap-1 text-gray-600 hover:underline text-sm"
										>
											<ExternalLink className="w-3 h-3" />
											Profile
										</a>
									</div>
								</div>
								<p className="text-sm text-gray-600 mt-2 line-clamp-2">{influencer.bio}</p>
							</div>
						))}

						<div className="bg-blue-50 p-4 rounded-lg">
							<p className="text-sm text-blue-800 font-medium">
								🎉 This took 2.3 seconds instead of 2+ hours of manual research!
							</p>
							<p className="text-xs text-blue-600 mt-1">
								Continue to unlock unlimited searches across all platforms
							</p>
						</div>
					</div>
				) : (
					<div className="text-center py-8">
						<Button onClick={runDemoSearch} disabled={isSearching} className="w-full">
							{isSearching ? 'Searching...' : 'Find Influencers for ' + businessName}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
