import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';

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
          alt="usegemz Logo"
          style={logo}
        />
        
        <Text style={title}>
          Your influencer journey is waiting! 🚀
        </Text>
        
        <Text style={paragraph}>
          Hi{fullName ? ` ${fullName}` : username ? ` ${username}` : ''}!
        </Text>
        
        <Text style={paragraph}>
          We noticed you signed up for usegemz but haven't completed your setup yet. 
          {businessName ? ` ${businessName}` : ' Your brand'} is just a few steps away from discovering 
          thousands of perfect influencer matches!
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
          <Text style={listItem}>
            📊 Detailed analytics and audience insights
          </Text>
          <Text style={listItem}>
            📧 Direct contact information for outreach
          </Text>
          <Text style={listItem}>
            📈 Campaign performance tracking
          </Text>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href={dashboardUrl}>
            Complete Setup & Start Trial
          </Button>
        </Section>

        <Text style={paragraph}>
          <strong>Still have questions?</strong> Our team is here to help! 
          Reply to this email or check out our{' '}
          <Link href={`${baseUrl}/help`} style={link}>
            quick start guide
          </Link>{' '}
          to see how other brands are finding success.
        </Text>

        <Section style={testimonialSection}>
          <Text style={testimonialText}>
            "I found 50+ perfect micro-influencers for our skincare campaign in just 15 minutes. 
            The results exceeded our expectations!"
          </Text>
          <Text style={testimonialAuthor}>
            — Sarah K., Marketing Director
          </Text>
        </Section>

        <Hr style={hr} />
        
        <Text style={footer}>
          Ready to grow your brand?<br />
          The usegemz Team
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

TrialAbandonmentEmail.PreviewProps = {
  username: 'johndoe',
  fullName: 'John Doe',
  businessName: 'Acme Corp',
  dashboardUrl: 'https://influencerplatform.vercel.app/onboarding/step-1',
} as TrialAbandonmentEmailProps;

export default TrialAbandonmentEmail;

// Styles
const main = {
  backgroundColor: '#ffffff',
  color: '#24292e',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
};

const container = {
  maxWidth: '480px',
  margin: '0 auto',
  padding: '20px 0 48px',
};

const logo = {
  margin: '0 auto 20px',
};

const title = {
  fontSize: '24px',
  lineHeight: '1.25',
  fontWeight: '600',
  textAlign: 'center' as const,
  margin: '0 0 30px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px',
};

const listItem = {
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  paddingLeft: '20px',
};

const highlightSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const highlightText = {
  fontSize: '18px',
  lineHeight: '1.4',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
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

const testimonialSection = {
  backgroundColor: '#e3f2fd',
  borderLeft: '4px solid #2196f3',
  padding: '16px 20px',
  margin: '24px 0',
};

const testimonialText = {
  fontSize: '16px',
  fontStyle: 'italic',
  lineHeight: '1.5',
  margin: '0 0 8px',
};

const testimonialAuthor = {
  fontSize: '14px',
  color: '#666',
  margin: '0',
};

const link = {
  color: '#0066cc',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e1e4e8',
  margin: '42px 0 26px',
};

const footer = {
  color: '#6a737d',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0 0 10px',
};

const unsubscribeLink = {
  color: '#6a737d',
  fontSize: '12px',
  textDecoration: 'underline',
};