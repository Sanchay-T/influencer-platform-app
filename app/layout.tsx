import './globals.css'

import { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { ToastProvider } from './providers/toast-provider';
import { AuthLogger } from './components/auth/auth-logger';
import { NavigationLogger } from './components/navigation/navigation-logger';
// Import startup validation to prevent environment mismatches
import '../lib/startup-validation.js';

export const metadata = {
  title: 'usegemz',
  description: 'Multi-platform influencer campaign management',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <html lang="en">
        <body>
          <AuthLogger />
          <NavigationLogger />
          {children}
          <ToastProvider />
        </body>
      </html>
    </ClerkProvider>
  );
}