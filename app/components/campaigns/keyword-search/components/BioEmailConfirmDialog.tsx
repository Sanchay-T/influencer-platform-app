/**
 * BioEmailConfirmDialog - Confirmation dialog when bio email is found.
 * Asks user whether to use the bio email or enrich anyway.
 */

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface BioEmailDialogState {
	open: boolean;
	creator: unknown;
	bioEmail: string | null;
	enrichmentTarget: {
		handle?: string;
		platform?: string;
	} | null;
}

export interface BioEmailConfirmDialogProps {
	dialogState: BioEmailDialogState;
	onOpenChange: (open: boolean) => void;
	onUseBioEmail: () => void;
	onEnrichAnyway: () => void;
}

export function BioEmailConfirmDialog({
	dialogState,
	onOpenChange,
	onUseBioEmail,
	onEnrichAnyway,
}: BioEmailConfirmDialogProps) {
	return (
		<AlertDialog open={dialogState.open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="border-zinc-800 bg-zinc-900">
				<AlertDialogHeader>
					<AlertDialogTitle className="text-zinc-100">Email Already Found</AlertDialogTitle>
					<AlertDialogDescription className="text-zinc-400">
						We found an email in this creator&apos;s bio:{' '}
						<strong className="text-emerald-400">{dialogState.bioEmail}</strong>
						<br />
						<br />
						Enriching will use a credit to get additional contact info from our database. Would you
						like to use the bio email or enrich anyway?
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel
						onClick={onUseBioEmail}
						className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
					>
						Use Bio Email
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onEnrichAnyway}
						className="bg-pink-500 text-pink-950 hover:bg-pink-500/90"
					>
						Enrich Anyway
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
