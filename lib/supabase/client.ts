/**
 * Supabase Client (Browser-side)
 *
 * @context Used for Realtime subscriptions to job progress updates.
 * @why Workers update the database, Supabase Realtime pushes changes
 * to subscribed clients via WebSocket - eliminating polling.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!(supabaseUrl && supabaseAnonKey)) {
	throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	realtime: {
		params: {
			eventsPerSecond: 10, // Rate limit for high-frequency updates
		},
	},
});
