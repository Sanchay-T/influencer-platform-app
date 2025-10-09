import 'dotenv/config';

const AUTOMATION_USER_ID = process.env.AUTOMATION_USER_ID || 'user_33neqrnH0OrnbvECgCZF9YT4E7F';
const BASE_URL = process.env.AUTOMATION_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TESTING_SECRET = process.env.AUTOMATION_TESTING_SECRET;

if (!TESTING_SECRET) {
  throw new Error('AUTOMATION_TESTING_SECRET is not set');
}

async function run() {
  const headers = {
    'X-Testing-Token': TESTING_SECRET,
    'X-Automation-User-Id': AUTOMATION_USER_ID,
    'Content-Type': 'application/json',
  };

  const statusRes = await fetch(`${BASE_URL}/api/onboarding/status`, { headers });
  console.log('status GET', statusRes.status, await statusRes.text());

  const usageRes = await fetch(`${BASE_URL}/api/usage/summary`, { headers });
  console.log('usage GET', usageRes.status, await usageRes.text());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
