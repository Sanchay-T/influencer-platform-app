import DashboardLayout from "./components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import CampaignList from "./components/campaigns/CampaignList";
import { PlusCircle } from "lucide-react";

export default function Home() {
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your campaigns</h1>
        <Link href="/campaigns/new">
        <Button>
            <PlusCircle className="mr-2" /> Create campaign
        </Button>
        </Link>
      </div>
      <CampaignList />
    </DashboardLayout>
  );
}
