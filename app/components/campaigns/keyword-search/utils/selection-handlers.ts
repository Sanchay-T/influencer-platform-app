/**
 * Selection state management utilities.
 * Extracted from search-results.jsx for modularity.
 */

import type { CreatorSnapshot } from './creator-snapshot';

export interface SelectedCreators {
	[key: string]: CreatorSnapshot;
}

export type SetSelectedCreators = React.Dispatch<React.SetStateAction<SelectedCreators>>;

/**
 * Toggles selection of a single creator.
 */
export const toggleSelection = (
	rowId: string,
	snapshot: CreatorSnapshot,
	setSelectedCreators: SetSelectedCreators
): void => {
	setSelectedCreators((prev) => {
		const newSelected = { ...prev };
		if (newSelected[rowId]) {
			delete newSelected[rowId];
		} else {
			newSelected[rowId] = snapshot;
		}
		return newSelected;
	});
};

/**
 * Selects or deselects all creators on the current page.
 */
export const handleSelectPage = (
	selectAll: boolean,
	currentRows: Array<{ id: string; snapshot: CreatorSnapshot }>,
	setSelectedCreators: SetSelectedCreators
): void => {
	setSelectedCreators((prev) => {
		const newSelected = { ...prev };
		for (const row of currentRows) {
			if (selectAll) {
				newSelected[row.id] = row.snapshot;
			} else {
				delete newSelected[row.id];
			}
		}
		return newSelected;
	});
};

/**
 * Clears all selected creators.
 */
export const clearSelection = (setSelectedCreators: SetSelectedCreators): void => {
	setSelectedCreators({});
};

/**
 * Checks if all items on current page are selected.
 */
export const areAllSelectedOnPage = (
	currentRowIds: string[],
	selectedCreators: SelectedCreators
): boolean => {
	if (currentRowIds.length === 0) {
		return false;
	}
	return currentRowIds.every((id) => Boolean(selectedCreators[id]));
};

/**
 * Checks if some (but not all) items on current page are selected.
 */
export const areSomeSelectedOnPage = (
	currentRowIds: string[],
	selectedCreators: SelectedCreators
): boolean => {
	const selectedCount = currentRowIds.filter((id) => Boolean(selectedCreators[id])).length;
	return selectedCount > 0 && selectedCount < currentRowIds.length;
};
