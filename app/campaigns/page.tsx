import Link from 'next/link';
import { Megaphone } from 'lucide-react';

import DashboardLayout from '@/app/components/layout/dashboard-layout';
import CampaignList from '@/app/components/campaigns/CampaignList';
import { Button } from '@/components/ui/button';

export default function CampaignsPage() {
  return (
    <DashboardLayout>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-zinc-100">
            <span className="rounded-md bg-pink-500/10 p-2 text-pink-300">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Campaigns</h1>
              <p className="text-sm text-zinc-400">
                Review existing campaigns or spin up a new search to discover creators.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href="/campaigns/new">New Campaign</Link>
          </Button>
        </header>

        <CampaignList />
      </section>
    </DashboardLayout>
  );
}
