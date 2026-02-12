import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isAdminUser } from '@/lib/auth/admin-utils';

export default async function AdminLayout({ children }: { children: ReactNode }) {
	const isAdmin = await isAdminUser();
	if (!isAdmin) {
		notFound();
	}

	return <>{children}</>;
}

