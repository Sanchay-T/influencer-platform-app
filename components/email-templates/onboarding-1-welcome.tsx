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
import {
	accentBar,
	baseUrl,
	container,
	ctaSection,
	featureHeadline,
	featureItem,
	featureList,
	featureSection,
	footer,
	greeting,
	heroSubtitle,
	heroTitle,
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
	unsubscribeLink,
} from './shared-styles';

interface OnboardingWelcomeEmailProps {
	fullName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

export const OnboardingWelcomeEmail = ({
	fullName,
	dashboardUrl,
	unsubscribeUrl,
}: OnboardingWelcomeEmailProps) => {
	const firstName = fullName?.split(' ')[0];
	const greetingText = firstName ? `Hey ${firstName},` : 'Hey there,';

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Preview>Welcome to Gemz — here's what you're unlocking</Preview>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={logoImageUrl} alt="Gemz" style={logoImage} />
					</Section>

					{/* Hero */}
					<Text style={heroTitle}>Welcome to Gemz</Text>
					<Text style={heroSubtitle}>The smarter way to find creators</Text>
					<div style={accentBar} />

					<Text style={greeting}>{greetingText}</Text>

					<Text style={paragraph}>
						Thanks for signing up — you're in. Gemz is where brands discover the creators who
						actually move the needle.
					</Text>

					<Text style={paragraph}>
						We're not another influencer database. We search TikTok, Instagram, and YouTube in
						real-time to find creators who match exactly what you're looking for — by topic, niche,
						or even similarity to creators you already love.
					</Text>

					<Section style={featureSection}>
						<Text style={featureHeadline}>What you'll be able to do:</Text>
						<ul style={featureList}>
							<li style={featureItem}>
								<strong>Keyword Search:</strong> Find creators by what they actually talk about
							</li>
							<li style={featureItem}>
								<strong>Similar Creator Search:</strong> Found one good creator? Find 50 more like
								them
							</li>
							<li style={featureItem}>
								<strong>Organize & Export:</strong> Build lists and export to CSV for outreach
							</li>
						</ul>
					</Section>

					<Section style={ctaSection}>
						<Text style={{ ...paragraph, margin: '0 0 16px', textAlign: 'center' as const }}>
							To unlock all of this, just start your free trial.
							<br />
							<strong>No charge until you decide Gemz is worth it.</strong>
						</Text>
						<Button style={primaryButton} href={dashboardUrl}>
							Start Your Free Trial →
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

const onboardingWelcomePreviewProps: OnboardingWelcomeEmailProps = {
	fullName: 'Jordan',
	dashboardUrl: `${baseUrl}/dashboard?utm_source=email&utm_campaign=onboarding_1`,
};

OnboardingWelcomeEmail.PreviewProps = onboardingWelcomePreviewProps;

export default OnboardingWelcomeEmail;
