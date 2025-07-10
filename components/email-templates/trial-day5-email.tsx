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

interface TrialDay5EmailProps {
  username?: string;
  fullName?: string;
  businessName?: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://influencerplatform.vercel.app';

export const TrialDay5Email = ({
  username,
  fullName,
  businessName,
  dashboardUrl,
  unsubscribeUrl,
}: TrialDay5EmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>
        Your trial ends in 2 days! See what you've accomplished and secure your access. 🏆
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
          Amazing progress! Your trial ends in 2 days 🏆
        </Text>
        
        <Text style={paragraph}>
          Hi{fullName ? ` ${fullName}` : username ? ` ${username}` : ''}!
        </Text>
        
        <Text style={paragraph}>
          You're 5 days into your free trial, and we're impressed by how much 
          {businessName ? ` ${businessName}` : ' you'} has accomplished! Your trial 
          ends in just 2 days, so let's make sure you don't lose access to this powerful platform.
        </Text>

        <Section style={accomplishmentSection}>
          <Text style={accomplishmentTitle}>🎉 <strong>Look what you've achieved:</strong></Text>
          <Text style={accomplishmentItem}>
            ✅ Discovered hundreds of potential influencer partners
          </Text>
          <Text style={accomplishmentItem}>
            ✅ Gained insights into audience demographics and engagement rates
          </Text>
          <Text style={accomplishmentItem}>
            ✅ Saved hours of manual research and outreach prep
          </Text>
          <Text style={accomplishmentItem}>
            ✅ Built a foundation for scalable influencer marketing
          </Text>
        </Section>

        <Section style={urgencySection}>
          <Text style={urgencyTitle}>⏰ <strong>Don't lose access!</strong></Text>
          <Text style={paragraph}>
            Your trial expires in <strong>2 days</strong>. Continue your influencer 
            marketing journey with full access to:
          </Text>
          <Text style={featureItem}>🔍 Unlimited searches across all platforms</Text>
          <Text style={featureItem}>📊 Advanced analytics and reporting</Text>
          <Text style={featureItem}>📧 Direct email extraction for outreach</Text>
          <Text style={featureItem}>🎯 AI-powered audience insights</Text>
          <Text style={featureItem}>📈 Campaign performance tracking</Text>
        </Section>

        <Section style={buttonSection}>
          <Button style={primaryButton} href={`${dashboardUrl}/billing`}>
            Continue with Full Access
          </Button>
          <Text style={buttonSubtext}>
            Only $49/month • Cancel anytime • No setup fees
          </Text>
        </Section>

        <Section style={socialProofSection}>
          <Text style={socialProofTitle}>🌟 <strong>Join 2,500+ brands that trust us:</strong></Text>
          <Text style={testimonialText}>
            "This platform helped us scale from 5 to 50 influencer partnerships in just one month. 
            The ROI has been incredible."
          </Text>
          <Text style={testimonialAuthor}>
            — Maria S., Growth Marketing Lead
          </Text>
        </Section>

        <Text style={paragraph}>
          <strong>Questions about upgrading?</strong> Our team is here to help! 
          Reply to this email or{' '}
          <Link href={`${baseUrl}/contact`} style={link}>
            schedule a quick call
          </Link>{' '}
          to discuss your specific needs.
        </Text>

        <Section style={reminderSection}>
          <Text style={reminderText}>
            🔔 <strong>Reminder:</strong> Your trial ends on [TRIAL_END_DATE]. 
            Upgrade before then to maintain uninterrupted access to your campaigns and data.
          </Text>
        </Section>

        <Hr style={hr} />
        
        <Text style={footer}>
          Thanks for being part of our community!<br />
          The usegemz Team
        </Text>

        <Text style={footer}>
          <Link href={dashboardUrl} style={link}>Access Dashboard</Link> • {' '}
          <Link href={`${baseUrl}/help`} style={link}>Help Center</Link>
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

TrialDay5Email.PreviewProps = {
  username: 'johndoe',
  fullName: 'John Doe',
  businessName: 'Acme Corp',
  dashboardUrl: 'https://influencerplatform.vercel.app/campaigns',
} as TrialDay5EmailProps;

export default TrialDay5Email;

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

const accomplishmentSection = {
  backgroundColor: '#e8f5e8',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const accomplishmentTitle = {
  fontSize: '18px',
  lineHeight: '1.4',
  margin: '0 0 16px',
  color: '#28a745',
  textAlign: 'center' as const,
};

const accomplishmentItem = {
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  paddingLeft: '8px',
};

const urgencySection = {
  backgroundColor: '#fff3cd',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '2px solid #ffc107',
};

const urgencyTitle = {
  fontSize: '18px',
  lineHeight: '1.4',
  margin: '0 0 16px',
  color: '#856404',
  textAlign: 'center' as const,
};

const featureItem = {
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  paddingLeft: '8px',
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const primaryButton = {
  fontSize: '18px',
  backgroundColor: '#dc3545',
  color: '#fff',
  lineHeight: 1.5,
  borderRadius: '8px',
  padding: '16px 32px',
  textDecoration: 'none',
  display: 'inline-block',
  fontWeight: '700',
  boxShadow: '0 4px 8px rgba(220, 53, 69, 0.3)',
};

const buttonSubtext = {
  fontSize: '14px',
  color: '#6c757d',
  margin: '12px 0 0',
  fontStyle: 'italic',
};

const socialProofSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const socialProofTitle = {
  fontSize: '16px',
  lineHeight: '1.4',
  margin: '0 0 16px',
  color: '#495057',
};

const testimonialText = {
  fontSize: '16px',
  fontStyle: 'italic',
  lineHeight: '1.5',
  margin: '0 0 8px',
  color: '#212529',
};

const testimonialAuthor = {
  fontSize: '14px',
  color: '#6c757d',
  margin: '0',
};

const reminderSection = {
  backgroundColor: '#f8d7da',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const reminderText = {
  fontSize: '15px',
  lineHeight: '1.4',
  margin: '0',
  color: '#721c24',
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