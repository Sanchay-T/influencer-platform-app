import './globals.css'

import { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { ToastProvider } from './providers/toast-provider';
import { AuthLogger } from './components/auth/auth-logger';
import { NavigationLogger } from './components/navigation/navigation-logger';
// Import startup validation to prevent environment mismatches
import '../lib/startup-validation.js';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Gemz',
  description: 'Multi-platform influencer campaign management',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
          <AuthLogger />
          <NavigationLogger />
          {children}
          <ToastProvider />
        </body>
      </html>
    </ClerkProvider>
  );
}
