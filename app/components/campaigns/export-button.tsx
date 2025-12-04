import { Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { campaignLogger } from '@/lib/logging';
import { useComponentLogger, useUserActionLogger } from '@/lib/logging/react-logger';
import { ErrorBoundary } from '../error-boundary';

interface ExportButtonProps {
	jobId?: string;
	campaignId?: string;
	disabled?: boolean;
	className?: string;
	variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

function ExportButtonContent({
	jobId,
	campaignId,
	disabled = false,
	className,
	variant = 'default',
}: ExportButtonProps) {
	const componentLogger = useComponentLogger('ExportButton', { jobId, campaignId });
	const userActionLogger = useUserActionLogger();
	const handleExport = async () => {
		try {
			toast.loading('Preparing export...', { id: 'export-loading' });
			let url = '';
			if (campaignId) {
				url = `/api/export/csv?campaignId=${campaignId}`;
				campaignLogger.info('Initiating export for campaign', {
					campaignId,
					operation: 'export-start',
					exportType: 'campaign',
				});
			} else if (jobId) {
				url = `/api/export/csv?jobId=${jobId}`;
				campaignLogger.info('Initiating export for job', {
					jobId,
					operation: 'export-start',
					exportType: 'job',
				});
			} else {
				toast.error('No job or campaign selected', { id: 'export-loading' });
				return;
			}
			const response = await fetch(url);
			campaignLogger.info('Export API response received', {
				statusCode: response.status,
				campaignId,
				jobId,
				operation: 'export-api-response',
			});

			if (!response.ok) {
				let errorMessage = 'Error exporting data';
				try {
					const errorData = await response.json();
					campaignLogger.error('Export API error details', new Error(errorMessage), {
						errorData,
						statusCode: response.status,
						campaignId,
						jobId,
						operation: 'export-api-error',
					});
					errorMessage = errorData.error || errorData.details || errorMessage;

					if (errorData.details) {
						errorMessage = `${errorMessage}: ${errorData.details}`;
					}
				} catch (parseError) {
					campaignLogger.error(
						'Error parsing export error response',
						parseError instanceof Error ? parseError : new Error(String(parseError)),
						{
							statusCode: response.status,
							campaignId,
							jobId,
							operation: 'export-parse-error',
						}
					);
					errorMessage = `Export failed with status ${response.status}`;
				}
				throw new Error(errorMessage);
			}

			// Get CSV blob
			const blob = await response.blob();
			campaignLogger.info('Export blob received', {
				blobSize: blob.size,
				campaignId,
				jobId,
				operation: 'export-blob-received',
			});

			if (blob.size === 0) {
				throw new Error('Exported file is empty');
			}

			// Create download URL
			url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `creators-${new Date().toISOString().split('T')[0]}.csv`;
			document.body.appendChild(a);
			a.click();

			// Cleanup
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			toast.success('CSV file exported successfully', { id: 'export-loading' });

			campaignLogger.info('Export completed successfully', {
				fileName: `creators-${new Date().toISOString().split('T')[0]}.csv`,
				blobSize: blob.size,
				campaignId,
				jobId,
				operation: 'export-success',
			});
		} catch (error) {
			campaignLogger.error(
				'Export failed',
				error instanceof Error ? error : new Error(String(error)),
				{
					campaignId,
					jobId,
					operation: 'export-failure',
				}
			);
			toast.error(error instanceof Error ? error.message : 'Error exporting CSV', {
				id: 'export-loading',
			});
		}
	};

	return (
		<Button
			onClick={() => {
				userActionLogger.logClick('export-csv-button', {
					campaignId,
					jobId,
					operation: 'export-csv-clicked',
				});
				handleExport();
			}}
			disabled={disabled}
			className={className}
			variant={variant}
		>
			<Download className="mr-2 h-4 w-4" />
			Export CSV
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
