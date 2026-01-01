import './globals.css';

import type { Appearance } from '@clerk/nextjs';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
// Font configuration for app-wide Inter usage.
import { Inter } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AuthLogger } from './components/auth/auth-logger';
import { NavigationLogger } from './components/navigation/navigation-logger';
import { ClientConsoleBridge } from './providers/console-bridge';
import { QueryProvider } from './providers/query-provider';
import { ToastProvider } from './providers/toast-provider';

const inter = Inter({
	subsets: ['latin'],
	variable: '--font-inter',
	display: 'swap',
});

const clerkAppearance: Appearance = {
	baseTheme: 'dark',
	layout: {
		helpPageUrl: 'mailto:support@usegems.com',
		shimmer: false,
		privacyPageUrl: 'https://usegems.com/privacy',
		termsPageUrl: 'https://usegems.com/terms',
	},
	variables: {
		colorPrimary: '#FF2ECC',
		colorText: '#FFFFFF',
		colorTextOnPrimaryBackground: '#FFFFFF',
		colorTextOnSecondaryBackground: '#FFFFFF',
		colorAlphaShade: 'rgba(255,46,204,0.24)',
		colorBackground: 'rgba(9,9,11,0.94)',
		borderRadius: '24px',
		colorInputBackground: 'rgba(24,24,27,0.72)',
		colorInputText: '#FFFFFF',
	},
	elements: {
		modalBackdrop: 'backdrop-blur-xl bg-black/70',
		card: 'bg-black/90 border border-white/12 text-white shadow-[0_40px_120px_rgba(255,46,204,0.25)] rounded-[24px]',
		headerTitle: 'text-white text-3xl font-semibold tracking-tight',
		headerSubtitle: 'text-white/70 text-sm',
		socialButtons: 'flex flex-col gap-3',
		socialButtonsBlockButton:
			'w-full justify-center rounded-2xl border border-white/15 bg-white/12 px-4 py-3 text-white shadow-[0_18px_55px_rgba(255,46,204,0.28)] transition hover:bg-white/22 hover:shadow-[0_24px_80px_rgba(255,46,204,0.35)]',
		socialButtonsBlockButtonText: 'text-sm font-semibold tracking-wide text-white',
		socialButtonsProviderIcon:
			'mr-3 h-5 w-5 text-white filter drop-shadow-[0_0_12px_rgba(255,46,204,0.45)]',
		socialButtonsButton:
			'w-full justify-center rounded-2xl border border-white/15 bg-white/12 px-4 py-3 text-white shadow-[0_18px_55px_rgba(255,46,204,0.28)] transition hover:bg-white/22 hover:shadow-[0_24px_80px_rgba(255,46,204,0.35)]',
		socialButtonsButtonText: 'text-sm font-semibold tracking-wide text-white',
		socialButtonsButtonIcon: 'text-white filter drop-shadow-[0_0_10px_rgba(255,46,204,0.4)]',
		socialButtonsIconButton:
			'border-white/20 bg-white/10 hover:bg-white/20 text-white shadow-[0_12px_40px_rgba(236,72,153,0.25)]',
		dividerLine: 'bg-white/10',
		dividerText: 'text-white/50 uppercase tracking-[0.3em] text-xs',
		formFieldLabel: 'text-xs uppercase tracking-[0.35em] text-white/60',
		formFieldInput:
			'bg-black/70 border border-white/15 text-white placeholder:text-white/35 focus:border-pink-500 focus:ring-0 rounded-xl',
		formButtonPrimary:
			'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold border-0 shadow-[0_24px_80px_rgba(236,72,153,0.3)] rounded-xl',
		footerAction: 'text-white/60',
		footerActionLink: 'text-pink-400 hover:text-pink-300',
		alert: 'bg-white/5 border border-white/10 text-white/80',
		avatarBox: 'hidden',
		otpCodeFieldInput:
			'bg-black/70 border border-white/15 text-white focus:border-pink-500 focus:ring-0',
		identityPreview: 'bg-white/5 border border-white/10 text-white rounded-xl',
	},
};

export const metadata: Metadata = {
	title: 'Gemz — Real-time influencer discovery & campaign activation',
	description:
		'Gemz helps growth teams find, qualify, and activate high-performing creators across TikTok, Instagram, and YouTube with AI-ranked insights.',
	metadataBase: new URL('https://usegemz.io'),
	openGraph: {
		title: 'Gemz — Find the Right Influencer, Fast. With AI.',
		description:
			'Source verified creators, enrich outreach data, and launch campaigns in minutes with Gemz.',
		url: 'https://usegemz.io',
		siteName: 'Gemz',
		images: [
			{
				url: '/landing/og-preview.png',
				width: 1536,
				height: 1024,
				alt: 'Gemz - Find the Right Influencer, Fast. With AI.',
			},
		],
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Gemz — Find the Right Influencer, Fast. With AI.',
		description:
			'AI-powered influencer discovery that keeps your pipeline fresh across every platform.',
		images: ['/landing/og-preview.png'],
	},
};

interface RootLayoutProps {
	children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
	return (
		<ClerkProvider appearance={clerkAppearance}>
			<html lang="en" className="dark">
				<head>
					<Script
						src="https://www.googletagmanager.com/gtag/js?id=AW-17841436850"
						strategy="afterInteractive"
					/>
					<Script id="google-ads-gtag" strategy="afterInteractive">
						{`
							window.dataLayer = window.dataLayer || [];
							function gtag(){dataLayer.push(arguments);}
							gtag('js', new Date());
							gtag('config', 'AW-17841436850');
						`}
					</Script>
				</head>
				<body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
					<ClientConsoleBridge />
					<AuthLogger />
					<NavigationLogger />
					<QueryProvider>{children}</QueryProvider>
					<ToastProvider />
				</body>
			</html>
		</ClerkProvider>
	);
}
