import './globals.css'

import { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { ToastProvider } from './providers/toast-provider';

export const metadata = {
  title: 'Influencer Platform',
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
          {children}
          <ToastProvider />
        </body>
      </html>
    </ClerkProvider>
  );
}