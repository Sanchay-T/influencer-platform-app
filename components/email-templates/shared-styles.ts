import type { CSSProperties } from 'react';

/**
 * Shared dark theme styles for Gemz email templates.
 * Based on the subscription-welcome-email design.
 */

export const baseUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: 'https://usegemz.io';

// Dark theme color palette (matches landing page)
export const colors = {
	background: '#000000', // Pure black (like landing page)
	container: '#18181b', // zinc-900
	containerBorder: 'rgba(255,255,255,0.06)',
	featureBox: '#111114',
	featureBoxBorder: 'rgba(255,255,255,0.05)',
	textPrimary: '#ffffff',
	textSecondary: 'rgba(255,255,255,0.8)',
	textMuted: 'rgba(255,255,255,0.6)',
	magenta: '#FF10F0', // Landing page accent
	magentaHover: '#E00ED8',
};

// Logo image URL (matches landing page header)
export const logoImageUrl = 'https://usegemz.io/images/untitled-20design.png';

export const main: CSSProperties = {
	backgroundColor: colors.background,
	color: colors.textPrimary,
	fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
	padding: '0 16px',
};

export const container: CSSProperties = {
	maxWidth: '520px',
	margin: '0 auto',
	padding: '32px 24px 48px',
	backgroundColor: colors.container,
	borderRadius: '16px',
	border: `1px solid ${colors.containerBorder}`,
};

export const title: CSSProperties = {
	fontSize: '24px',
	lineHeight: 1.3,
	fontWeight: 600,
	margin: '0 0 20px',
	textAlign: 'center',
	color: colors.textPrimary,
};

export const paragraph: CSSProperties = {
	fontSize: '16px',
	lineHeight: 1.6,
	margin: '0 0 16px',
	color: colors.textSecondary,
};

export const greeting: CSSProperties = {
	fontSize: '16px',
	lineHeight: 1.6,
	margin: '0 0 16px',
	color: colors.textPrimary,
	fontWeight: 500,
};

export const featureSection: CSSProperties = {
	backgroundColor: colors.featureBox,
	borderRadius: '12px',
	padding: '20px',
	margin: '28px 0',
	border: `1px solid ${colors.featureBoxBorder}`,
};

export const featureHeadline: CSSProperties = {
	fontSize: '16px',
	fontWeight: 600,
	color: colors.textPrimary,
	margin: '0 0 12px',
};

export const featureList: CSSProperties = {
	margin: 0,
	padding: '0 0 0 20px',
	color: colors.textSecondary,
	lineHeight: 1.6,
};

export const featureItem: CSSProperties = {
	marginBottom: '8px',
};

export const buttonSection: CSSProperties = {
	textAlign: 'center',
	margin: '24px 0',
};

export const primaryButton: CSSProperties = {
	fontSize: '16px',
	backgroundColor: colors.magenta,
	color: '#ffffff',
	padding: '14px 32px',
	borderRadius: '9999px',
	fontWeight: 600,
	textDecoration: 'none',
	display: 'inline-block',
};

export const secondaryButton: CSSProperties = {
	fontSize: '14px',
	backgroundColor: 'transparent',
	color: colors.magenta,
	padding: '10px 24px',
	borderRadius: '9999px',
	border: `1px solid rgba(255,46,204,0.35)`,
	fontWeight: 500,
	textDecoration: 'none',
	display: 'inline-block',
};

export const hr: CSSProperties = {
	border: 'none',
	borderTop: `1px solid ${colors.containerBorder}`,
	margin: '36px 0 24px',
};

export const footer: CSSProperties = {
	fontSize: '14px',
	color: colors.textMuted,
	textAlign: 'center',
};

export const unsubscribeLink: CSSProperties = {
	color: colors.textMuted,
	fontSize: '12px',
	textDecoration: 'underline',
};

export const link: CSSProperties = {
	color: colors.magenta,
	textDecoration: 'underline',
};

// Additional utility styles for onboarding emails
export const highlightText: CSSProperties = {
	color: colors.magenta,
	fontWeight: 600,
};

export const sectionTitle: CSSProperties = {
	fontSize: '18px',
	fontWeight: 600,
	color: colors.textPrimary,
	margin: '0 0 16px',
};

export const numberedStep: CSSProperties = {
	fontSize: '16px',
	lineHeight: 1.6,
	margin: '0 0 12px',
	color: colors.textSecondary,
	paddingLeft: '8px',
};

export const stepNumber: CSSProperties = {
	color: colors.magenta,
	fontWeight: 600,
	marginRight: '8px',
};

export const signatureSection: CSSProperties = {
	marginTop: '32px',
};

export const signatureName: CSSProperties = {
	fontSize: '16px',
	color: colors.textPrimary,
	fontWeight: 500,
	margin: '0 0 4px',
};

export const signatureTitle: CSSProperties = {
	fontSize: '14px',
	color: colors.textMuted,
	margin: 0,
};

// Enhanced design elements
export const logoSection: CSSProperties = {
	textAlign: 'center',
	marginBottom: '24px',
};

export const logoImage: CSSProperties = {
	width: '120px',
	height: 'auto',
	margin: '0 auto',
};

// @deprecated - use logoImage with Img component instead
export const logoText: CSSProperties = {
	fontSize: '28px',
	fontWeight: 700,
	color: colors.magenta,
	letterSpacing: '-0.5px',
	margin: 0,
};

export const accentBar: CSSProperties = {
	width: '60px',
	height: '4px',
	backgroundColor: colors.magenta,
	borderRadius: '2px',
	margin: '0 auto 24px',
};

export const heroTitle: CSSProperties = {
	fontSize: '26px',
	lineHeight: 1.2,
	fontWeight: 700,
	margin: '0 0 8px',
	textAlign: 'center',
	color: colors.textPrimary,
};

export const heroSubtitle: CSSProperties = {
	fontSize: '16px',
	lineHeight: 1.5,
	margin: '0 0 28px',
	textAlign: 'center',
	color: colors.textMuted,
};

export const calloutBox: CSSProperties = {
	backgroundColor: 'rgba(255, 46, 204, 0.08)',
	borderLeft: `3px solid ${colors.magenta}`,
	borderRadius: '0 8px 8px 0',
	padding: '16px 20px',
	margin: '24px 0',
};

export const calloutText: CSSProperties = {
	fontSize: '15px',
	lineHeight: 1.6,
	color: colors.textSecondary,
	margin: 0,
	fontStyle: 'italic',
};

export const ctaSection: CSSProperties = {
	textAlign: 'center',
	margin: '32px 0',
	padding: '24px',
	backgroundColor: colors.featureBox,
	borderRadius: '12px',
	border: `1px solid ${colors.featureBoxBorder}`,
};

export const ctaHeadline: CSSProperties = {
	fontSize: '18px',
	fontWeight: 600,
	color: colors.textPrimary,
	margin: '0 0 16px',
};
