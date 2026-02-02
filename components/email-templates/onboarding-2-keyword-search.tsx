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
	numberedStep,
	paragraph,
	primaryButton,
	signatureName,
	signatureSection,
	signatureTitle,
	stepNumber,
	title,
	unsubscribeLink,
} from './shared-styles';

interface OnboardingKeywordEmailProps {
	fullName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

export const OnboardingKeywordEmail = ({
	fullName,
	dashboardUrl,
	unsubscribeUrl,
}: OnboardingKeywordEmailProps) => {
	const greetingText = fullName ? `Hey ${fullName},` : 'Hey there,';

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Preview>How to find creators by what they actually talk about</Preview>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={logoImageUrl} alt="Gemz" style={logoImage} />
					</Section>

					<Text style={title}>Find creators by what they actually talk about</Text>

					<Text style={greeting}>{greetingText}</Text>

					<Text style={paragraph}>
						Most influencer tools show you vanity metrics — follower counts and engagement rates.
						But here's the problem: a fitness creator with 500K followers might never talk about
						supplements, even if that's what you sell.
					</Text>

					<Text style={paragraph}>
						<strong>Keyword Search fixes this.</strong>
					</Text>

					<Text style={paragraph}>
						Instead of filtering by demographics, you search by topic. Gemz scans captions, bios,
						and video transcripts to find creators who actually discuss what matters to your brand.
					</Text>

					<Section style={featureSection}>
						<Text style={featureHeadline}>How it works:</Text>
						<Text style={numberedStep}>
							<span style={stepNumber}>1.</span>
							Pick a platform (TikTok, Instagram, or YouTube)
						</Text>
						<Text style={numberedStep}>
							<span style={stepNumber}>2.</span>
							Enter keywords that describe your product or niche
						</Text>
						<Text style={numberedStep}>
							<span style={stepNumber}>3.</span>
							Gemz returns creators who've recently posted about those topics
						</Text>
					</Section>

					<Section style={featureSection}>
						<Text style={featureHeadline}>Example queries:</Text>
						<ul style={featureList}>
							<li style={featureItem}>"clean skincare routine" — for beauty brands</li>
							<li style={featureItem}>"home office setup" — for furniture or tech companies</li>
							<li style={featureItem}>"budget meal prep" — for food or kitchen brands</li>
						</ul>
					</Section>

					<Text style={paragraph}>
						No more guessing if a creator is right for you. You'll know based on their actual
						content.
					</Text>

					<Section style={buttonSection}>
						<Button style={primaryButton} href={dashboardUrl}>
							Try a Keyword Search
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

const onboardingKeywordPreviewProps: OnboardingKeywordEmailProps = {
	fullName: 'Jordan',
	dashboardUrl: `${baseUrl}/dashboard?utm_source=email&utm_campaign=onboarding_2`,
};

OnboardingKeywordEmail.PreviewProps = onboardingKeywordPreviewProps;

export default OnboardingKeywordEmail;
