import { Receiver } from '@upstash/qstash';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { qstash } from '@/lib/queue/qstash';

// Inicializar el receptor de QStash
const receiver = new Receiver({
	currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
	nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: Request) {
	structuredConsole.log('📊 Monitoreando progreso en /api/qstash/process-results');

	const signature = req.headers.get('Upstash-Signature');
	if (!signature) {
		return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
	}

	try {
		// Obtener la URL base del ambiente actual
		const currentHost =
			req.headers.get('host') || process.env.VERCEL_URL || 'influencerplatform.vercel.app';
		const protocol = currentHost.includes('localhost') ? 'http' : 'https';
		const baseUrl = `${protocol}://${currentHost}`;

		structuredConsole.log('🌐 URL Base:', baseUrl);

		// Leer el cuerpo una sola vez
		const body = await req.text();
		let jobId: string;

		// Verificar firma usando la URL actual
		try {
			const isValid = await receiver.verify({
				signature,
				body,
				url: `${baseUrl}/api/qstash/process-results`,
			});

			if (!isValid) {
				return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
			}
		} catch (verifyError: any) {
			structuredConsole.error('❌ Error al verificar la firma:', verifyError);
			return NextResponse.json(
				{
					error: `Signature verification error: ${verifyError.message || 'Unknown error'}`,
				},
				{ status: 401 }
			);
		}

		try {
			// Parsear el cuerpo como JSON
			const data = JSON.parse(body);
			jobId = data.jobId;
		} catch (error: any) {
			structuredConsole.error('❌ Error al parsear el cuerpo de la solicitud:', error);
			return NextResponse.json(
				{
					error: `Invalid JSON body: ${error.message || 'Unknown error'}`,
				},
				{ status: 400 }
			);
		}

		if (!jobId) {
			return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
		}

		// Obtener job de la base de datos
		let job;
		try {
			job = await db.query.scrapingJobs.findFirst({
				where: (jobs, { eq }) => eq(jobs.id, jobId),
			});
		} catch (dbError: any) {
			structuredConsole.error('❌ Error al obtener el job de la base de datos:', dbError);
			return NextResponse.json(
				{
					error: `Database error: ${dbError.message || 'Unknown error'}`,
				},
				{ status: 500 }
			);
		}

		if (!job) {
			return NextResponse.json({ error: 'Job not found' }, { status: 404 });
		}

		structuredConsole.log('📊 Estado actual:', {
			jobId,
			status: job.status,
			processedResults: job.processedResults,
			targetResults: job.targetResults,
			cursor: job.cursor,
		});

		// Si el job está en error o completado, no hacer nada más
		if (job.status === 'error' || job.status === 'completed') {
			return NextResponse.json({
				status: job.status,
				processedResults: job.processedResults,
				targetResults: job.targetResults,
				error: job.error,
			});
		}

		// Si el job está en timeout, marcarlo
		if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
			try {
				await db
					.update(scrapingJobs)
					.set({
						status: 'timeout',
						error: 'Job exceeded maximum allowed time',
						completedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(scrapingJobs.id, jobId));
			} catch (dbError: any) {
				structuredConsole.error('❌ Error al actualizar el job con timeout:', dbError);
				// Continuamos con la respuesta de timeout aunque falle la actualización
			}

			return NextResponse.json({
				status: 'timeout',
				error: 'Job exceeded maximum allowed time',
			});
		}

		// @performance Only schedule continuation if job is STILL in processing status
		// This prevents exponential message explosion from QStash retries/duplicates
		// Critical: Check status === 'processing' BEFORE scheduling, not just != completed/error
		if (job.status !== 'processing') {
			structuredConsole.log('📊 Job is not in processing status, skipping continuation', {
				jobId,
				status: job.status,
			});
			return NextResponse.json({
				status: job.status,
				processedResults: job.processedResults,
				targetResults: job.targetResults,
				skipped: true,
				reason: 'not_processing',
			});
		}

		// Si el job sigue en proceso, encolar otro monitoreo
		try {
			await qstash.publishJSON({
				url: `${baseUrl}/api/qstash/process-results`,
				body: { jobId: job.id },
				delay: '30s',
				retries: 3,
				notifyOnFailure: true,
			});
		} catch (queueError: any) {
			structuredConsole.error('❌ Error al encolar el siguiente monitoreo:', queueError);
			// No devolvemos error aquí, ya que el job ya se ha verificado correctamente
		}

		return NextResponse.json({
			status: 'monitoring',
			processedResults: job.processedResults,
			targetResults: job.targetResults,
			nextCheck: '30 seconds',
		});
	} catch (error: any) {
		structuredConsole.error('❌ Error:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
