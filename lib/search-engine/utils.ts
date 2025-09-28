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
