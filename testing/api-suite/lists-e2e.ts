#!/usr/bin/env tsx
import { createContext } from './shared-e2e'
import { runListWorkflow } from './runners/lists'

async function main() {
  const ctx = createContext()
  console.log('ℹ️  Running list workflow against', ctx.baseUrl)

  const result = await runListWorkflow(ctx)

  console.log('🎉 List workflow completed')
  console.log('   List ID:', result.listId)
  console.log('   Initial items:', result.initialDetail.items.length)
  console.log('   Updated list name:', result.updatedDetail.list.name)
  console.log('   Final archived flag:', result.finalList?.list?.isArchived)
}

main().catch((err) => {
  console.error('❌ lists-e2e failed:', err)
  process.exit(1)
})
