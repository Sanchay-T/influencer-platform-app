import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getListDetailCached } from '@/lib/lists/overview';
import ListDetailClient from './_components/list-detail-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ListDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function ListDetailPage({ params }: ListDetailPageProps) {
	const resolvedParams = await params;
	const { userId } = await auth();

	if (!userId) {
		redirect('/sign-in');
	}

	try {
		const detail = await getListDetailCached(userId, resolvedParams.id);
		return <ListDetailClient initialDetail={detail} listId={resolvedParams.id} />;
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message === 'LIST_NOT_FOUND' || message === 'USER_NOT_FOUND') {
			notFound();
		}
		throw error;
	}
}
