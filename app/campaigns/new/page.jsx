import DashboardLayout from "../../components/layout/dashboard-layout";
import CampaignForm from "../../components/campaigns/campaign-form";

export default function NewCampaign() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Create a New Campaign</h1>
          <p className="text-sm text-zinc-400 mt-1">Name your campaign and choose how you want to find creators.</p>
        </div>
        <CampaignForm />
      </div>
    </DashboardLayout>
  );
} 
