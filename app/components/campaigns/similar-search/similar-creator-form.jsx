'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

export default function SimilarCreatorForm({ onSearch: _onSearch }) {
	const [platform, setPlatform] = useState('');
	const [username, setUsername] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const router = useRouter();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsSearching(true);

		setTimeout(() => {
			setIsSearching(false);
			router.push(`/campaigns/search/similar/results?platform=${platform}&username=${username}`);
		}, 1500);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Find Similar Creators</CardTitle>
					<CardDescription>
						Enter the username of a creator you like and we'll find similar profiles
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-4">
							<p className="text-sm font-medium">Platform</p>
							<Select value={platform} onValueChange={setPlatform}>
								<SelectTrigger>
									<SelectValue placeholder="Select a platform" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="tiktok">TikTok</SelectItem>
									<SelectItem value="instagram">Instagram</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-4">
							<label htmlFor="similar-creator-username" className="text-sm font-medium">
								Username
							</label>
							<div className="flex gap-2">
								<Input
									id="similar-creator-username"
									placeholder={platform === 'instagram' ? '@username' : '@tiktokuser'}
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									disabled={!platform}
									className="flex-1"
								/>
								<Button
									type="submit"
									disabled={!(platform && username) || isSearching}
									className="gap-2"
								>
									<Search className="h-4 w-4" />
									{isSearching ? 'Searching...' : 'Find Similar'}
								</Button>
							</div>
							{!platform && (
								<p className="text-sm text-muted-foreground">Select a platform first</p>
							)}
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
