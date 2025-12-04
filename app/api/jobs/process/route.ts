import { Receiver } from '@upstash/qstash';
import { type NextRequest, NextResponse } from 'next/server';
import { JobProcessor } from '@/lib/jobs/job-processor';
import { structuredConsole } from '@/lib/logging/console-proxy';

// QStash receiver for signature verification
const receiver = new Receiver({
	currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
	nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.text();
		const signature = req.headers.get('Upstash-Signature');

		structuredConsole.log('📥 [JOB-PROCESSOR-API] Received job processing request');

		// Verify QStash signature for security
		if (!signature) {
			structuredConsole.error('❌ [JOB-PROCESSOR-API] No signature provided');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Validate webhook signature
		const isValid = await receiver.verify({
			signature,
			body,
			url: req.url,
		});

		if (!isValid) {
			structuredConsole.error('❌ [JOB-PROCESSOR-API] Invalid signature');
			return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
		}

		// Parse job data
		const jobData = JSON.parse(body);
		const { jobId, jobType, payload, attempt = 1, maxRetries = 3 } = jobData;

		structuredConsole.log('🔄 [JOB-PROCESSOR-API] Processing job:', {
			jobId,
			jobType,
			attempt,
			maxRetries,
		});

		// Process the job
		const result = await JobProcessor.processJob(jobId, attempt);

		if (result.success) {
			structuredConsole.log('✅ [JOB-PROCESSOR-API] Job processed successfully:', jobId);
			return NextResponse.json({
				success: true,
				jobId,
				result: result.data,
			});
		} else {
			structuredConsole.error('❌ [JOB-PROCESSOR-API] Job processing failed:', {
				jobId,
				error: result.error,
				retryable: result.retryable,
			});

			// Return appropriate status code based on whether it's retryable
			const status = result.retryable ? 500 : 400;

			return NextResponse.json(
				{
					success: false,
					jobId,
					error: result.error,
					retryable: result.retryable,
				},
				{ status }
			);
		}
	} catch (error) {
		structuredConsole.error('❌ [JOB-PROCESSOR-API] Error processing job request:', error);

		return NextResponse.json(
			{
				success: false,
				error: 'Internal server error',
				retryable: true,
			},
			{ status: 500 }
		);
	}
}

// Health check endpoint
export async function GET() {
	return NextResponse.json({
		status: 'healthy',
		service: 'job-processor',
		timestamp: new Date().toISOString(),
	});
}
