'use client';

import { Download, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { campaignLogger } from '@/lib/logging';
import { useUserActionLogger } from '@/lib/logging/react-logger';
import { ErrorBoundary } from '../error-boundary';

interface ExportButtonProps {
	jobId?: string;
	campaignId?: string;
	disabled?: boolean;
	className?: string;
	variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes max

function ExportButtonContent({
	jobId,
	campaignId,
	disabled = false,
	className,
	variant = 'default',
}: ExportButtonProps) {
	const userActionLogger = useUserActionLogger();
	const [isExporting, setIsExporting] = useState(false);
	const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const startTimeRef = useRef<number>(0);

	const downloadFile = (url: string) => {
		const link = document.createElement('a');
		link.href = url;
		link.download = `creators-${new Date().toISOString().split('T')[0]}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const pollExportStatus = async (exportId: string) => {
		// Check if we've exceeded max poll time
		if (Date.now() - startTimeRef.current > MAX_POLL_TIME) {
			toast.error('Export is taking too long. Check back later.', { id: 'export-progress' });
			setIsExporting(false);
			return;
		}

		try {
			const response = await fetch(`/api/export/status/${exportId}`);
			if (!response.ok) {
				throw new Error('Failed to check export status');
			}

			const data = await response.json();

			if (data.status === 'completed' && data.downloadUrl) {
				toast.success('Export ready! Downloading...', { id: 'export-progress', duration: 3000 });
				downloadFile(data.downloadUrl);
				setIsExporting(false);
				campaignLogger.info('Export completed and downloaded', { exportId });
			} else if (data.status === 'failed') {
				toast.error(data.error || 'Export failed', { id: 'export-progress' });
				setIsExporting(false);
				campaignLogger.error('Export failed', new Error(data.error || 'Unknown error'), {
					exportId,
				});
			} else {
				// Still processing, poll again
				pollTimeoutRef.current = setTimeout(() => pollExportStatus(exportId), POLL_INTERVAL);
			}
		} catch (error) {
			toast.error('Error checking export status', { id: 'export-progress' });
			setIsExporting(false);
		}
	};

	const handleExport = async () => {
		if (isExporting) return;

		try {
			setIsExporting(true);
			startTimeRef.current = Date.now();

			toast.loading('Preparing your export...', { id: 'export-progress', duration: Infinity });

			let url = '';
			if (campaignId) {
				url = `/api/export/csv?campaignId=${campaignId}`;
			} else if (jobId) {
				url = `/api/export/csv?jobId=${jobId}`;
			} else {
				toast.error('No job or campaign selected', { id: 'export-progress' });
				setIsExporting(false);
				return;
			}

			const response = await fetch(url);

			if (!response.ok) {
				let errorMessage = 'Error starting export';
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorData.details || errorMessage;
					if (errorData.upgrade) {
						errorMessage = `${errorMessage}. Please upgrade your plan.`;
					}
				} catch {
					errorMessage = `Export failed with status ${response.status}`;
				}
				throw new Error(errorMessage);
			}

			const data = await response.json();
			campaignLogger.info('Export queued', { exportId: data.exportId, campaignId, jobId });

			// Start polling for status
			pollExportStatus(data.exportId);
		} catch (error) {
			campaignLogger.error(
				'Export failed',
				error instanceof Error ? error : new Error(String(error)),
				{ campaignId, jobId }
			);
			toast.error(error instanceof Error ? error.message : 'Error starting export', {
				id: 'export-progress',
			});
			setIsExporting(false);
		}
	};

	return (
		<Button
			onClick={() => {
				userActionLogger.logClick('export-csv-button', { campaignId, jobId });
				handleExport();
			}}
			disabled={disabled || isExporting}
			className={className}
			variant={variant}
		>
			{isExporting ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<Download className="mr-2 h-4 w-4" />
			)}
			{isExporting ? 'Exporting...' : 'Export CSV'}
		</Button>
	);
}

export default function ExportButton(props: ExportButtonProps) {
	return (
		<ErrorBoundary componentName="ExportButton">
			<ExportButtonContent {...props} />
		</ErrorBoundary>
	);
}
