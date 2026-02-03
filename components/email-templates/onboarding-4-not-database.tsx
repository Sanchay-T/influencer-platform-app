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
	baseUrl,
	buttonSection,
	container,
	featureHeadline,
	featureItem,
	featureList,
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

interface OnboardingNotDatabaseEmailProps {
	fullName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

export const OnboardingNotDatabaseEmail = ({
	fullName,
	dashboardUrl,
	unsubscribeUrl,
}: OnboardingNotDatabaseEmailProps) => {
	const firstName = fullName?.split(' ')[0];
	const greetingText = firstName ? `Hey ${firstName},` : 'Hey there,';

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Preview>Why influencer databases are lying to you</Preview>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={logoImageUrl} alt="Gemz" style={logoImage} />
					</Section>

					<Text style={title}>Why influencer databases are lying to you</Text>

					<Text style={greeting}>{greetingText}</Text>

					<Text style={paragraph}>
						Most influencer platforms work the same way: they scrape social profiles, store them in
						a database, and let you filter by follower count, location, or category.
					</Text>

					<Text style={paragraph}>
						<strong>The problem?</strong> Those profiles are outdated the moment they're saved.
					</Text>

					<Section style={featureSection}>
						<Text style={featureHeadline}>What databases get wrong:</Text>
						<ul style={featureList}>
							<li style={featureItem}>
								<strong>Stale data:</strong> A creator's audience changes every week, but the
								database only updates monthly (or never)
							</li>
							<li style={featureItem}>
								<strong>Wrong categories:</strong> A creator labeled "fitness" might have pivoted to
								lifestyle months ago
							</li>
							<li style={featureItem}>
								<strong>Missing creators:</strong> New and rising creators aren't in the database at
								all
							</li>
						</ul>
					</Section>

					<Section style={featureSection}>
						<Text style={featureHeadline}>How Gemz is different:</Text>
						<ul style={featureList}>
							<li style={featureItem}>
								We search live — pulling real-time data from TikTok, Instagram, and YouTube
							</li>
							<li style={featureItem}>We analyze actual content, not just bios or old tags</li>
							<li style={featureItem}>
								You find creators based on what they're posting right now, not 6 months ago
							</li>
						</ul>
					</Section>

					<Text style={paragraph}>
						When you search on Gemz, you're getting the freshest results possible — not a snapshot
						from last quarter.
					</Text>

					<Section style={buttonSection}>
						<Button style={primaryButton} href={dashboardUrl}>
							See the Difference Yourself
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

const onboardingNotDatabasePreviewProps: OnboardingNotDatabaseEmailProps = {
	fullName: 'Jordan',
	dashboardUrl: `${baseUrl}/dashboard?utm_source=email&utm_campaign=onboarding_4`,
};

OnboardingNotDatabaseEmail.PreviewProps = onboardingNotDatabasePreviewProps;

export default OnboardingNotDatabaseEmail;
