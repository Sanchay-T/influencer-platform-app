import { ApifyClient } from 'apify-client';

if (!process.env.APIFY_TOKEN) {
  throw new Error('APIFY_TOKEN is not defined');
}

export const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN,
}); 