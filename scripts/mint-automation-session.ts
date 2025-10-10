if (!process.env.CLERK_AUTOMATION_SERVICE_TOKEN) {
  console.error('Missing CLERK_AUTOMATION_SERVICE_TOKEN in environment.');
  process.exit(1);
}

async function createAutomationSession() {
  try {
    const baseUrl = process.env.CLERK_AUTOMATION_SERVICE_TOKEN?.startsWith('sk_live')
      ? 'https://api.clerk.com'
      : 'https://api.clerk.dev';

    const response = await fetch(`${baseUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_AUTOMATION_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: 'user_33neqrnH0OrnbvECgCZF9YT4E7F' }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Clerk API responded with ${response.status}: ${errorBody}`);
    }

    const session = await response.json();

    console.log('\nAutomation session minted successfully!');
    console.log('Session ID:', session.id);

    let token = session.token || session.sessionToken || session.jwt;

    if (!token && session.id) {
      const tokenRes = await fetch(`${baseUrl}/v1/sessions/${session.id}/tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CLERK_AUTOMATION_SERVICE_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!tokenRes.ok) {
        const errorBody = await tokenRes.text();
        throw new Error(`Failed to fetch session token (${tokenRes.status}): ${errorBody}`);
      }

      const tokenPayload = await tokenRes.json();
      token = tokenPayload.token || tokenPayload.jwt;
    }

    console.log('\nSession token:\n');
    console.log(token);
    console.log('\nStore this token securely (e.g., AUTOMATION_SESSION_TOKEN in .env.local).');
  } catch (error) {
    console.error('Failed to create automation session:', error);
    process.exit(1);
  }
}

createAutomationSession();
