'use client';

import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Step4CompleteProps {
	onComplete: () => void;
	isLoading: boolean;
}

const nextSteps = [
	{
		number: 1,
		title: 'Create your first campaign',
		description: 'Search for influencers across TikTok, Instagram & YouTube',
	},
	{
		number: 2,
		title: 'Get detailed insights',
		description: 'Access contact info, analytics, and audience data',
	},
	{
		number: 3,
		title: 'Export and contact',
		description: 'Download contact lists and start your campaigns',
	},
];

export default function Step4Complete({ onComplete, isLoading }: Step4CompleteProps) {
	return (
		<>
			<CardHeader>
				<div className="mx-auto mb-4 w-16 h-16 bg-brand-green-500/10 rounded-full flex items-center justify-center">
					<CheckCircle className="w-8 h-8 text-brand-green-500" />
				</div>
				<CardTitle className="text-2xl font-bold text-foreground text-center">
					You're All Set! 🎉
				</CardTitle>
				<CardDescription className="text-muted-foreground text-center">
					Your profile is complete and our AI is ready to find perfect influencers for your brand.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				<div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-6">
					<h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						What's next?
					</h3>
					<div className="space-y-3">
						{nextSteps.map((step) => (
							<div key={step.number} className="flex items-start gap-3">
								<div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
									{step.number}
								</div>
								<div>
									<p className="font-medium text-foreground">{step.title}</p>
									<p className="text-sm text-muted-foreground">{step.description}</p>
								</div>
							</div>
						))}
					</div>
				</div>

				<Button
					onClick={onComplete}
					size="lg"
					className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
					disabled={isLoading}
				>
					{isLoading ? (
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
							Completing setup...
						</div>
					) : (
						<div className="flex items-center gap-2">
							Let's Start!
							<ArrowRight className="h-4 w-4" />
						</div>
					)}
				</Button>
			</CardContent>
		</>
	);
}
