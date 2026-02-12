import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export function useAdmin() {
	const { user, isLoaded } = useUser();

	const [isAdmin, setIsAdmin] = useState(false);
	const [isAdminLoaded, setIsAdminLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function fetchAdminStatus() {
			if (!isLoaded) return;

			// Avoid noisy 401/Clerk rewrites when no user is present.
			if (!user) {
				setIsAdmin(false);
				setIsAdminLoaded(true);
				return;
			}

			try {
				setIsAdminLoaded(false);
				const response = await fetch('/api/admin/me');
				if (!response.ok) {
					throw new Error(`Failed to fetch admin status (${response.status})`);
				}

				const data = (await response.json()) as { isAdmin?: boolean };
				if (!cancelled) {
					setIsAdmin(Boolean(data.isAdmin));
				}
			} catch {
				if (!cancelled) {
					setIsAdmin(false);
				}
			} finally {
				if (!cancelled) {
					setIsAdminLoaded(true);
				}
			}
		}

		fetchAdminStatus();

		return () => {
			cancelled = true;
		};
	}, [isLoaded, user?.id]);

	const userEmail = user?.primaryEmailAddress?.emailAddress || '';

	return {
		isAdmin,
		isLoaded: isLoaded && isAdminLoaded,
		user,
		userEmail,
	};
}
