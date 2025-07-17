#!/usr/bin/env node

/**
 * Find User ID Helper Script
 * 
 * This script helps you find the Clerk userId for a given email address.
 * 
 * Usage: node scripts/find-user-id.js <email>
 * Example: node scripts/find-user-id.js thalnerkarsanchay17@gmail.com
 */

const { createClerkClient } = require('@clerk/nextjs/server');
require('dotenv').config({ path: '.env.local' });

// Color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function findUserId(email) {
  try {
    log(`\n🔍 Finding Clerk userId for: ${email}`, 'cyan');
    
    // Initialize Clerk
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    // Find user by email
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    
    if (!users.data || users.data.length === 0) {
      log(`❌ No user found with email: ${email}`, 'red');
      log('💡 Make sure the user has signed up in your app', 'yellow');
      return;
    }
    
    const user = users.data[0];
    
    log('✅ User found!', 'green');
    log(`📧 Email: ${email}`, 'blue');
    log(`🆔 Clerk ID: ${user.id}`, 'blue');
    log(`👤 Name: ${user.firstName} ${user.lastName}`, 'blue');
    log(`📅 Created: ${new Date(user.createdAt).toLocaleString()}`, 'blue');
    
    log('\n📋 Copy this information:', 'yellow');
    log(`Email: ${email}`, 'cyan');
    log(`User ID: ${user.id}`, 'cyan');
    
    log('\n💡 Usage in reset script:', 'yellow');
    log(`npm run reset-user:simple ${email}`, 'cyan');
    log('(Make sure to update the emailToUserIdMap in reset-user-simple.js)', 'yellow');
    
  } catch (error) {
    log(`\n❌ Error finding user: ${error.message}`, 'red');
    console.error(error);
  }
}

// Main execution
const email = process.argv[2];

if (!email) {
  log('\n❌ Please provide an email address', 'red');
  log('Usage: node scripts/find-user-id.js <email>', 'yellow');
  log('Example: node scripts/find-user-id.js user@example.com\n', 'yellow');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  log(`\n❌ Invalid email format: ${email}`, 'red');
  process.exit(1);
}

// Run the finder
findUserId(email).then(() => {
  process.exit(0);
}).catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});