import { createContext, E2EContext, createCampaign, requestJson } from '../shared-e2e'

export interface CampaignWorkflowResult {
  campaignId: string
  detail: any
  listResponse: any
  entitlement: any
}

export async function runCampaignWorkflow(
  context?: E2EContext
): Promise<CampaignWorkflowResult> {
  const ctx = context || createContext()

  const campaignId = await createCampaign(ctx, {
    searchType: 'keyword',
    label: 'Campaign Workflow',
    description: 'Automation-created campaign for workflow verification',
  })

  const listResponse = await requestJson(ctx, `/api/campaigns?page=1&limit=5`, {
    label: 'List campaigns',
  })

  const detail = await requestJson(ctx, `/api/campaigns/${campaignId}`, {
    label: 'Campaign detail',
  })

  const entitlement = await requestJson(ctx, `/api/campaigns/can-create`, {
    label: 'Campaign can-create',
  })

  return {
    campaignId,
    detail,
    listResponse,
    entitlement,
  }
}
