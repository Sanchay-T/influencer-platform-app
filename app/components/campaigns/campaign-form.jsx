'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { structuredConsole } from '@/lib/logging/console-proxy';

export default function CampaignForm() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState({
		name: '',
		description: '',
	});

	useEffect(() => {
		// Move initial render log here to prevent hydration errors
		structuredConsole.log('🖥️ [CLIENT] Campaign form component rendered');
		structuredConsole.log('🖥️ [CLIENT] Campaign form component mounted');

		return () => {
			structuredConsole.log('🖥️ [CLIENT] Campaign form component unmounted');
		};
	}, []);

	const handleSubmitBasicInfo = async (e) => {
		e.preventDefault();
		structuredConsole.log('📝 [CLIENT] Campaign basic info submitted', {
			name: formData.name,
			description:
				formData.description?.substring(0, 20) + (formData.description?.length > 20 ? '...' : ''),
		});
		setIsSubmitting(true);
		try {
			structuredConsole.log('🔄 [CLIENT] Creating campaign via API...');
			const response = await fetch('/api/campaigns', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: formData.name,
					description: formData.description,
				}),
			});

			const campaign = await response.json();
			structuredConsole.log('📥 [CLIENT] API response received:', campaign);

			if (!response.ok) {
				structuredConsole.error(
					'❌ [CLIENT] Campaign creation API error:',
					campaign.error || 'Unknown error'
				);
				throw new Error(campaign.error || 'Error al crear la campaña');
			}

			structuredConsole.log('✅ [CLIENT] Campaign created successfully', {
				id: campaign.id,
				name: campaign.name,
			});

			// Asegurarnos de que guardamos el ID correctamente
			structuredConsole.log('🔄 [CLIENT] Saving campaign data to sessionStorage');
			sessionStorage.setItem(
				'currentCampaign',
				JSON.stringify({
					id: campaign.id,
					name: campaign.name,
				})
			);

			const searchRoute = `/campaigns/search?campaignId=${campaign.id}`;
			structuredConsole.log('🔄 [CLIENT] Redirecting to search chooser:', searchRoute);
			router.push(searchRoute);
		} catch (error) {
			structuredConsole.error('❌ [CLIENT] Error creating campaign:', error);
			toast.error(error.message);
			setIsSubmitting(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card className="max-w-2xl mx-auto bg-zinc-900/80 border border-zinc-700/50">
			<CardHeader>
				<CardTitle className="text-zinc-100">Create a Campaign</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmitBasicInfo} className="space-y-5">
					<div className="space-y-2">
						<label className="text-sm font-medium text-zinc-200">Campaign Name</label>
						<Input
							required
							value={formData.name}
							onChange={(e) => {
								structuredConsole.log('✏️ [CLIENT] Campaign name changed:', e.target.value);
								setFormData({ ...formData, name: e.target.value });
							}}
							placeholder="E.g.: Summer Campaign 2025"
							className="bg-zinc-800/60 border-zinc-700/50"
						/>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-zinc-200">Campaign Description</label>
						<Textarea
							required
							value={formData.description}
							onChange={(e) => {
								structuredConsole.log('✏️ [CLIENT] Campaign description changed');
								setFormData({ ...formData, description: e.target.value });
							}}
							placeholder="Describe your campaign goals and target audience..."
							rows={4}
							className="bg-zinc-800/60 border-zinc-700/50"
						/>
					</div>
					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting ? (
							<div className="flex items-center justify-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								Creating Campaign...
							</div>
						) : (
							'Continue'
						)}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
