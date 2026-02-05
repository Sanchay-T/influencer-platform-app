export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord => {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const toRecord = (value: unknown): UnknownRecord | null => {
	return isRecord(value) ? value : null;
};

export const isArray = (value: unknown): value is unknown[] => {
	return Array.isArray(value);
};

export const toArray = (value: unknown): unknown[] | null => {
	return Array.isArray(value) ? value : null;
};

export const isString = (value: unknown): value is string => typeof value === 'string';

export const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0;

export const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const toStringArray = (value: unknown): string[] | null => {
	if (!Array.isArray(value)) {
		return null;
	}
	return value.every((item) => typeof item === 'string') ? value : null;
};

export const getRecordProperty = (record: UnknownRecord, key: string): UnknownRecord | null => {
	const value = record[key];
	return isRecord(value) ? value : null;
};

export const getArrayProperty = (record: UnknownRecord, key: string): unknown[] | null => {
	const value = record[key];
	return Array.isArray(value) ? value : null;
};

export const getStringProperty = (record: UnknownRecord, key: string): string | null => {
	const value = record[key];
	return isString(value) ? value : null;
};

export const getNumberProperty = (record: UnknownRecord, key: string): number | null => {
	const value = record[key];
	return isNumber(value) ? value : null;
};

export const getBooleanProperty = (record: UnknownRecord, key: string): boolean | null => {
	const value = record[key];
	return isBoolean(value) ? value : null;
};

export const getStringArrayProperty = (record: UnknownRecord, key: string): string[] | null => {
	const value = record[key];
	return toStringArray(value);
};

export const hasOwn = <K extends PropertyKey>(obj: object, key: K): obj is Record<K, unknown> =>
	Object.hasOwn(obj, key);

export const toError = (value: unknown): Error =>
	value instanceof Error ? value : new Error(typeof value === 'string' ? value : String(value));
