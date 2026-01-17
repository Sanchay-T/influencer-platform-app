import './globals.css';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import type { Metadata } from 'next';
// Font configuration for app-wide Inter usage.
import { Inter } from 'next/font/google';
import Script from 'next/script';
import type { ComponentProps, ReactNode } from 'react';
import { GA4UserIdentifier } from './components/analytics/ga4-user-id';
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

const clerkAppearance: ComponentProps<typeof ClerkProvider>['appearance'] = {
	baseTheme: dark,
	layout: {
		helpPageUrl: 'mailto:support@usegemz.io',
		shimmer: false,
		privacyPageUrl: 'https://usegemz.io/privacy',
		termsPageUrl: 'https://usegemz.io/terms',
	},
	variables: {
		colorPrimary: '#FF2ECC',
		colorText: '#FFFFFF',
		colorTextOnPrimaryBackground: '#FFFFFF',
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
	metadataBase: new URL('https://usegemz.io'),

	// Primary
	title: {
		default: 'Gemz — AI-Powered Influencer Discovery Platform',
		template: '%s | Gemz',
	},
	description:
		'Gemz is an AI powered influencer discovery tool for finding creators in real time using keywords or similar creator matching. Find influencers relevant to your brand faster and build targeted partnerships.',

	// Keywords
	keywords: [
		'influencer discovery',
		'influencer marketing platform',
		'find influencers',
		'creator discovery',
		'TikTok influencers',
		'Instagram influencers',
		'YouTube influencers',
		'influencer outreach',
		'creator marketing',
		'influencer database',
	],

	// Canonical URL
	alternates: {
		canonical: 'https://usegemz.io',
	},

	// Open Graph
	openGraph: {
		title: 'Gemz — Find the Right Influencer, Fast. With AI.',
		description:
			'Gemz is an AI powered influencer discovery tool for finding creators in real time using keywords or similar creator matching. Find influencers relevant to your brand faster and build targeted partnerships.',
		url: 'https://usegemz.io',
		siteName: 'Gemz',
		locale: 'en_US',
		type: 'website',
		images: [
			{
				url: '/landing/og-preview.png',
				width: 1200,
				height: 630,
				alt: 'Gemz - AI-Powered Influencer Discovery',
			},
		],
	},

	// Twitter
	twitter: {
		card: 'summary_large_image',
		title: 'Gemz — AI-Powered Influencer Discovery',
		description:
			'Gemz is an AI powered influencer discovery tool for finding creators in real time using keywords or similar creator matching. Find influencers relevant to your brand faster and build targeted partnerships.',
		images: ['/landing/og-preview.png'],
	},

	// Robots
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
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
					{/* Google Ads + GA4 (gtag.js)
					- Uses environment variables for GA4 Measurement ID
					- Dev: G-ZG4F8W3RJD (test property) - set in .env.local
					- Prod: G-HQL4LR0B0G (clean property) - set in Vercel
				*/}
					<Script
						src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || 'G-ZG4F8W3RJD'}`}
						strategy="afterInteractive"
					/>
					<Script id="google-gtag" strategy="afterInteractive">
						{`
							window.dataLayer = window.dataLayer || [];
							function gtag(){dataLayer.push(arguments);}
							gtag('js', new Date());

							var ga4Id = '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || 'G-ZG4F8W3RJD'}';
							var isProduction = window.location.hostname === 'usegemz.io';

							// Google Ads - only in production
							if (isProduction) {
								gtag('config', 'AW-17841436850');
							}

							// GA4 - always enabled, debug mode for non-production
							gtag('config', ga4Id, {
								debug_mode: !isProduction
							});
						`}
					</Script>

					{/* Meta Pixel Code - Uses env var for pixel ID */}
					<Script id="meta-pixel" strategy="afterInteractive">
						{`
							!function(f,b,e,v,n,t,s)
							{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
							n.callMethod.apply(n,arguments):n.queue.push(arguments)};
							if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
							n.queue=[];t=b.createElement(e);t.async=!0;
							t.src=v;s=b.getElementsByTagName(e)[0];
							s.parentNode.insertBefore(t,s)}(window, document,'script',
							'https://connect.facebook.net/en_US/fbevents.js');

							// Initialize with environment-specific pixel ID
							var pixelId = '${process.env.NEXT_PUBLIC_META_PIXEL_ID || ''}';
							if (pixelId) {
								fbq('init', pixelId);
								fbq('track', 'PageView');
							}
						`}
					</Script>
				</head>
				<body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
					{/* Meta Pixel noscript fallback - Only if pixel ID is configured */}
					{process.env.NEXT_PUBLIC_META_PIXEL_ID && (
						<noscript>
							{/* biome-ignore lint/performance/noImgElement: Required for Meta Pixel noscript tracking */}
							<img
								height="1"
								width="1"
								style={{ display: 'none' }}
								src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_META_PIXEL_ID}&ev=PageView&noscript=1`}
								alt=""
							/>
						</noscript>
					)}

					{/* JSON-LD Structured Data for SEO */}
					<script
						type="application/ld+json"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD
						dangerouslySetInnerHTML={{
							__html: JSON.stringify({
								'@context': 'https://schema.org',
								'@type': 'SoftwareApplication',
								name: 'Gemz',
								applicationCategory: 'BusinessApplication',
								operatingSystem: 'Web',
								description:
									'Gemz is an AI powered influencer discovery tool for finding creators in real time using keywords or similar creator matching. Find influencers relevant to your brand faster and build targeted partnerships.',
								url: 'https://usegemz.io',
								offers: {
									'@type': 'AggregateOffer',
									lowPrice: '99',
									highPrice: '499',
									priceCurrency: 'USD',
									offerCount: '3',
								},
							}),
						}}
					/>

					<ClientConsoleBridge />
					<AuthLogger />
					<GA4UserIdentifier />
					<NavigationLogger />
					<QueryProvider>{children}</QueryProvider>
					<ToastProvider />
				</body>
			</html>
		</ClerkProvider>
	);
}
