'use client';

import { AlertCircle, ArrowRight, Sparkles, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Step2BrandProps {
	brandDescription: string;
	onBrandDescriptionChange: (value: string) => void;
	onExampleSelect: (prompt: string, index: number) => void;
	onSubmit: () => void;
	isLoading: boolean;
	error: string;
}

const examplePrompts = [
	"We're a sustainable skincare brand targeting eco-conscious millennials. We look for beauty influencers who promote clean living, natural products, and environmental awareness.",
	'Fitness apparel company for women. We want to work with fitness influencers, yoga instructors, and wellness coaches who inspire healthy lifestyles and body positivity.',
	"Tech startup building productivity apps. We're seeking tech reviewers, productivity experts, and entrepreneurs who create content about business tools and efficiency.",
];

export default function Step2Brand({
	brandDescription,
	onBrandDescriptionChange,
	onExampleSelect,
	onSubmit,
	isLoading,
	error,
}: Step2BrandProps) {
	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl font-bold text-foreground">
					Describe Your Brand & Influencer Goals 🎯
				</CardTitle>
				<CardDescription className="text-muted-foreground">
					Help our AI understand your brand and the type of influencers you want to work with.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<div className="space-y-3">
					<Label
						htmlFor="brandDescription"
						className="text-sm font-medium text-foreground flex items-center gap-2"
					>
						<Target className="h-4 w-4" />
						Explain your brand and the type of influencers you look to work with
					</Label>

					<div className="relative">
						<Textarea
							id="brandDescription"
							placeholder="Example: We're a sustainable fashion brand targeting young professionals. We look for eco-conscious lifestyle influencers who promote ethical fashion..."
							value={brandDescription}
							onChange={(e) => onBrandDescriptionChange(e.target.value)}
							className="min-h-[120px] text-base resize-none bg-zinc-800/50 border-zinc-700/50 focus:border-primary"
							disabled={isLoading}
						/>
					</div>

					<div className="flex items-start gap-2 p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
						<Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
						<div>
							<p className="text-sm text-foreground font-medium mb-1">
								Our AI will use this context to:
							</p>
							<ul className="text-xs text-muted-foreground space-y-1">
								<li>• Find influencers that match your brand values</li>
								<li>• Identify creators with relevant audience demographics</li>
								<li>• Prioritize accounts with authentic engagement in your niche</li>
							</ul>
						</div>
					</div>
				</div>

				<div className="space-y-3">
					<Label className="text-sm font-medium text-foreground">
						Need inspiration? Click any example:
					</Label>

					<div className="space-y-2">
						{examplePrompts.map((prompt, promptIndex) => (
							<button
								key={`example-${promptIndex}`}
								type="button"
								className="w-full text-left p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-md cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-600/50 transition-colors"
								onClick={() => onExampleSelect(prompt, promptIndex)}
							>
								<p className="text-sm text-muted-foreground">{prompt}</p>
							</button>
						))}
					</div>
				</div>

				<Button
					onClick={onSubmit}
					className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
					disabled={isLoading || !brandDescription.trim()}
				>
					{isLoading ? (
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
							Saving...
						</div>
					) : (
						<div className="flex items-center gap-2">
							Continue
							<ArrowRight className="h-4 w-4" />
						</div>
					)}
				</Button>
			</CardContent>
		</>
	);
}
