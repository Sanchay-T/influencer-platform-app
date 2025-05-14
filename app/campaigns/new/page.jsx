import DashboardLayout from "../../components/layout/dashboard-layout";
import CampaignForm from "../../components/campaigns/campaign-form";

export default function NewCampaign() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8">
        <CampaignForm />
      </div>
    </DashboardLayout>
  );
} 