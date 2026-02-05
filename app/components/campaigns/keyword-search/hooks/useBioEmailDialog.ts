/**
 * useBioEmailDialog - Hook for managing bio email confirmation dialog state.
 * Handles the "Use Bio Email" vs "Enrich Anyway" flow.
 */

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getRecordProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';

export interface BioEmailDialogState {
	open: boolean;
	creator: Record<string, unknown> | null;
	bioEmail: string | null;
	enrichmentTarget: Record<string, unknown> | null;
}

export interface UseBioEmailDialogOptions {
	jobId?: string;
	setCreators: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>;
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
			const creatorRecord = toRecord(creator) ?? {};
			const ownerRecord = getRecordProperty(creatorRecord, 'owner');
			const ownerId = ownerRecord ? getStringProperty(ownerRecord, 'id') : null;
			const creatorId = ownerId ?? getStringProperty(creatorRecord, 'id');
			if (!creatorId) {
				throw new Error('Missing creator id');
			}
			const response = await fetch('/api/creators/save-bio-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jobId,
					creatorId,
					email: bioEmail,
				}),
			});

			if (response.ok) {
				setCreators((prev) =>
					prev.map((c) => {
						const cRecord = toRecord(c) ?? {};
						const cOwner = getRecordProperty(cRecord, 'owner');
						const cOwnerId = cOwner ? getStringProperty(cOwner, 'id') : null;
						if (cOwnerId && ownerId && cOwnerId === ownerId) {
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
			structuredConsole.error('Error saving bio email', error);
			toast.error('Failed to save email');
		}

		closeDialog();
	}, [dialogState, jobId, setCreators, closeDialog]);

	const handleEnrichAnyway = useCallback(async () => {
		const { enrichmentTarget, creator } = dialogState;
		closeDialog();

		if (enrichmentTarget) {
			const record = await enrichCreator({
				...enrichmentTarget,
				forceRefresh: false,
			});
			if (record) {
				applyEnrichmentToCreators(record, enrichmentTarget, creator, 'interactive');
			}
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
