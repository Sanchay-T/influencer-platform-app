declare module '@playwright/test' {
	export const defineConfig: <T = unknown>(config: T) => T;
	export const devices: Record<string, Record<string, unknown>>;
}
