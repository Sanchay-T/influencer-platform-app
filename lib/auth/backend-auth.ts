// Breadcrumb: Wrapper around Clerk-provided helpers so the rest of the codebase keeps a single import path.

import { auth as clerkAuth, clerkClient } from '@clerk/nextjs/server';

export const auth = clerkAuth;

// Downstream modules expect `clerkBackendClient`; alias the official client to preserve usage sites.
export const clerkBackendClient = clerkClient;
