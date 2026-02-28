'use client';

import { Gift, ExternalLink, Upload, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type SubmissionStatus = 'none' | 'pending' | 'approved' | 'rejected';

type SubmissionData = {
	id: string;
	evidenceType: string;
	evidenceUrl: string;
	status: string;
	adminNotes: string | null;
	createdAt: string;
};

type StatusResponse = {
	status: SubmissionStatus;
	submission: SubmissionData | null;
};

export function SocialSharingBanner() {
	const [submissionState, setSubmissionState] = useState<SubmissionStatus>('none');
	const [submission, setSubmission] = useState<SubmissionData | null>(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [showForm, setShowForm] = useState(false);
	const [formMode, setFormMode] = useState<'link' | 'image'>('link');
	const [linkUrl, setLinkUrl] = useState('');
	const fileInputRef = useRef<HTMLInputElement>(null);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await fetch('/api/social-sharing/status');
			if (!res.ok) return;
			const data = (await res.json()) as { data?: StatusResponse };
			if (data.data) {
				setSubmissionState(data.data.status as SubmissionStatus);
				setSubmission(data.data.submission);
			}
		} catch {
			// Silently fail — banner is non-critical
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	const handleSubmitLink = async () => {
		if (!linkUrl.trim()) {
			toast.error('Please enter a URL');
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch('/api/social-sharing/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: linkUrl.trim() }),
			});

			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Failed to submit');
				return;
			}

			toast.success('Submitted! We\'ll review your post shortly.');
			setShowForm(false);
			setLinkUrl('');
			await fetchStatus();
		} catch {
			toast.error('Something went wrong. Please try again.');
		} finally {
			setSubmitting(false);
		}
	};

	const handleSubmitImage = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Client-side validation
		if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
			toast.error('Only PNG and JPG images are accepted');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error('File too large. Maximum size is 5MB.');
			return;
		}

		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append('file', file);

			const res = await fetch('/api/social-sharing/submit', {
				method: 'POST',
				body: formData,
			});

			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Failed to upload');
				return;
			}

			toast.success('Screenshot uploaded! We\'ll review it shortly.');
			setShowForm(false);
			await fetchStatus();
		} catch {
			toast.error('Something went wrong. Please try again.');
		} finally {
			setSubmitting(false);
			// Reset file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	if (loading) {
		return null; // Don't show skeleton for a banner — just hide until ready
	}

	// Approved state
	if (submissionState === 'approved') {
		return (
			<Card className="bg-emerald-950/30 border border-emerald-700/40">
				<CardContent className="p-4">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-full bg-emerald-900/50">
							<CheckCircle className="h-5 w-5 text-emerald-400" />
						</div>
						<div>
							<p className="text-sm font-medium text-emerald-300">
								Free month applied!
							</p>
							<p className="text-xs text-emerald-400/70">
								Thanks for sharing Gemz. Your subscription has been extended by 30 days.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Pending state
	if (submissionState === 'pending') {
		return (
			<Card className="bg-amber-950/20 border border-amber-700/30">
				<CardContent className="p-4">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-full bg-amber-900/40">
							<Clock className="h-5 w-5 text-amber-400" />
						</div>
						<div>
							<p className="text-sm font-medium text-amber-300">
								Submission under review
							</p>
							<p className="text-xs text-amber-400/70">
								We&apos;re reviewing your social post. You&apos;ll hear back soon!
								{submission?.createdAt && (
									<> &middot; Submitted {new Date(submission.createdAt).toLocaleDateString()}</>
								)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Rejected state — allow re-submission
	if (submissionState === 'rejected') {
		return (
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardContent className="p-4">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-full bg-red-900/30">
								<XCircle className="h-5 w-5 text-red-400" />
							</div>
							<div>
								<p className="text-sm font-medium text-zinc-300">
									Submission not approved
								</p>
								{submission?.adminNotes && (
									<p className="text-xs text-zinc-500 mt-0.5">
										Reason: {submission.adminNotes}
									</p>
								)}
							</div>
						</div>
						<Button
							size="sm"
							variant="outline"
							className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0"
							onClick={() => {
								setShowForm(true);
								setSubmissionState('none');
							}}
						>
							Try Again
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Default: no submission — show CTA
	return (
		<Card className="bg-gradient-to-r from-violet-950/40 to-purple-950/30 border border-violet-700/30">
			<CardContent className="p-4">
				{!showForm ? (
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-full bg-violet-900/50">
								<Gift className="h-5 w-5 text-violet-400" />
							</div>
							<div>
								<p className="text-sm font-medium text-violet-200">
									Get 1 Free Month
								</p>
								<p className="text-xs text-violet-300/70">
									Share Gemz on social media and submit proof to get a free month
								</p>
							</div>
						</div>
						<Button
							size="sm"
							className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
							onClick={() => setShowForm(true)}
						>
							<Gift className="h-4 w-4 mr-1.5" />
							Claim
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium text-violet-200">
								Submit proof of your social post
							</p>
							<button
								type="button"
								className="text-xs text-zinc-500 hover:text-zinc-400"
								onClick={() => setShowForm(false)}
							>
								Cancel
							</button>
						</div>

						{/* Mode toggle */}
						<div className="flex gap-2">
							<Button
								size="sm"
								variant={formMode === 'link' ? 'default' : 'outline'}
								className={formMode === 'link'
									? 'bg-violet-600 hover:bg-violet-500 text-white'
									: 'border-zinc-700 text-zinc-400'}
								onClick={() => setFormMode('link')}
							>
								<ExternalLink className="h-3.5 w-3.5 mr-1.5" />
								Paste URL
							</Button>
							<Button
								size="sm"
								variant={formMode === 'image' ? 'default' : 'outline'}
								className={formMode === 'image'
									? 'bg-violet-600 hover:bg-violet-500 text-white'
									: 'border-zinc-700 text-zinc-400'}
								onClick={() => setFormMode('image')}
							>
								<Upload className="h-3.5 w-3.5 mr-1.5" />
								Upload Screenshot
							</Button>
						</div>

						{/* Link form */}
						{formMode === 'link' && (
							<div className="flex gap-2">
								<Input
									type="url"
									placeholder="https://twitter.com/you/status/..."
									value={linkUrl}
									onChange={(e: ChangeEvent<HTMLInputElement>) => setLinkUrl(e.target.value)}
									className="bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 flex-1"
									disabled={submitting}
								/>
								<Button
									size="sm"
									className="bg-violet-600 hover:bg-violet-500 text-white"
									onClick={handleSubmitLink}
									disabled={submitting}
								>
									{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
								</Button>
							</div>
						)}

						{/* Image upload */}
						{formMode === 'image' && (
							<div>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/png,image/jpeg,image/jpg"
									onChange={handleSubmitImage}
									className="hidden"
									disabled={submitting}
								/>
								<Button
									size="sm"
									variant="outline"
									className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 w-full"
									onClick={() => fileInputRef.current?.click()}
									disabled={submitting}
								>
									{submitting ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
											Uploading...
										</>
									) : (
										<>
											<Upload className="h-4 w-4 mr-2" />
											Choose Screenshot (PNG or JPG, max 5MB)
										</>
									)}
								</Button>
							</div>
						)}

						<p className="text-xs text-zinc-600">
							Post about Gemz on any social platform, then share the link or screenshot here.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
