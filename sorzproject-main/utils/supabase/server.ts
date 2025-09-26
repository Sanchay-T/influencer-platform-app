// utils/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          return cookie?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          const cookie: ResponseCookie = {
            name,
            value,
            ...options,
            sameSite: 'lax',
            httpOnly: true,
          };
          cookieStore.set(cookie);
        },
        remove(name: string, options: CookieOptions) {
          const cookie: ResponseCookie = {
            name,
            value: '',
            ...options,
            maxAge: 0,
            sameSite: 'lax',
            httpOnly: true,
          };
          cookieStore.set(cookie);
        },
      },
    }
  );
}