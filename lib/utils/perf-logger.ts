/**
 * Simple performance logger for API routes
 * Usage: const perf = createPerfLogger('route-name'); ... perf.log('step'); ... perf.end();
 */

export function createPerfLogger(routeName: string) {
	const start = performance.now();
	let lastMark = start;
	const marks: { step: string; elapsed: number; sinceLast: number }[] = [];

	return {
		log(step: string) {
			const now = performance.now();
			marks.push({
				step,
				elapsed: Math.round(now - start),
				sinceLast: Math.round(now - lastMark),
			});
			lastMark = now;
		},
		end() {
			const total = Math.round(performance.now() - start);
			const summary = marks.map((m) => `${m.step}: ${m.sinceLast}ms`).join(' → ');
			// Only log if slow (>200ms) or in verbose mode
			if (total > 200 || process.env.PERF_VERBOSE === 'true') {
				console.log(`⏱️ [${routeName}] ${total}ms total | ${summary}`);
			}
			return { total, marks };
		},
	};
}
