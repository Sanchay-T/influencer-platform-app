import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isAdminUser } from '@/lib/auth/admin-utils';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
	const isAdmin = await isAdminUser();
	if (!isAdmin) {
		notFound();
	}

	return <>{children}</>;
}
