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

type SocialSharingApprovalEmailProps = {
	fullName?: string;
	dashboardUrl: string;
};

export const SocialSharingApprovalEmail = ({
	fullName,
	dashboardUrl,
}: SocialSharingApprovalEmailProps) => (
	<Html>
		<Head />
		<Body style={main}>
			<Preview>Your free month on Gemz is live!</Preview>
			<Container style={container}>
				<Text style={title}>Your Free Month is Live!</Text>
				<Text style={paragraph}>{fullName ? `Hey ${fullName},` : 'Hey there,'}</Text>
				<Text style={paragraph}>
					Great news — your social sharing submission has been approved! We&apos;ve applied a credit
					to your Gemz account as a thank you for spreading the word.
				</Text>
				<Text style={paragraph}>
					The credit will automatically apply to your next invoice. You can continue discovering
					amazing creators without interruption.
				</Text>
				<Section style={buttonContainer}>
					<Button style={button} href={dashboardUrl}>
						Go to Dashboard
					</Button>
				</Section>
				<Hr style={hr} />
				<Text style={footer}>
					Thanks for being a Gemz champion! If you have any questions, reply to this email and
					we&apos;ll get back to you.
				</Text>
			</Container>
		</Body>
	</Html>
);

// Styles
const main: CSSProperties = {
	backgroundColor: '#f6f9fc',
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container: CSSProperties = {
	backgroundColor: '#ffffff',
	margin: '0 auto',
	padding: '20px 0 48px',
	marginBottom: '64px',
	maxWidth: '580px',
};

const title: CSSProperties = {
	fontSize: '24px',
	fontWeight: '700',
	color: '#1a1a1a',
	padding: '0 48px',
};

const paragraph: CSSProperties = {
	fontSize: '16px',
	lineHeight: '26px',
	color: '#484848',
	padding: '0 48px',
};

const buttonContainer: CSSProperties = {
	padding: '16px 48px',
};

const button: CSSProperties = {
	backgroundColor: '#7c3aed',
	borderRadius: '6px',
	color: '#fff',
	fontSize: '16px',
	fontWeight: '600',
	textDecoration: 'none',
	textAlign: 'center' as const,
	display: 'block',
	padding: '12px 24px',
};

const hr: CSSProperties = {
	borderColor: '#e6ebf1',
	margin: '20px 0',
};

const footer: CSSProperties = {
	color: '#8898aa',
	fontSize: '14px',
	lineHeight: '22px',
	padding: '0 48px',
};

export default SocialSharingApprovalEmail;
