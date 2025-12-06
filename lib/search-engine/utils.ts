// search-engine/utils.ts — small math/util helpers shared across providers

export function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function computeProgress(processedResults: number, targetResults: number) {
  if (!targetResults || targetResults <= 0) return 0;
  return clampProgress((processedResults / targetResults) * 100);
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Split an array into chunks of a given size.
 * Used by providers to batch API calls.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Safely parse a value to a number.
 * Returns null if the value is not a valid finite number.
 */
export function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
