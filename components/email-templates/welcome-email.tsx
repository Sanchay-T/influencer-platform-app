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
      <Preview>
        Welcome to the Influencer Platform! 🎉 Your account is ready to go.
      </Preview>
      <Container style={container}>
        <Img
          src={`${baseUrl}/static/logo.png`}
          width="48"
          height="48"
          alt="Influencer Platform Logo"
          style={logo}
        />
        
        <Text style={title}>
          Welcome to Influencer Platform! 🎉
        </Text>
        
        <Text style={paragraph}>
          Hi{fullName ? ` ${fullName}` : username ? ` ${username}` : ''}!
        </Text>
        
        <Text style={paragraph}>
          Welcome to the future of influencer marketing! We're excited to have 
          {businessName ? ` ${businessName}` : ' you'} join our community of brands 
          discovering and connecting with the perfect influencers.
        </Text>

        <Section style={buttonSection}>
          <Text style={paragraph}>
            <strong>What's next?</strong>
          </Text>
          <Text style={listItem}>
            ✅ Complete your onboarding to tell us about your brand
          </Text>
          <Text style={listItem}>
            🎯 Start your first influencer search campaign
          </Text>
          <Text style={listItem}>
            📊 Access powerful analytics and insights
          </Text>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href={dashboardUrl}>
            Complete Your Setup
          </Button>
        </Section>

        <Text style={paragraph}>
          Need help getting started? Our team is here to support you every step of the way. 
          Simply reply to this email or check out our{' '}
          <Link href={`${baseUrl}/help`} style={link}>
            help center
          </Link>.
        </Text>

        <Hr style={hr} />
        
        <Text style={footer}>
          Best regards,<br />
          The Influencer Platform Team
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

WelcomeEmail.PreviewProps = {
  username: 'johndoe',
  fullName: 'John Doe',
  businessName: 'Acme Corp',
  dashboardUrl: 'https://influencerplatform.vercel.app/onboarding/step-1',
} as WelcomeEmailProps;

export default WelcomeEmail;

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

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
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