'use client';

import {
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Clock,
	ExternalLink,
	Image as ImageIcon,
	Link2,
	Loader2,
	Search,
	XCircle,
} from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

type Submission = {
	id: string;
	userId: string;
	evidenceType: string;
	evidenceUrl: string;
	status: string;
	adminNotes: string | null;
	approvedBy: string | null;
	approvedAt: string | null;
	createdAt: string;
	updatedAt: string;
	userEmail: string | null;
	userFullName: string | null;
	clerkUserId: string;
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

// ═══════════════════════════════════════════════════════════════
// Status badge component
// ═══════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
	switch (status) {
		case 'pending':
			return (
				<Badge variant="outline" className="border-amber-600/50 text-amber-400 bg-amber-950/30">
					<Clock className="h-3 w-3 mr-1" />
					Pending
				</Badge>
			);
		case 'approved':
			return (
				<Badge variant="outline" className="border-emerald-600/50 text-emerald-400 bg-emerald-950/30">
					<CheckCircle className="h-3 w-3 mr-1" />
					Approved
				</Badge>
			);
		case 'rejected':
			return (
				<Badge variant="outline" className="border-red-600/50 text-red-400 bg-red-950/30">
					<XCircle className="h-3 w-3 mr-1" />
					Rejected
				</Badge>
			);
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

// ═══════════════════════════════════════════════════════════════
// Evidence preview component
// ═══════════════════════════════════════════════════════════════

function EvidencePreview({ type, url }: { type: string; url: string }) {
	if (type === 'image') {
		return (
			<a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2">
				<div className="w-10 h-10 rounded border border-zinc-700 overflow-hidden bg-zinc-800 flex items-center justify-center">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={url} alt="Evidence" className="w-full h-full object-cover" />
				</div>
				<span className="text-xs text-zinc-500 group-hover:text-zinc-300 flex items-center gap-1">
					<ImageIcon className="h-3 w-3" />
					Screenshot
				</span>
			</a>
		);
	}

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 max-w-[200px] truncate"
		>
			<Link2 className="h-3 w-3 shrink-0" />
			<span className="truncate">{url}</span>
			<ExternalLink className="h-3 w-3 shrink-0" />
		</a>
	);
}

// ═══════════════════════════════════════════════════════════════
// Reject modal
// ═══════════════════════════════════════════════════════════════

function RejectModal({
	open,
	onClose,
	onReject,
	isLoading,
}: {
	open: boolean;
	onClose: () => void;
	onReject: (reason: string) => void;
	isLoading: boolean;
}) {
	const [reason, setReason] = useState('');

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md mx-4">
				<h3 className="text-lg font-semibold text-zinc-100 mb-2">Reject Submission</h3>
				<p className="text-sm text-zinc-400 mb-4">
					Please provide a reason. The user will see this in their rejection email.
				</p>
				<textarea
					value={reason}
					onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
					placeholder="e.g., Post doesn't mention Gemz, screenshot is unclear..."
					className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded-md p-3 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
					disabled={isLoading}
				/>
				<div className="flex gap-2 mt-4 justify-end">
					<Button
						variant="outline"
						size="sm"
						className="border-zinc-700"
						onClick={onClose}
						disabled={isLoading}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						className="bg-red-600 hover:bg-red-500 text-white"
						onClick={() => onReject(reason)}
						disabled={!reason.trim() || isLoading}
					>
						{isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
						Reject
					</Button>
				</div>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════
// Confirm modal
// ═══════════════════════════════════════════════════════════════

function ConfirmModal({
	open,
	onClose,
	onConfirm,
	isLoading,
	userName,
}: {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	isLoading: boolean;
	userName: string;
}) {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md mx-4">
				<h3 className="text-lg font-semibold text-zinc-100 mb-2">Approve Submission</h3>
				<p className="text-sm text-zinc-400 mb-4">
					This will grant <strong className="text-zinc-200">{userName}</strong> a free month
					by extending their subscription by 30 days. This action cannot be undone.
				</p>
				<div className="flex gap-2 justify-end">
					<Button
						variant="outline"
						size="sm"
						className="border-zinc-700"
						onClick={onClose}
						disabled={isLoading}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						className="bg-emerald-600 hover:bg-emerald-500 text-white"
						onClick={onConfirm}
						disabled={isLoading}
					>
						{isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
						Approve &amp; Extend
					</Button>
				</div>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════
// Main admin page
// ═══════════════════════════════════════════════════════════════

export default function AdminSocialSharingPage() {
	const [submissions, setSubmissions] = useState<Submission[]>([]);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [emailSearch, setEmailSearch] = useState('');
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);

	// Modal state
	const [rejectModalId, setRejectModalId] = useState<string | null>(null);
	const [approveModalSubmission, setApproveModalSubmission] = useState<Submission | null>(null);

	const fetchSubmissions = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (statusFilter !== 'all') params.set('status', statusFilter);
			if (emailSearch.trim()) params.set('email', emailSearch.trim());
			params.set('page', String(page));
			params.set('pageSize', '20');

			const res = await fetch(`/api/admin/social-sharing?${params.toString()}`);
			if (!res.ok) {
				toast.error('Failed to load submissions');
				return;
			}

			const json = await res.json();
			const data = json.data ?? json;
			setSubmissions(data.submissions ?? []);
			setTotalPages(data.totalPages ?? 1);
			setTotal(data.total ?? 0);
		} catch {
			toast.error('Failed to load submissions');
		} finally {
			setLoading(false);
		}
	}, [statusFilter, emailSearch, page]);

	useEffect(() => {
		fetchSubmissions();
	}, [fetchSubmissions]);

	const handleApprove = async () => {
		if (!approveModalSubmission) return;

		setActionLoading(approveModalSubmission.id);
		try {
			const res = await fetch('/api/admin/social-sharing/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ submissionId: approveModalSubmission.id }),
			});

			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Failed to approve');
				return;
			}

			toast.success('Submission approved! Free month granted.');
			setApproveModalSubmission(null);
			await fetchSubmissions();
		} catch {
			toast.error('Something went wrong');
		} finally {
			setActionLoading(null);
		}
	};

	const handleReject = async (reason: string) => {
		if (!rejectModalId) return;

		setActionLoading(rejectModalId);
		try {
			const res = await fetch('/api/admin/social-sharing/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ submissionId: rejectModalId, reason }),
			});

			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Failed to reject');
				return;
			}

			toast.success('Submission rejected. User notified.');
			setRejectModalId(null);
			await fetchSubmissions();
		} catch {
			toast.error('Something went wrong');
		} finally {
			setActionLoading(null);
		}
	};

	const statusCounts = {
		all: total,
		pending: submissions.filter((s: Submission) => s.status === 'pending').length,
	};

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-zinc-100">Social Sharing Submissions</h1>
				<p className="text-zinc-400 mt-1">
					Review user submissions and grant free months
				</p>
			</div>

			{/* Filters */}
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardContent className="p-4">
					<div className="flex flex-col sm:flex-row gap-3">
						{/* Status filter buttons */}
						<div className="flex gap-1">
							{(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
								<Button
									key={s}
									size="sm"
									variant={statusFilter === s ? 'default' : 'outline'}
									className={statusFilter === s
										? 'bg-violet-600 hover:bg-violet-500 text-white'
										: 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}
									onClick={() => {
										setStatusFilter(s);
										setPage(1);
									}}
								>
									{s.charAt(0).toUpperCase() + s.slice(1)}
								</Button>
							))}
						</div>

						{/* Email search */}
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
							<Input
								type="text"
								placeholder="Search by email..."
								value={emailSearch}
								onChange={(e: ChangeEvent<HTMLInputElement>) => {
									setEmailSearch(e.target.value);
									setPage(1);
								}}
								className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600"
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Table */}
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium text-zinc-400">
						{total} submission{total !== 1 ? 's' : ''} found
					</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
						</div>
					) : submissions.length === 0 ? (
						<div className="text-center py-12 text-zinc-500">
							No submissions found
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="border-zinc-800 hover:bg-transparent">
									<TableHead className="text-zinc-400">User</TableHead>
									<TableHead className="text-zinc-400">Date</TableHead>
									<TableHead className="text-zinc-400">Evidence</TableHead>
									<TableHead className="text-zinc-400">Status</TableHead>
									<TableHead className="text-zinc-400 text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{submissions.map((sub: Submission) => (
									<TableRow key={sub.id} className="border-zinc-800">
										<TableCell>
											<div>
												<p className="text-sm font-medium text-zinc-200">
													{sub.userFullName || 'Unknown'}
												</p>
												<p className="text-xs text-zinc-500">{sub.userEmail || 'No email'}</p>
											</div>
										</TableCell>
										<TableCell>
											<span className="text-sm text-zinc-400">
												{new Date(sub.createdAt).toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric',
												})}
											</span>
										</TableCell>
										<TableCell>
											<EvidencePreview type={sub.evidenceType} url={sub.evidenceUrl} />
										</TableCell>
										<TableCell>
											<StatusBadge status={sub.status} />
											{sub.adminNotes && sub.status === 'rejected' && (
												<p className="text-xs text-zinc-600 mt-1 max-w-[200px] truncate">
													{sub.adminNotes}
												</p>
											)}
										</TableCell>
										<TableCell className="text-right">
											{sub.status === 'pending' && (
												<div className="flex gap-2 justify-end">
													<Button
														size="sm"
														className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
														onClick={() => setApproveModalSubmission(sub)}
														disabled={actionLoading === sub.id}
													>
														{actionLoading === sub.id ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															'Approve'
														)}
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="border-red-700/50 text-red-400 hover:bg-red-950/30 h-8"
														onClick={() => setRejectModalId(sub.id)}
														disabled={actionLoading === sub.id}
													>
														Reject
													</Button>
												</div>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
							<span className="text-xs text-zinc-500">
								Page {page} of {totalPages}
							</span>
							<div className="flex gap-1">
								<Button
									size="sm"
									variant="outline"
									className="border-zinc-700 h-8"
									disabled={page <= 1}
									onClick={() => setPage((p: number) => p - 1)}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="border-zinc-700 h-8"
									disabled={page >= totalPages}
									onClick={() => setPage((p: number) => p + 1)}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Modals */}
			<ConfirmModal
				open={!!approveModalSubmission}
				onClose={() => setApproveModalSubmission(null)}
				onConfirm={handleApprove}
				isLoading={!!actionLoading}
				userName={approveModalSubmission?.userFullName || approveModalSubmission?.userEmail || 'this user'}
			/>
			<RejectModal
				open={!!rejectModalId}
				onClose={() => setRejectModalId(null)}
				onReject={handleReject}
				isLoading={!!actionLoading}
			/>
		</div>
	);
}
