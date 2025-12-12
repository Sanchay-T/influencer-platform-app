/**
 * CreatorTableHeader - Table header for creator results table.
 * Contains column headers and select-all checkbox.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface CreatorTableHeaderProps {
	allSelectedOnPage: boolean;
	someSelectedOnPage: boolean;
	onSelectPage: (selected: boolean) => void;
}

export function CreatorTableHeader({
	allSelectedOnPage,
	someSelectedOnPage,
	onSelectPage,
}: CreatorTableHeaderProps) {
	return (
		<TableHeader>
			<TableRow className="border-b border-zinc-800">
				<TableHead className="w-12 px-4 py-3">
					<Checkbox
						aria-label="Select page"
						checked={allSelectedOnPage ? true : someSelectedOnPage ? 'indeterminate' : false}
						onCheckedChange={() => onSelectPage(!allSelectedOnPage)}
					/>
				</TableHead>
				<TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
					Profile
				</TableHead>
				<TableHead className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
					Username
				</TableHead>
				<TableHead className="hidden md:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
					Followers
				</TableHead>
				<TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 w-[320px]">
					Bio & Links
				</TableHead>
				<TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
					Email
				</TableHead>
				<TableHead className="hidden lg:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
					Views
				</TableHead>
				<TableHead className="hidden lg:table-cell px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-400">
					Post
				</TableHead>
				<TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
					Enrich
				</TableHead>
				<TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
					Save
				</TableHead>
			</TableRow>
		</TableHeader>
	);
}
