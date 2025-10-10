'use client';

// Dashboard > RecentListsSection => consumed by app/dashboard/page.jsx

import { Card } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/dashboard/formatters';
import { Users, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

type RecentList = {
  id: string;
  name: string;
  description?: string | null;
  creatorCount: number;
  updatedAt: string;
  slug?: string | null;
};

type RecentListsProps = {
  title?: string;
  lists: RecentList[];
  emptyMessage?: string;
};

const MAX_DESCRIPTION_LENGTH = 82;

function truncate(text: string | null | undefined): string {
  if (!text) return '';
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  return `${text.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()}...`;
}

// Card renderer invoked by RecentListsSection -> dashboard page integrates the section
function RecentListCard({ list }: { list: RecentList }) {
  const href = list.slug ? `/lists/${list.slug}` : `/lists/${list.id}`;
  const relativeTime = formatRelativeTime(list.updatedAt);
  return (
    <Link href={href} className="block h-full">
      <Card className="group relative flex h-full flex-col justify-between rounded-2xl border border-zinc-700/40 bg-zinc-900/70 p-4 transition hover:border-zinc-600/60 hover:bg-zinc-900/90 cursor-pointer">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-zinc-50 truncate">
                {list.name}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{truncate(list.description)}</p>
            </div>
            <MoreHorizontal className="h-4 w-4 text-zinc-600 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-medium text-zinc-300">{list.creatorCount}</span>
            <span className="text-zinc-500">influencers</span>
          </span>
          <span className="text-zinc-400">{relativeTime}</span>
        </div>
      </Card>
    </Link>
  );
}

// Exported for app/dashboard/page.jsx to embed under the metrics grid
export function RecentListsSection({ title = 'Recent Lists', lists, emptyMessage = 'No lists to show yet.' }: RecentListsProps) {
  if (!lists.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lists.map((list) => (
        <RecentListCard key={list.id} list={list} />
      ))}
    </div>
  );
}
