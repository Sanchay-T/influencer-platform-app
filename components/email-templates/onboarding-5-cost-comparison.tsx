import {
	Body,
	Button,
	Container,
	Head,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from '@react-email/components';
import type { CSSProperties } from 'react';
import {
	baseUrl,
	buttonSection,
	colors,
	container,
	featureHeadline,
	featureSection,
	footer,
	greeting,
	hr,
	logoImage,
	logoImageUrl,
	logoSection,
	main,
	paragraph,
	primaryButton,
	signatureName,
	signatureSection,
	signatureTitle,
	title,
	unsubscribeLink,
} from './shared-styles';

interface OnboardingCostComparisonEmailProps {
	fullName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

export const OnboardingCostComparisonEmail = ({
	fullName,
	dashboardUrl,
	unsubscribeUrl,
}: OnboardingCostComparisonEmailProps) => {
	const greetingText = fullName ? `Hey ${fullName},` : 'Hey there,';

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Preview>You don't need a $500/mo influencer tool</Preview>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={logoImageUrl} alt="Gemz" style={logoImage} />
					</Section>

					<Text style={title}>You don't need a $500/mo influencer tool</Text>

					<Text style={greeting}>{greetingText}</Text>

					<Text style={paragraph}>Quick reality check on influencer platform pricing:</Text>

					<Section style={featureSection}>
						<Text style={featureHeadline}>What others charge:</Text>
						<Text style={comparisonRow}>
							<span style={platformName}>Modash:</span>
							<span style={priceTag}>$299/mo</span>
						</Text>
						<Text style={comparisonRow}>
							<span style={platformName}>Upfluence:</span>
							<span style={priceTag}>$478/mo</span>
						</Text>
						<Text style={comparisonRow}>
							<span style={platformName}>Grin:</span>
							<span style={priceTag}>$999/mo+</span>
						</Text>
						<Text style={comparisonRow}>
							<span style={platformName}>CreatorIQ:</span>
							<span style={priceTag}>$2,350/mo</span>
						</Text>
					</Section>

					<Text style={paragraph}>
						These tools are built for enterprises with dedicated influencer marketing teams. They
						have features you'll never use — and pricing to match.
					</Text>

					<Section style={featureSection}>
						<Text style={featureHeadline}>Gemz is built for speed:</Text>
						<Text style={paragraph}>
							You don't need relationship management, contract workflows, or payment processing
							(yet). You need to find the right creators, fast.
						</Text>
						<Text style={paragraph}>
							<strong>Gemz starts at $99/mo</strong> — all the discovery power, none of the bloat.
						</Text>
					</Section>

					<Text style={paragraph}>
						When you're ready for enterprise features, we'll have them. But right now, you probably
						just need a reliable way to find creators who fit your brand.
					</Text>

					<Section style={buttonSection}>
						<Button style={primaryButton} href={dashboardUrl}>
							Start Your Free Trial
						</Button>
					</Section>

					<Section style={signatureSection}>
						<Text style={signatureName}>Ramon</Text>
						<Text style={signatureTitle}>Founder, Gemz</Text>
					</Section>

					<Hr style={hr} />

					<Text style={footer}>
						{unsubscribeUrl ? (
							<Link href={unsubscribeUrl} style={unsubscribeLink}>
								Unsubscribe from these emails
							</Link>
						) : (
							'— The Gemz Team'
						)}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

const onboardingCostComparisonPreviewProps: OnboardingCostComparisonEmailProps = {
	fullName: 'Jordan',
	dashboardUrl: `${baseUrl}/dashboard?utm_source=email&utm_campaign=onboarding_5`,
};

OnboardingCostComparisonEmail.PreviewProps = onboardingCostComparisonPreviewProps;

export default OnboardingCostComparisonEmail;

// Additional styles specific to this email
const comparisonRow: CSSProperties = {
	fontSize: '16px',
	lineHeight: 1.6,
	margin: '0 0 8px',
	color: colors.textSecondary,
	display: 'flex',
	justifyContent: 'space-between',
};

const platformName: CSSProperties = {
	color: colors.textSecondary,
};

const priceTag: CSSProperties = {
	color: colors.textMuted,
	fontWeight: 500,
};
