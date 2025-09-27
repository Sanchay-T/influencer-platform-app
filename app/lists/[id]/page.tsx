import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import ListDetailClient from './_components/list-detail-client';
import { getListDetailCached } from '@/lib/lists/overview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ListDetailPageProps {
  params: { id: string };
}

export default async function ListDetailPage({ params }: ListDetailPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  try {
    const detail = await getListDetailCached(userId, params.id);
    return <ListDetailClient initialDetail={detail} listId={params.id} />;
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'LIST_NOT_FOUND' || message === 'USER_NOT_FOUND') {
      notFound();
    }
    throw error;
  }
}
