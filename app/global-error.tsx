'use client';

import { useEffect } from 'react';

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log error to console (Sentry removed)
		console.error('[GLOBAL_ERROR]', {
			message: error.message,
			digest: error.digest,
			stack: error.stack,
		});
	}, [error]);

	return (
		<html>
			<body>
				<div className="flex items-center justify-center min-h-screen bg-gray-100">
					<div className="text-center">
						<h2 className="text-2xl font-bold text-gray-800 mb-4">Something went wrong!</h2>
						<p className="text-gray-600 mb-4">An error occurred. Please try again.</p>
						<button
							className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
							onClick={() => reset()}
						>
							Try again
						</button>
					</div>
				</div>
			</body>
		</html>
	);
}
