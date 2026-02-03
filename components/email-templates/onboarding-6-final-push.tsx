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

interface OnboardingFinalPushEmailProps {
	fullName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

export const OnboardingFinalPushEmail = ({
	fullName,
	dashboardUrl,
	unsubscribeUrl,
}: OnboardingFinalPushEmailProps) => {
	const firstName = fullName?.split(' ')[0];
	const greetingText = firstName ? `Hey ${firstName},` : 'Hey there,';

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Preview>Last thing — then I'll stop emailing</Preview>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={logoImageUrl} alt="Gemz" style={logoImage} />
					</Section>

					<Text style={title}>Last thing — then I'll stop emailing</Text>

					<Text style={greeting}>{greetingText}</Text>

					<Text style={paragraph}>
						I know you're busy. And honestly, you probably get a lot of emails from tools you signed
						up for but never tried.
					</Text>

					<Text style={paragraph}>
						But before I stop reaching out, I wanted to share one thing:
					</Text>

					<Text style={paragraph}>
						<strong>
							The brands that see the most success with Gemz usually find their first batch of
							creators within 10 minutes.
						</strong>
					</Text>

					<Section style={featureSection}>
						<Text style={featureHeadline}>Here's all you need to do:</Text>
						<ul style={featureList}>
							<li style={featureItem}>Start your free trial (takes 30 seconds)</li>
							<li style={featureItem}>
								Run one search — either a keyword or a similar creator search
							</li>
							<li style={featureItem}>Save the results to a list</li>
						</ul>
					</Section>

					<Text style={paragraph}>
						That's it. If Gemz doesn't help you find relevant creators in that first session, fair
						enough. But most people who try it once end up making it part of their workflow.
					</Text>

					<Text style={paragraph}>
						<strong>Your free trial doesn't charge you until you decide to keep it.</strong> And you
						can cancel anytime.
					</Text>

					<Section style={buttonSection}>
						<Button style={primaryButton} href={dashboardUrl}>
							Start Your Free Trial Now
						</Button>
					</Section>

					<Text style={paragraph}>
						If you ever have questions or want a quick walkthrough, just reply to this email. I read
						every response.
					</Text>

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

const onboardingFinalPushPreviewProps: OnboardingFinalPushEmailProps = {
	fullName: 'Jordan',
	dashboardUrl: `${baseUrl}/dashboard?utm_source=email&utm_campaign=onboarding_6`,
};

OnboardingFinalPushEmail.PreviewProps = onboardingFinalPushPreviewProps;

export default OnboardingFinalPushEmail;
