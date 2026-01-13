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

interface WelcomeEmailProps {
	username?: string;
	fullName?: string;
	businessName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

const baseUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: 'https://influencerplatform.vercel.app';

export const WelcomeEmail = ({
	username,
	fullName,
	businessName,
	dashboardUrl,
	unsubscribeUrl,
}: WelcomeEmailProps) => (
	<Html>
		<Head />
		<Body style={main}>
			<Preview>Welcome to Gemz! 🎉 Your account is ready to go.</Preview>
			<Container style={container}>
				<Img
					src={`${baseUrl}/static/logo.png`}
					width="48"
					height="48"
					alt="Gemz Logo"
					style={logo}
				/>

				<Text style={title}>Welcome to Gemz! 🎉</Text>

				<Text style={paragraph}>
					Hi{fullName ? ` ${fullName}` : username ? ` ${username}` : ''}!
				</Text>

				<Text style={paragraph}>
					Welcome to the future of influencer marketing! We're excited to have
					{businessName ? ` ${businessName}` : ' you'} join our community of brands discovering and
					connecting with the perfect influencers.
				</Text>

				<Section style={buttonSection}>
					<Text style={paragraph}>
						<strong>What's next?</strong>
					</Text>
					<Text style={listItem}>✅ Complete your onboarding to tell us about your brand</Text>
					<Text style={listItem}>🎯 Start your first influencer search campaign</Text>
					<Text style={listItem}>📊 Access powerful analytics and insights</Text>
				</Section>

				<Section style={buttonSection}>
					<Button style={button} href={dashboardUrl}>
						Complete Your Setup
					</Button>
				</Section>

				<Text style={paragraph}>
					Need help getting started? Our team is here to support you every step of the way. Simply
					reply to this email or check out our{' '}
					<Link href={`${baseUrl}/help`} style={link}>
						help center
					</Link>
					.
				</Text>

				<Hr style={hr} />

				<Text style={footer}>
					Best regards,
					<br />
					The Gemz Team
				</Text>

				{unsubscribeUrl && (
					<Text style={footer}>
						<Link href={unsubscribeUrl} style={unsubscribeLink}>
							Unsubscribe from these emails
						</Link>
					</Text>
				)}
			</Container>
		</Body>
	</Html>
);

const welcomeEmailPreviewProps: WelcomeEmailProps = {
	username: 'johndoe',
	fullName: 'John Doe',
	businessName: 'Acme Corp',
	dashboardUrl: 'https://usegems.io/dashboard',
};

WelcomeEmail.PreviewProps = welcomeEmailPreviewProps;

export default WelcomeEmail;

// Styles
const main: CSSProperties = {
	backgroundColor: '#ffffff',
	color: '#24292e',
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
};

const container: CSSProperties = {
	maxWidth: '480px',
	margin: '0 auto',
	padding: '20px 0 48px',
};

const logo: CSSProperties = {
	margin: '0 auto 20px',
};

const title: CSSProperties = {
	fontSize: '24px',
	lineHeight: '1.25',
	fontWeight: '600',
	textAlign: 'center',
	margin: '0 0 30px',
};

const paragraph: CSSProperties = {
	fontSize: '16px',
	lineHeight: '1.5',
	margin: '0 0 16px',
};

const listItem: CSSProperties = {
	fontSize: '16px',
	lineHeight: '1.5',
	margin: '0 0 8px',
	paddingLeft: '20px',
};

const buttonSection: CSSProperties = {
	textAlign: 'center',
	margin: '32px 0',
};

const button: CSSProperties = {
	fontSize: '16px',
	backgroundColor: '#0066cc',
	color: '#fff',
	lineHeight: 1.5,
	borderRadius: '8px',
	padding: '12px 24px',
	textDecoration: 'none',
	display: 'inline-block',
	fontWeight: '600',
};

const link: CSSProperties = {
	color: '#0066cc',
	textDecoration: 'underline',
};

const hr: CSSProperties = {
	borderColor: '#e1e4e8',
	margin: '42px 0 26px',
};

const footer: CSSProperties = {
	color: '#6a737d',
	fontSize: '14px',
	textAlign: 'center',
	margin: '0 0 10px',
};

const unsubscribeLink: CSSProperties = {
	color: '#6a737d',
	fontSize: '12px',
	textDecoration: 'underline',
};
