import {
	Body,
	Button,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from '@react-email/components';
import type { CSSProperties } from 'react';

interface SubscriptionWelcomeEmailProps {
	fullName?: string;
	businessName?: string;
	planName: string;
	planFeatures?: string[];
	dashboardUrl: string;
	billingUrl?: string;
}

const baseUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: 'https://influencerplatform.vercel.app';

export const SubscriptionWelcomeEmail = ({
	fullName,
	businessName,
	planName,
	planFeatures = [],
	dashboardUrl,
	billingUrl,
}: SubscriptionWelcomeEmailProps) => (
	<Html>
		<Head />
		<Body style={main}>
			<Preview>{`Your ${planName} plan is live on Gemz`}</Preview>
			<Container style={container}>
				<Text style={title}>{`You're live on the ${planName} plan!`}</Text>

				<Text style={paragraph}>
					Hi{fullName ? ` ${fullName}` : ''}
					{businessName ? ` from ${businessName}` : ''},
				</Text>

				<Text style={paragraph}>
					Thanks for trusting Gemz with your creator workflow. Your subscription is active and the
					full {planName} toolkit is ready whenever you are.
				</Text>

				{planFeatures.length > 0 && (
					<Section style={featureSection}>
						<Text style={featureHeadline}>What you unlocked with the {planName} plan:</Text>
						<ul style={featureList}>
							{planFeatures.map((feature) => (
								<li key={`${planName}-${feature}`} style={featureItem}>
									{feature}
								</li>
							))}
						</ul>
					</Section>
				)}

				<Section style={buttonSection}>
					<Button style={primaryButton} href={dashboardUrl}>
						Go to Your Dashboard
					</Button>
				</Section>

				{billingUrl && (
					<Section style={buttonSection}>
						<Button style={secondaryButton} href={billingUrl}>
							Manage Billing
						</Button>
					</Section>
				)}

				<Text style={paragraph}>
					Need a strategy check-in or have feedback? Just reply directly to this email and our team
					will jump in.
				</Text>

				<Hr style={hr} />

				<Text style={footer}>— The Gemz Team</Text>
			</Container>
		</Body>
	</Html>
);

const subscriptionWelcomePreviewProps: SubscriptionWelcomeEmailProps = {
	fullName: 'Jordan',
	businessName: 'Northstar Labs',
	planName: 'Fame Flex',
	planFeatures: [
		'Unlimited campaigns and creator discovery',
		'Enterprise analytics & API access',
		'Dedicated success partner with priority support',
	],
	dashboardUrl: `${baseUrl}/campaigns`,
	billingUrl: `${baseUrl}/billing`,
};

SubscriptionWelcomeEmail.PreviewProps = subscriptionWelcomePreviewProps;

export default SubscriptionWelcomeEmail;

const main: CSSProperties = {
	backgroundColor: '#0f0f11',
	color: '#f5f5f7',
	fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
	padding: '0 16px',
};

const container: CSSProperties = {
	maxWidth: '520px',
	margin: '0 auto',
	padding: '32px 24px 48px',
	backgroundColor: '#18181b',
	borderRadius: '16px',
	border: '1px solid rgba(255,255,255,0.06)',
};

const title: CSSProperties = {
	fontSize: '24px',
	lineHeight: 1.3,
	fontWeight: 600,
	margin: '0 0 20px',
	textAlign: 'center',
};

const paragraph: CSSProperties = {
	fontSize: '16px',
	lineHeight: 1.6,
	margin: '0 0 16px',
	color: '#d4d4d8',
};

const featureSection: CSSProperties = {
	backgroundColor: '#111114',
	borderRadius: '12px',
	padding: '20px',
	margin: '28px 0',
	border: '1px solid rgba(255,255,255,0.05)',
};

const featureHeadline: CSSProperties = {
	fontSize: '16px',
	fontWeight: 600,
	color: '#f4f4f5',
	margin: '0 0 12px',
};

const featureList: CSSProperties = {
	margin: 0,
	padding: '0 0 0 20px',
	color: '#d4d4d8',
	lineHeight: 1.6,
};

const featureItem: CSSProperties = {
	marginBottom: '8px',
};

const buttonSection: CSSProperties = {
	textAlign: 'center',
	margin: '24px 0',
};

const primaryButton: CSSProperties = {
	fontSize: '16px',
	backgroundColor: '#f97316',
	color: '#0f0f11',
	padding: '12px 28px',
	borderRadius: '9999px',
	fontWeight: 600,
	textDecoration: 'none',
	display: 'inline-block',
};

const secondaryButton: CSSProperties = {
	fontSize: '14px',
	backgroundColor: 'transparent',
	color: '#f97316',
	padding: '10px 24px',
	borderRadius: '9999px',
	border: '1px solid rgba(249,115,22,0.35)',
	fontWeight: 500,
	textDecoration: 'none',
	display: 'inline-block',
};

const hr: CSSProperties = {
	border: 'none',
	borderTop: '1px solid rgba(255,255,255,0.06)',
	margin: '36px 0 24px',
};

const footer: CSSProperties = {
	fontSize: '14px',
	color: '#9ca3af',
	textAlign: 'center',
};
