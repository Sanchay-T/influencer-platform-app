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
  } from '@react-email/components';
  
  interface CampaignFinishedEmailProps {
    username?: string;
    campaignName: string;
    campaignType: string;
    dashboardUrl: string;
  }
  
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : '';
  
  export const CampaignFinishedEmail = ({
    username,
    campaignName,
    campaignType,
    dashboardUrl,
  }: CampaignFinishedEmailProps) => (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#fff', color: '#24292e', fontFamily: 'sans-serif' }}>
        <Preview>
          Your campaign has finished!
        </Preview>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 0 48px' }}>
          <Img
            src="https://influencerplatform.vercel.app/static/logo.png"
            width="48"
            height="48"
            alt="Logo"
          />
          <Text style={{ fontSize: '24px', lineHeight: 1.25 }}>
            Hello{username ? ` ${username}` : ''}!
          </Text>
          <Section style={{ padding: '24px', border: 'solid 1px #dedede', borderRadius: '5px', textAlign: 'center' }}>
            <Text>
              Your campaign <strong>{campaignName}</strong> ({campaignType}) has finished.
            </Text>
            <Button
              style={{
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: '#fff',
                lineHeight: 1.5,
                borderRadius: '0.5em',
                padding: '12px 24px',
                marginTop: '16px'
              }}
              href={dashboardUrl}
            >
              View results
            </Button>
          </Section>
          <Text style={{ color: '#6a737d', fontSize: '12px', textAlign: 'center', marginTop: '60px' }}>
            Gemz
          </Text>
        </Container>
      </Body>
    </Html>
  );
  
  CampaignFinishedEmail.PreviewProps = {
    username: 'alanturing',
    campaignName: 'Summer Campaign',
    campaignType: 'Influencer',
    dashboardUrl: 'https://influencerplatform.vercel.app/dashboard',
  } as CampaignFinishedEmailProps;
  
  export default CampaignFinishedEmail;
  
  const main = {
    backgroundColor: '#ffffff',
    color: '#24292e',
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
  };
  
  const container = {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '20px 0 48px',
  };
  
  const title = {
    fontSize: '24px',
    lineHeight: 1.25,
  };
  
  const section = {
    padding: '24px',
    border: 'solid 1px #dedede',
    borderRadius: '5px',
    textAlign: 'center' as const,
  };
  
  const text = {
    margin: '0 0 10px 0',
    textAlign: 'left' as const,
  };
  
  const button = {
    fontSize: '14px',
    backgroundColor: '#28a745',
    color: '#fff',
    lineHeight: 1.5,
    borderRadius: '0.5em',
    padding: '12px 24px',
  };
  
  const links = {
    textAlign: 'center' as const,
  };
  
  const link = {
    color: '#0366d6',
    fontSize: '12px',
  };
  
  const footer = {
    color: '#6a737d',
    fontSize: '12px',
    textAlign: 'center' as const,
    marginTop: '60px',
  };
  
  export const CampaignFinishedEmailEn = ({
    username,
    campaignName,
    campaignType,
    dashboardUrl,
  }: CampaignFinishedEmailProps) => (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#fff', color: '#24292e', fontFamily: 'sans-serif' }}>
        <Preview>
          Your campaign has finished!
        </Preview>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 0 48px' }}>
          <Img
            src="https://influencerplatform.vercel.app/static/logo.png"
            width="48"
            height="48"
            alt="Logo"
          />
          <Text style={{ fontSize: '24px', lineHeight: 1.25 }}>
            Hello{username ? ` ${username}` : ''}!
          </Text>
          <Section style={{ padding: '24px', border: 'solid 1px #dedede', borderRadius: '5px', textAlign: 'center' }}>
            <Text>
              Your campaign <strong>{campaignName}</strong> ({campaignType}) has finished.
            </Text>
            <Button
              style={{
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: '#fff',
                lineHeight: 1.5,
                borderRadius: '0.5em',
                padding: '12px 24px',
                marginTop: '16px'
              }}
              href={dashboardUrl}
            >
              View results
            </Button>
          </Section>
          <Text style={{ color: '#6a737d', fontSize: '12px', textAlign: 'center', marginTop: '60px' }}>
            Gemz
          </Text>
        </Container>
      </Body>
    </Html>
  );
  
  CampaignFinishedEmailEn.PreviewProps = {
    username: 'alanturing',
    campaignName: 'Summer Campaign',
    campaignType: 'Influencer',
    dashboardUrl: 'https://influencerplatform.vercel.app/dashboard',
  } as CampaignFinishedEmailProps;
  