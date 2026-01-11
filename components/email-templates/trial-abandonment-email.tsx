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

interface TrialAbandonmentEmailProps {
	username?: string;
	fullName?: string;
	businessName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

const baseUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: 'https://influencerplatform.vercel.app';

export const TrialAbandonmentEmail = ({
	username,
	fullName,
	businessName,
	dashboardUrl,
	unsubscribeUrl,
}: TrialAbandonmentEmailProps) => (
	<Html>
		<Head />
		<Body style={main}>
			<Preview>
				Don't miss out! Complete your setup and discover the perfect influencers for your brand.
			</Preview>
			<Container style={container}>
				<Img
					src={`${baseUrl}/static/logo.png`}
					width="48"
					height="48"
					alt="Gemz Logo"
					style={logo}
				/>

				<Text style={title}>Your influencer journey is waiting! 🚀</Text>

				<Text style={paragraph}>
					Hi{fullName ? ` ${fullName}` : username ? ` ${username}` : ''}!
				</Text>

				<Text style={paragraph}>
					We noticed you signed up for Gemz but haven't completed your setup yet.
					{businessName ? ` ${businessName}` : ' Your brand'} is just a few steps away from
					discovering thousands of perfect influencer matches!
				</Text>

				<Section style={highlightSection}>
					<Text style={highlightText}>
						⏰ <strong>Don't miss out on your free trial!</strong>
					</Text>
					<Text style={paragraph}>
						Complete your setup now and start your 7-day free trial to access:
					</Text>
					<Text style={listItem}>
						🔍 Advanced influencer search across TikTok, Instagram & YouTube
					</Text>
					<Text style={listItem}>📊 Detailed analytics and audience insights</Text>
					<Text style={listItem}>📧 Direct contact information for outreach</Text>
					<Text style={listItem}>📈 Campaign performance tracking</Text>
				</Section>

				<Section style={buttonSection}>
					<Button style={button} href={dashboardUrl}>
						Complete Setup & Start Trial
					</Button>
				</Section>

				<Text style={paragraph}>
					<strong>Still have questions?</strong> Our team is here to help! Reply to this email or
					check out our{' '}
					<Link href={`${baseUrl}/help`} style={link}>
						quick start guide
					</Link>{' '}
					to see how other brands are finding success.
				</Text>

				<Section style={testimonialSection}>
					<Text style={testimonialText}>
						"I found 50+ perfect micro-influencers for our skincare campaign in just 15 minutes. The
						results exceeded our expectations!"
					</Text>
					<Text style={testimonialAuthor}>— Sarah K., Marketing Director</Text>
				</Section>

				<Hr style={hr} />

				<Text style={footer}>
					Ready to grow your brand?
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

const trialAbandonmentPreviewProps: TrialAbandonmentEmailProps = {
	username: 'johndoe',
	fullName: 'John Doe',
	businessName: 'Acme Corp',
	dashboardUrl: 'https://usegems.io/dashboard',
};

TrialAbandonmentEmail.PreviewProps = trialAbandonmentPreviewProps;

export default TrialAbandonmentEmail;

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

const highlightSection: CSSProperties = {
	backgroundColor: '#f8f9fa',
	borderRadius: '8px',
	padding: '20px',
	margin: '24px 0',
};

const highlightText: CSSProperties = {
	fontSize: '18px',
	lineHeight: '1.4',
	margin: '0 0 16px',
	textAlign: 'center',
};

const buttonSection: CSSProperties = {
	textAlign: 'center',
	margin: '32px 0',
};

const button: CSSProperties = {
	fontSize: '16px',
	backgroundColor: '#28a745',
	color: '#fff',
	lineHeight: 1.5,
	borderRadius: '8px',
	padding: '14px 28px',
	textDecoration: 'none',
	display: 'inline-block',
	fontWeight: '600',
};

const testimonialSection: CSSProperties = {
	backgroundColor: '#e3f2fd',
	borderLeft: '4px solid #2196f3',
	padding: '16px 20px',
	margin: '24px 0',
};

const testimonialText: CSSProperties = {
	fontSize: '16px',
	fontStyle: 'italic',
	lineHeight: '1.5',
	margin: '0 0 8px',
};

const testimonialAuthor: CSSProperties = {
	fontSize: '14px',
	color: '#666',
	margin: '0',
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
