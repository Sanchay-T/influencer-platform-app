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

interface OnboardingSimilarCreatorEmailProps {
	fullName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

export const OnboardingSimilarCreatorEmail = ({
	fullName,
	dashboardUrl,
	unsubscribeUrl,
}: OnboardingSimilarCreatorEmailProps) => {
	const greetingText = fullName ? `Hey ${fullName},` : 'Hey there,';

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Preview>Found one good creator? Here's how to find 50 more</Preview>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={logoImageUrl} alt="Gemz" style={logoImage} />
					</Section>

					<Text style={title}>Find 50 more like your best creator</Text>

					<Text style={greeting}>{greetingText}</Text>

					<Text style={paragraph}>
						Here's a scenario: you find a creator who's perfect for your brand. Their content, their
						audience, their vibe — it all works.
					</Text>

					<Text style={paragraph}>Now you need 49 more just like them.</Text>

					<Text style={paragraph}>
						<strong>That's exactly what Similar Creator Search does.</strong>
					</Text>

					<Section style={featureSection}>
						<Text style={featureHeadline}>How it works:</Text>
						<Text style={numberedStep}>
							<span style={stepNumber}>1.</span>
							Enter the username of a creator you like
						</Text>
						<Text style={numberedStep}>
							<span style={stepNumber}>2.</span>
							Gemz analyzes their content, niche, and style
						</Text>
						<Text style={numberedStep}>
							<span style={stepNumber}>3.</span>
							We return creators who make similar content — not just in the same category, but with
							similar tone and approach
						</Text>
					</Section>

					<Section style={featureSection}>
						<Text style={featureHeadline}>When to use it:</Text>
						<ul style={featureList}>
							<li style={featureItem}>You worked with a creator before and want to scale</li>
							<li style={featureItem}>You found a competitor's creator and want alternatives</li>
							<li style={featureItem}>
								You have a "dream creator" who's too expensive — find affordable lookalikes
							</li>
						</ul>
					</Section>

					<Text style={paragraph}>
						It's the fastest way to go from "I found one" to "I have a whole list."
					</Text>

					<Section style={buttonSection}>
						<Button style={primaryButton} href={dashboardUrl}>
							Try a Similar Creator Search
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

const onboardingSimilarCreatorPreviewProps: OnboardingSimilarCreatorEmailProps = {
	fullName: 'Jordan',
	dashboardUrl: `${baseUrl}/dashboard?utm_source=email&utm_campaign=onboarding_3`,
};

OnboardingSimilarCreatorEmail.PreviewProps = onboardingSimilarCreatorPreviewProps;

export default OnboardingSimilarCreatorEmail;
