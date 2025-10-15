import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const envFiles = ['.env.local', '.env.development', '.env']

for (const file of envFiles) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) {
    config({ path, override: false })
  }
}

if (!process.env.ENABLE_TEST_AUTH) {
  console.warn('[plan-gating] ENABLE_TEST_AUTH is not set. Most tests will fail unless test auth is enabled.')
}

if (!process.env.TEST_AUTH_SECRET) {
  console.warn('[plan-gating] TEST_AUTH_SECRET is not set. Signed test auth headers cannot be generated.')
}
