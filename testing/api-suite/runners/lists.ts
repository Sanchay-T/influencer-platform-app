import { createContext, E2EContext, requestJson } from '../shared-e2e'

type CreatedList = {
  list: {
    id: string
    name: string
  }
}

type ListDetail = {
  list: {
    id: string
    name: string
    description: string | null
  }
  items: Array<{
    id: string
    creator: {
      handle: string
      platform: string
    }
  }>
}

export interface ListWorkflowResult {
  listId: string
  initialDetail: ListDetail
  updatedDetail: ListDetail
  finalList: any
}

export async function runListWorkflow(
  context?: E2EContext
): Promise<ListWorkflowResult> {
  const ctx = context || createContext()

  const createResponse = await requestJson<CreatedList>(ctx, '/api/lists', {
    method: 'POST',
    body: {
      name: `Automation List ${new Date().toISOString()}`,
      description: 'List created by automation workflow',
      tags: ['automation'],
      privacy: 'private',
    },
    label: 'Create list',
  })

  const listId = createResponse.list.id

  const creatorPayload = [
    {
      platform: 'youtube',
      externalId: `yt_${Date.now()}`,
      handle: `automation_${Math.random().toString(36).slice(2, 8)}`,
      displayName: 'Automation Creator',
      url: 'https://youtube.com/@automation',
      followers: 1234,
      metadata: { source: 'automation-suite' },
    },
  ]

  await requestJson(ctx, `/api/lists/${listId}/items`, {
    method: 'POST',
    body: { creators: creatorPayload },
    label: 'Add creators to list',
  })

  const initialDetail = await requestJson<ListDetail>(ctx, `/api/lists/${listId}`, {
    label: 'Get list detail',
  })

  const firstItem = initialDetail.items[0]

  await requestJson(ctx, `/api/lists/${listId}/items`, {
    method: 'PATCH',
    body: {
      items: [
        {
          id: firstItem.id,
          notes: 'Reviewed via automation',
          bucket: 'priority',
          pinned: true,
        },
      ],
    },
    label: 'Update list item',
  })

  const updatedDetail = await requestJson<ListDetail>(ctx, `/api/lists/${listId}`, {
    label: 'Get updated list detail',
  })

  await requestJson(ctx, `/api/lists/${listId}/items`, {
    method: 'DELETE',
    body: { itemIds: updatedDetail.items.map((item) => item.id) },
    label: 'Remove list items',
  })

  await requestJson(ctx, `/api/lists/${listId}`, {
    method: 'PATCH',
    body: { name: `${updatedDetail.list.name} (archived)`, isArchived: true },
    label: 'Archive list',
  })

  const finalList = await requestJson(ctx, `/api/lists/${listId}`, {
    label: 'Get final list detail',
  })

  await requestJson(ctx, `/api/lists/${listId}`, {
    method: 'DELETE',
    label: 'Delete list',
  })

  return {
    listId,
    initialDetail,
    updatedDetail,
    finalList,
  }
}
