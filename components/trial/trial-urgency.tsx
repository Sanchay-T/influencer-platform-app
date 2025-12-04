import { Clock, TrendingUp, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TrialUrgencyProps {
	trialData: {
		daysRemaining: number;
		hoursRemaining: number;
		progressPercentage: number;
		searchesUsed: number;
		searchesLimit: number;
	};
}

export default function TrialUrgency({ trialData }: TrialUrgencyProps) {
	const [currentOffer, setCurrentOffer] = useState<string | null>(null);

	useEffect(() => {
		// Dynamic offers based on trial progress
		if (trialData.daysRemaining <= 1) {
			setCurrentOffer('final24h');
		} else if (trialData.daysRemaining <= 2) {
			setCurrentOffer('last48h');
		} else if (trialData.progressPercentage >= 80) {
			setCurrentOffer('almostExpired');
		} else if (trialData.searchesUsed >= trialData.searchesLimit * 0.8) {
			setCurrentOffer('searchLimit');
		}
	}, [trialData]);

	const offers = {
		final24h: {
			title: '🚨 Final 24 Hours',
			description: 'Your trial expires tomorrow! Save 40% on Premium - today only',
			discount: '40% OFF',
			urgency: 'Expires in 24 hours',
			color: 'bg-red-500',
			cta: 'Claim 40% Discount Now',
		},
		last48h: {
			title: '⏰ Last 48 Hours',
			description: 'Trial ending soon! Get 30% off Premium before it expires',
			discount: '30% OFF',
			urgency: 'Limited time offer',
			color: 'bg-orange-500',
			cta: 'Get 30% Off Premium',
		},
		almostExpired: {
			title: '🎯 Trial Almost Complete',
			description: "You've used 80% of your trial! Secure 25% off Premium",
			discount: '25% OFF',
			urgency: 'Trial progress: 80%+',
			color: 'bg-yellow-500',
			cta: 'Secure 25% Discount',
		},
		searchLimit: {
			title: '🔍 Search Limit Reached',
			description: "You're almost out of searches! Upgrade for unlimited access",
			discount: 'UNLIMITED',
			urgency: `${trialData.searchesUsed}/${trialData.searchesLimit} searches used`,
			color: 'bg-blue-500',
			cta: 'Upgrade to Unlimited',
		},
	};

	if (!currentOffer) return null;

	const offer = offers[currentOffer as keyof typeof offers];

	return (
		<Card className="border-2 border-dashed border-gray-300 bg-gradient-to-r from-blue-50 to-purple-50">
			<CardContent className="p-6">
				<div className="flex items-start justify-between mb-4">
					<div className="flex-1">
						<h3 className="text-lg font-bold text-gray-900 mb-2">{offer.title}</h3>
						<p className="text-gray-600 mb-3">{offer.description}</p>

						<div className="flex items-center space-x-4 mb-4">
							<Badge className={`${offer.color} text-white`}>{offer.discount}</Badge>
							<span className="text-sm text-gray-500 flex items-center gap-1">
								<Clock className="w-3 h-3" />
								{offer.urgency}
							</span>
						</div>

						<Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
							{offer.cta}
						</Button>
					</div>

					<div className="ml-4 text-center">
						<Zap className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
						<p className="text-xs text-gray-500">Limited Time</p>
					</div>
				</div>

				<div className="grid grid-cols-3 gap-4 text-center text-sm">
					<div className="bg-white p-2 rounded">
						<TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
						<div className="font-medium">10,000+</div>
						<div className="text-gray-500">Influencers</div>
					</div>
					<div className="bg-white p-2 rounded">
						<Users className="w-4 h-4 text-blue-500 mx-auto mb-1" />
						<div className="font-medium">3 Platforms</div>
						<div className="text-gray-500">TikTok, IG, YT</div>
					</div>
					<div className="bg-white p-2 rounded">
						<Clock className="w-4 h-4 text-purple-500 mx-auto mb-1" />
						<div className="font-medium">85% Faster</div>
						<div className="text-gray-500">vs Manual</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
