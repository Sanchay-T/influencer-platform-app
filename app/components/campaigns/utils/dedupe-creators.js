// Bridge to shared dedupe helper so client, API, and persistence stay consistent.
import sharedDedupeCreators from '@/lib/utils/dedupe-creators';

export const dedupeCreators = (creators = [], options = {}) => sharedDedupeCreators(creators, options);

export default dedupeCreators;
