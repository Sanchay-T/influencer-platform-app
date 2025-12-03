# Migrations

- `0200_baseline_schema.sql` is a fresh snapshot of the live Supabase database as of now. New environments should apply this file first.
- Legacy migrations with duplicate prefixes have been moved to `legacy/` for reference; they are not intended to run on fresh setups.
- Run `npm run db:lint` to ensure new migrations use unique numeric prefixes and avoid reintroducing duplicates.

If you add new migrations, number them after 0200 (e.g., 0201_add_feature.sql) and keep them small and reversible.
