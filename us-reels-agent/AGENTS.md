# AGENTS.md - US Reels Agent

## Project Overview
This is a specialized agent for processing US-based Instagram Reels. It handles transcript processing, SERP (Search Engine Results Page) integration, and data analysis.

## Directory Map
- `src/`: Source code for the agent.
- `data/`: Data storage for processing.
- `logs/`: Execution logs.

## Setup & Commands
- **Install:** `npm install`
- **Dev:** `npm run dev` (Runs `src/index.ts`)
- **Build:** `npm run build`
- **Tests:**
  - `npm run test:transcript`: Test transcript processing.
  - `npm run test:serper`: Test SERP integration.
  - `npm run test:us-queries`: Test US-specific queries.

## Expectations
- **TypeScript:** All code must be written in TypeScript.
- **Testing:** Use the provided test scripts (`test-*.ts`) to verify changes.
- **Environment:** Ensure `.env` is configured with necessary API keys (OpenAI, Serper, etc.).
