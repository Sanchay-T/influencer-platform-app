import CampaignForm from '../../components/campaigns/campaign-form';
import DashboardLayout from '../../components/layout/dashboard-layout';

export default function NewCampaign() {
	return (
		<DashboardLayout>
			<div className="max-w-4xl mx-auto py-8">
				{/* Breadcrumb: New campaign page renders CampaignForm inside dashboard shell to handle creation flow. */}
				<CampaignForm />
			</div>
		</DashboardLayout>
	);
}
