import { createContext, E2EContext, requestJson } from '../shared-e2e'
import {
  getArrayProperty,
  getBooleanProperty,
  getStringProperty,
  toRecord,
} from '@/lib/utils/type-guards'

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
    isArchived?: boolean
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
  finalList: ListDetail
}

function parseCreatedList(value: unknown, label: string): CreatedList {
  const record = toRecord(value)
  if (!record) {
    throw new Error(`${label}: Expected object response`)
  }

  const listRecord = toRecord(record.list)
  if (!listRecord) {
    throw new Error(`${label}: Missing list`)
  }

  const id = getStringProperty(listRecord, 'id')
  const name = getStringProperty(listRecord, 'name')

  if (!id || !name) {
    throw new Error(`${label}: Missing list id or name`)
  }

  return { list: { id, name } }
}

function parseListDetail(value: unknown, label: string): ListDetail {
  const record = toRecord(value)
  if (!record) {
    throw new Error(`${label}: Expected object response`)
  }

  const listRecord = toRecord(record.list)
  if (!listRecord) {
    throw new Error(`${label}: Missing list`)
  }

  const id = getStringProperty(listRecord, 'id')
  const name = getStringProperty(listRecord, 'name')
  const description =
    typeof listRecord.description === 'string' ? listRecord.description : null
  const isArchived = getBooleanProperty(listRecord, 'isArchived') ?? undefined

  if (!id || !name) {
    throw new Error(`${label}: Missing list id or name`)
  }

  const itemsRaw = getArrayProperty(record, 'items') ?? []
  const items: ListDetail['items'] = itemsRaw.map((item, index) => {
    const itemRecord = toRecord(item)
    if (!itemRecord) {
      throw new Error(`${label}: Invalid item at index ${index}`)
    }

    const itemId = getStringProperty(itemRecord, 'id')
    const creatorRecord = toRecord(itemRecord.creator)
    const handle = creatorRecord ? getStringProperty(creatorRecord, 'handle') : null
    const platform = creatorRecord ? getStringProperty(creatorRecord, 'platform') : null

    if (!itemId || !handle || !platform) {
      throw new Error(`${label}: Invalid item at index ${index}`)
    }

    return {
      id: itemId,
      creator: {
        handle,
        platform,
      },
    }
  })

  return {
    list: { id, name, description, isArchived },
    items,
  }
}

export async function runListWorkflow(
  context?: E2EContext
): Promise<ListWorkflowResult> {
  const ctx = context || createContext()

  const createResponse = await requestJson(
    ctx,
    '/api/lists',
    {
      method: 'POST',
      body: {
        name: `Automation List ${new Date().toISOString()}`,
        description: 'List created by automation workflow',
        tags: ['automation'],
        privacy: 'private',
      },
      label: 'Create list',
    },
    (value) => parseCreatedList(value, 'Create list')
  )

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

  const initialDetail = await requestJson(
    ctx,
    `/api/lists/${listId}`,
    {
      label: 'Get list detail',
    },
    (value) => parseListDetail(value, 'Get list detail')
  )

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

  const updatedDetail = await requestJson(
    ctx,
    `/api/lists/${listId}`,
    {
      label: 'Get updated list detail',
    },
    (value) => parseListDetail(value, 'Get updated list detail')
  )

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

  const finalList = await requestJson(
    ctx,
    `/api/lists/${listId}`,
    {
      label: 'Get final list detail',
    },
    (value) => parseListDetail(value, 'Get final list detail')
  )

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
