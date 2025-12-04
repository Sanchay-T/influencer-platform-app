import { and, eq, lt, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

// Configuración de limpieza
const CLEANUP_CONFIG = {
	// Jobs más antiguos que estos días serán eliminados
	maxAgeDays: {
		completed: 30, // Jobs completados
		error: 7, // Jobs con error
		cancelled: 7, // Jobs cancelados
		timeout: 7, // Jobs con timeout
	},
	// Jobs en proceso más antiguos que estas horas serán marcados como timeout
	timeoutHours: 24,
};

export async function POST() {
	try {
		const now = new Date();

		// 1. Marcar jobs antiguos como timeout
		const timeoutDate = new Date(now.getTime() - CLEANUP_CONFIG.timeoutHours * 60 * 60 * 1000);

		await db
			.update(scrapingJobs)
			.set({
				status: 'timeout',
				error: 'Job exceeded maximum processing time',
				updatedAt: now,
			})
			.where(
				and(
					lt(scrapingJobs.createdAt, timeoutDate),
					or(eq(scrapingJobs.status, 'pending'), eq(scrapingJobs.status, 'processing'))
				)
			);

		// 2. Eliminar jobs antiguos según su estado
		const deletedJobs = {
			completed: 0,
			error: 0,
			cancelled: 0,
			timeout: 0,
		};

		for (const [status, days] of Object.entries(CLEANUP_CONFIG.maxAgeDays)) {
			const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

			// Primero eliminar resultados asociados
			await db
				.delete(scrapingResults)
				.where(and(lt(scrapingResults.createdAt, cutoffDate), eq(scrapingJobs.status, status)));

			// Luego eliminar los jobs
			const result = await db
				.delete(scrapingJobs)
				.where(and(lt(scrapingJobs.createdAt, cutoffDate), eq(scrapingJobs.status, status)))
				.returning();

			deletedJobs[status as keyof typeof deletedJobs] = result.length;
		}

		return NextResponse.json({
			message: 'Cleanup completed successfully',
			deletedJobs,
		});
	} catch (error) {
		structuredConsole.error('Error during cleanup:', error);
		return NextResponse.json({ error: 'Error during cleanup process' }, { status: 500 });
	}
}
