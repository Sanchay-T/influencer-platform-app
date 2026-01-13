/**
 * Export Ready Email
 *
 * @context Sent when a background CSV export completes.
 * Contains download link with 7-day expiration notice.
 */

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

interface ExportReadyEmailProps {
	downloadUrl: string;
	creatorCount: number;
	expiresAt: string;
}

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://usegems.io';

export const ExportReadyEmail = ({
	downloadUrl,
	creatorCount,
	expiresAt,
}: ExportReadyEmailProps) => (
	<Html>
		<Head />
		<Body style={main}>
			<Preview>Your creator export is ready to download</Preview>
			<Container style={container}>
				<Text style={title}>Your export is ready!</Text>

				<Text style={paragraph}>
					Great news! Your CSV export has finished processing and is ready to download.
				</Text>

				<Section style={statsSection}>
					<Text style={statsHeadline}>Export Summary</Text>
					<Text style={statsItem}>
						<strong>{creatorCount.toLocaleString()}</strong> creators exported
					</Text>
				</Section>

				<Section style={buttonSection}>
					<Button style={primaryButton} href={downloadUrl}>
						Download CSV
					</Button>
				</Section>

				<Section style={warningSection}>
					<Text style={warningText}>
						This download link expires on <strong>{expiresAt}</strong>. Make sure to download your
						file before then.
					</Text>
				</Section>

				<Text style={paragraph}>
					Need help with your export? Just reply to this email and our team will assist you.
				</Text>

				<Hr style={hr} />

				<Text style={footer}>— The Gemz Team</Text>
			</Container>
		</Body>
	</Html>
);

ExportReadyEmail.PreviewProps = {
	downloadUrl: `${baseUrl}/exports/sample.csv`,
	creatorCount: 1250,
	expiresAt: 'January 20, 2026',
} as ExportReadyEmailProps;

export default ExportReadyEmail;

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

const statsSection: CSSProperties = {
	backgroundColor: '#111114',
	borderRadius: '12px',
	padding: '20px',
	margin: '28px 0',
	border: '1px solid rgba(255,255,255,0.05)',
	textAlign: 'center',
};

const statsHeadline: CSSProperties = {
	fontSize: '14px',
	fontWeight: 500,
	color: '#9ca3af',
	margin: '0 0 8px',
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
};

const statsItem: CSSProperties = {
	fontSize: '20px',
	fontWeight: 600,
	color: '#f4f4f5',
	margin: 0,
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

const warningSection: CSSProperties = {
	backgroundColor: 'rgba(249, 115, 22, 0.1)',
	borderRadius: '8px',
	padding: '12px 16px',
	margin: '24px 0',
	border: '1px solid rgba(249, 115, 22, 0.2)',
};

const warningText: CSSProperties = {
	fontSize: '14px',
	color: '#f97316',
	margin: 0,
	textAlign: 'center',
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
