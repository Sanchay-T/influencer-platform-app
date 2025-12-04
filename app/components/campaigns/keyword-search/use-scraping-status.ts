import { useEffect, useState } from 'react';

export function useScrapingStatus(jobId: string | null) {
	const [status, setStatus] = useState<'pending' | 'running' | 'completed' | 'timeout' | 'error'>(
		'pending'
	);
	const [creators, setCreators] = useState([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!jobId) return;

		const checkStatus = async () => {
			try {
				const response = await fetch(`/api/scraping/tiktok?jobId=${jobId}`);
				const data = await response.json();

				if (data.error) {
					setError(data.error);
					setStatus('error');
					return;
				}

				setStatus(data.status);
				if (data.creators) {
					setCreators(data.creators);
				}

				// Si no está completado o con error, seguimos polling
				if (!['completed', 'error', 'timeout'].includes(data.status)) {
					setTimeout(checkStatus, 5000); // 5 segundos
				}
			} catch (err) {
				setError('Error al verificar estado');
				setStatus('error');
			}
		};

		checkStatus();
	}, [jobId]);

	return { status, creators, error };
}
