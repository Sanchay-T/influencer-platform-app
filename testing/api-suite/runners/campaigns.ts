import { getNumberProperty, toRecord } from '@/lib/utils/type-guards'
import { createContext, E2EContext, createCampaign, requestJson } from '../shared-e2e'

type CampaignListResponse = {
  pagination?: {
    total?: number
  }
}

export interface CampaignWorkflowResult {
  campaignId: string
  detail: unknown
  listResponse: CampaignListResponse
  entitlement: unknown
}

function parseCampaignList(value: unknown): CampaignListResponse {
  const record = toRecord(value)
  if (!record) return {}
  const pagination = toRecord(record.pagination)
  const total = pagination ? getNumberProperty(pagination, 'total') ?? undefined : undefined
  return total !== undefined ? { pagination: { total } } : {}
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

  const listResponse = await requestJson(
    ctx,
    `/api/campaigns?page=1&limit=5`,
    {
      label: 'List campaigns',
    },
    parseCampaignList
  )

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
