import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClerkClient } from '@clerk/backend';

async function deleteTestUsers() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY not found');
    return;
  }
  
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  
  // Get all users with e2e-test email pattern
  const users = await clerk.users.getUserList({ 
    limit: 100,
    query: 'e2e-test'
  });
  
  console.log(`Found ${users.data.length} test users to delete`);
  
  for (const user of users.data) {
    const email = user.emailAddresses[0]?.emailAddress || 'no-email';
    if (email.includes('e2e-test') || email.includes('gemz-test.com')) {
      console.log(`Deleting: ${email}`);
      await clerk.users.deleteUser(user.id);
    }
  }
  
  console.log('Done!');
}

deleteTestUsers().catch(console.error);
