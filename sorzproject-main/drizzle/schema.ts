import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().unique(),
  name: text('name').notNull(),
  company_name: text('company_name').notNull(),
  industry: text('industry').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
})




