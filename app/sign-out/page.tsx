'use client';

import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { structuredConsole } from '@/lib/logging/console-proxy';

export default function SignOutPage() {
	const { signOut } = useClerk();
	const router = useRouter();

	useEffect(() => {
		let isMounted = true;

		const runSignOut = async () => {
			try {
				await signOut();
			} catch (error) {
				structuredConsole.error('Sign out failed', error);
			} finally {
				if (isMounted) {
					router.replace('/');
				}
			}
		};

		runSignOut().catch((error) => {
			structuredConsole.error('Sign out failed', error);
		});

		return () => {
			isMounted = false;
		};
	}, [router, signOut]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
			<div className="text-center space-y-2">
				<p className="text-lg font-semibold">Signing you out…</p>
				<p className="text-sm text-zinc-400">You’ll be redirected shortly.</p>
			</div>
		</div>
	);
}
