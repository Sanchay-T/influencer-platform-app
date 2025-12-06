'use client';

import { useClerk } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    signOut({ redirectUrl: '/' });
  }, [signOut]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <p className="text-white">Signing out...</p>
    </div>
  );
}
