# Code Patterns

Use these patterns when writing code. Reference the actual files for current implementations.

## Import Patterns

- Only import what you use
- Separate type imports with `import type { ... }`
- See existing files in `lib/` for examples

## TypeScript

- Never use `any`
- Use Drizzle's inferred types: `typeof table.$inferSelect`
- See `lib/db/schema.ts` for type exports

## Logging

- Use `lib/logging/` for structured logging
- Never use `console.log`
- See `createCategoryLogger()` usage in API routes

## Error Handling

- Log errors with context
- Return `{ error: 'message' }` to clients
- Use proper HTTP status codes

## React Components

- Server Components by default
- `'use client'` only when needed for interactivity
- See `app/` for examples

## Drizzle Queries

- Use query builders in `lib/db/queries/`
- Don't write raw SQL in API routes
- Use transactions for multi-table ops
- Always include `userId` in queries

## Biome Rules

After editing, run: `npx biome check --write <files>`

Key rules to follow:
- `noUnusedImports`
- `noExplicitAny`
- `noConsole`
- `useImportType`

---

## To Explore

Check existing code in `lib/` for current patterns before writing new code.
