/**
 * useBioEmailDialog - Hook for managing bio email confirmation dialog state.
 * Handles the "Use Bio Email" vs "Enrich Anyway" flow.
 */

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

export interface BioEmailDialogState {
	open: boolean;
	creator: Record<string, unknown> | null;
	bioEmail: string | null;
	enrichmentTarget: Record<string, unknown> | null;
}

export interface UseBioEmailDialogOptions {
	jobId?: string;
	setCreators: React.Dispatch<React.SetStateAction<Array<Record<string, unknown>>>>;
	enrichCreator: (target: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
	applyEnrichmentToCreators: (
		record: Record<string, unknown>,
		target: Record<string, unknown>,
		rawMatch: Record<string, unknown> | null,
		origin: string
	) => void;
}

export interface UseBioEmailDialogResult {
	dialogState: BioEmailDialogState;
	setDialogState: React.Dispatch<React.SetStateAction<BioEmailDialogState>>;
	handleUseBioEmail: () => Promise<void>;
	handleEnrichAnyway: () => void;
	handleOpenChange: (open: boolean) => void;
}

const INITIAL_DIALOG_STATE: BioEmailDialogState = {
	open: false,
	creator: null,
	bioEmail: null,
	enrichmentTarget: null,
};

export function useBioEmailDialog({
	jobId,
	setCreators,
	enrichCreator,
	applyEnrichmentToCreators,
}: UseBioEmailDialogOptions): UseBioEmailDialogResult {
	const [dialogState, setDialogState] = useState<BioEmailDialogState>(INITIAL_DIALOG_STATE);

	const closeDialog = useCallback(() => {
		setDialogState(INITIAL_DIALOG_STATE);
	}, []);

	const handleUseBioEmail = useCallback(async () => {
		const { creator, bioEmail } = dialogState;
		if (!(creator && bioEmail)) {
			closeDialog();
			return;
		}

		try {
			const response = await fetch('/api/creators/save-bio-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jobId,
					creatorId: (creator.owner as Record<string, unknown>)?.id || creator.id,
					email: bioEmail,
				}),
			});

			if (response.ok) {
				setCreators((prev) =>
					prev.map((c) => {
						const cOwner = c.owner as Record<string, unknown> | undefined;
						const creatorOwner = creator.owner as Record<string, unknown> | undefined;
						if (cOwner?.id && creatorOwner?.id && cOwner.id === creatorOwner.id) {
							return { ...c, contact_email: bioEmail, email_source: 'bio' };
						}
						return c;
					})
				);
				toast.success(`Email saved: ${bioEmail}`);
			} else {
				toast.error('Failed to save email');
			}
		} catch (error) {
			console.error('Error saving bio email:', error);
			toast.error('Failed to save email');
		}

		closeDialog();
	}, [dialogState, jobId, setCreators, closeDialog]);

	const handleEnrichAnyway = useCallback(() => {
		const { enrichmentTarget, creator } = dialogState;
		closeDialog();

		if (enrichmentTarget) {
			void (async () => {
				const record = await enrichCreator({
					...enrichmentTarget,
					forceRefresh: false,
				});
				if (record) {
					applyEnrichmentToCreators(record, enrichmentTarget, creator, 'interactive');
				}
			})();
		}
	}, [dialogState, enrichCreator, applyEnrichmentToCreators, closeDialog]);

	const handleOpenChange = useCallback((open: boolean) => {
		setDialogState((prev) => ({ ...prev, open }));
	}, []);

	return {
		dialogState,
		setDialogState,
		handleUseBioEmail,
		handleEnrichAnyway,
		handleOpenChange,
	};
}
