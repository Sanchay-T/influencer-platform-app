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

interface TrialDay2EmailProps {
	username?: string;
	fullName?: string;
	businessName?: string;
	dashboardUrl: string;
	unsubscribeUrl?: string;
}

const baseUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: 'https://influencerplatform.vercel.app';

export const TrialDay2Email = ({
	username,
	fullName,
	businessName,
	dashboardUrl,
	unsubscribeUrl,
}: TrialDay2EmailProps) => (
	<Html>
		<Head />
		<Body style={main}>
			<Preview>
				Day 2 of your trial - here are some tips to maximize your influencer discovery! 💡
			</Preview>
			<Container style={container}>
				<Img
					src={`${baseUrl}/static/logo.png`}
					width="48"
					height="48"
					alt="Gemz Logo"
					style={logo}
				/>

				<Text style={title}>How's your trial going? 💡</Text>

				<Text style={paragraph}>
					Hi{fullName ? ` ${fullName}` : username ? ` ${username}` : ''}!
				</Text>

				<Text style={paragraph}>
					You're now 2 days into your free trial! We hope you're already discovering amazing
					influencers for{businessName ? ` ${businessName}` : ' your brand'}. Here are some pro tips
					to get the most out of your experience:
				</Text>

				<Section style={tipSection}>
					<Text style={tipTitle}>
						🎯 <strong>Pro Tips for Better Results:</strong>
					</Text>

					<Text style={tipItem}>
						<strong>1. Use specific keywords:</strong> Instead of "fitness", try "home workouts" or
						"yoga for beginners" for more targeted results.
					</Text>

					<Text style={tipItem}>
						<strong>2. Try similar searches:</strong> Found a perfect influencer? Use our "similar"
						search to discover creators with comparable audiences.
					</Text>

					<Text style={tipItem}>
						<strong>3. Export your data:</strong> Download CSV reports to analyze influencers
						offline and share with your team.
					</Text>

					<Text style={tipItem}>
						<strong>4. Check multiple platforms:</strong> Cross-platform campaigns often perform
						better. Search TikTok, Instagram, and YouTube!
					</Text>
				</Section>

				<Section style={statsSection}>
					<Text style={statsTitle}>
						📊 <strong>Average Trial Results:</strong>
					</Text>
					<Text style={statsItem}>• 127 influencers discovered per campaign</Text>
					<Text style={statsItem}>• 23% higher engagement rates vs. traditional methods</Text>
					<Text style={statsItem}>• 15 minutes average time to find 50+ creators</Text>
				</Section>

				<Section style={buttonSection}>
					<Button style={button} href={dashboardUrl}>
						Continue Your Search
					</Button>
				</Section>

				<Text style={paragraph}>
					<strong>Need inspiration?</strong> Check out our{' '}
					<Link href={`${baseUrl}/case-studies`} style={link}>
						case studies
					</Link>{' '}
					to see how other brands are crushing their influencer campaigns.
				</Text>

				<Section style={helpSection}>
					<Text style={helpText}>
						🤝 <strong>Want a personalized demo?</strong>
					</Text>
					<Text style={paragraph}>
						Our team can show you advanced search techniques and help optimize your campaigns. Just
						reply to this email to schedule a quick 15-minute call!
					</Text>
				</Section>

				<Hr style={hr} />

				<Text style={footer}>
					Happy searching!
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

const trialDay2PreviewProps: TrialDay2EmailProps = {
	username: 'johndoe',
	fullName: 'John Doe',
	businessName: 'Acme Corp',
	dashboardUrl: 'https://influencerplatform.vercel.app/campaigns',
};

TrialDay2Email.PreviewProps = trialDay2PreviewProps;

export default TrialDay2Email;

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

const tipSection: CSSProperties = {
	backgroundColor: '#f0f8ff',
	borderRadius: '8px',
	padding: '20px',
	margin: '24px 0',
};

const tipTitle: CSSProperties = {
	fontSize: '18px',
	lineHeight: '1.4',
	margin: '0 0 16px',
	color: '#1a73e8',
};

const tipItem: CSSProperties = {
	fontSize: '15px',
	lineHeight: '1.5',
	margin: '0 0 12px',
	paddingLeft: '8px',
};

const statsSection: CSSProperties = {
	backgroundColor: '#f8f9fa',
	borderRadius: '8px',
	padding: '20px',
	margin: '24px 0',
	textAlign: 'center',
};

const statsTitle: CSSProperties = {
	fontSize: '18px',
	lineHeight: '1.4',
	margin: '0 0 16px',
	color: '#28a745',
};

const statsItem: CSSProperties = {
	fontSize: '15px',
	lineHeight: '1.6',
	margin: '0 0 8px',
	color: '#495057',
};

const buttonSection: CSSProperties = {
	textAlign: 'center',
	margin: '32px 0',
};

const button: CSSProperties = {
	fontSize: '16px',
	backgroundColor: '#1a73e8',
	color: '#fff',
	lineHeight: 1.5,
	borderRadius: '8px',
	padding: '12px 24px',
	textDecoration: 'none',
	display: 'inline-block',
	fontWeight: '600',
};

const helpSection: CSSProperties = {
	backgroundColor: '#fff3cd',
	borderRadius: '8px',
	padding: '20px',
	margin: '24px 0',
	textAlign: 'center',
};

const helpText: CSSProperties = {
	fontSize: '18px',
	lineHeight: '1.4',
	margin: '0 0 12px',
	color: '#856404',
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
