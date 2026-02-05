/**
 * CSV Streaming Utilities
 *
 * @context Handles large CSV exports without loading all data into memory.
 * Critical for campaign exports with 10K+ creators.
 */

/**
 * Creates a ReadableStream that yields CSV rows from a generator.
 * Uses TextEncoder for efficient string-to-bytes conversion.
 */
export function createCsvStream(
	headers: string[],
	rowGenerator: AsyncGenerator<string[], void, unknown>
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();

	return new ReadableStream({
		async start(controller) {
			// Write headers first
			controller.enqueue(encoder.encode(`${headers.join(',')}\n`));
		},
		async pull(controller) {
			try {
				const { value: row, done } = await rowGenerator.next();

				if (done) {
					controller.close();
					return;
				}

				// Format and enqueue the row
				const csvRow = `${row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')}\n`;
				controller.enqueue(encoder.encode(csvRow));
			} catch (error) {
				controller.error(error);
			}
		},
	});
}

/**
 * Formats a value for CSV output, handling special characters.
 */
export function formatCsvCell(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'object') {
		return JSON.stringify(value).replace(/"/g, '""');
	}
	return String(value).replace(/"/g, '""');
}

/**
 * Creates CSV response headers with proper content type and filename.
 */
export function createCsvHeaders(filename: string): Headers {
	const headers = new Headers();
	headers.set('Content-Type', 'text/csv; charset=utf-8');
	headers.set('Content-Disposition', `attachment; filename="${filename}"`);
	headers.set('Transfer-Encoding', 'chunked');
	return headers;
}
