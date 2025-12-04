import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getListSummaries } from '@/lib/lists/overview';
import { structuredConsole } from '@/lib/logging/console-proxy';
import ListsPageClient from './_components/lists-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ListsPage() {
	const { userId } = await auth();
	if (process.env.NODE_ENV !== 'production') {
		structuredConsole.log('[LISTS-RSC] auth()', { userId });
	}

	if (!userId) {
		redirect('/sign-in');
	}

	try {
		const lists = await getListSummaries(userId);
		if (process.env.NODE_ENV !== 'production') {
			structuredConsole.log('[LISTS-RSC] loaded summaries', { count: lists.length });
		}
		return <ListsPageClient initialLists={lists} />;
	} catch (error) {
		structuredConsole.error('[LISTS-RSC] error loading summaries', error);
		const message = (error as Error).message;
		if (message === 'USER_NOT_FOUND') {
			redirect('/onboarding/step-1');
		}
		throw error;
	}
}
