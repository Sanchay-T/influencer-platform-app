#!/usr/bin/env npx tsx
/**
 * View User Logs
 *
 * Usage:
 *   npx tsx scripts/view-user-logs.ts <email>
 *   npx tsx scripts/view-user-logs.ts test@example.com
 *   npx tsx scripts/view-user-logs.ts --list  (list all users with logs)
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGS_BASE_DIR = path.join(process.cwd(), 'logs', 'users');

function listUsers(): void {
  console.log('\n📋 Users with logs:\n');

  if (!fs.existsSync(LOGS_BASE_DIR)) {
    console.log('   No logs found yet. Logs will appear after users sign up.\n');
    return;
  }

  const users = fs.readdirSync(LOGS_BASE_DIR)
    .filter(f => fs.statSync(path.join(LOGS_BASE_DIR, f)).isDirectory());

  if (users.length === 0) {
    console.log('   No user logs found.\n');
    return;
  }

  for (const user of users) {
    const userDir = path.join(LOGS_BASE_DIR, user);
    const sessions = fs.readdirSync(userDir)
      .filter(f => f.endsWith('.json') && f !== 'all_activity.jsonl');

    const masterLog = path.join(userDir, 'all_activity.jsonl');
    let entryCount = 0;
    if (fs.existsSync(masterLog)) {
      entryCount = fs.readFileSync(masterLog, 'utf-8')
        .split('\n')
        .filter(l => l.trim()).length;
    }

    console.log(`   📧 ${user}`);
    console.log(`      Sessions: ${sessions.length} | Log entries: ${entryCount}`);
  }

  console.log('\n   Run: npx tsx scripts/view-user-logs.ts <email>\n');
}

function viewUserLogs(email: string): void {
  const sanitizedEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  const userDir = path.join(LOGS_BASE_DIR, sanitizedEmail);

  console.log('\n' + '='.repeat(70));
  console.log(`📋 LOGS FOR: ${email}`);
  console.log('='.repeat(70));

  if (!fs.existsSync(userDir)) {
    console.log('\n   ❌ No logs found for this user.\n');
    console.log('   Make sure the user has signed up and the email is correct.\n');
    return;
  }

  const masterLog = path.join(userDir, 'all_activity.jsonl');

  if (!fs.existsSync(masterLog)) {
    console.log('\n   ❌ No activity log found for this user.\n');
    return;
  }

  const entries = fs.readFileSync(masterLog, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  console.log(`\n📁 Log file: ${masterLog}`);
  console.log(`📝 Total entries: ${entries.length}\n`);

  // Print timeline
  console.log('📅 TIMELINE:\n');

  for (const entry of entries) {
    const time = new Date(entry.timestamp).toLocaleString();
    const icon = getEventIcon(entry.event);

    console.log(`${time}`);
    console.log(`   ${icon} [${entry.event}] ${entry.message}`);

    if (entry.data) {
      const dataLines = JSON.stringify(entry.data, null, 2).split('\n');
      for (const line of dataLines) {
        console.log(`      ${line}`);
      }
    }
    console.log('');
  }

  // Summary
  console.log('='.repeat(70));
  console.log('📊 SUMMARY:\n');

  const eventCounts: Record<string, number> = {};
  for (const entry of entries) {
    eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1;
  }

  for (const [event, count] of Object.entries(eventCounts).sort()) {
    console.log(`   ${getEventIcon(event)} ${event}: ${count}`);
  }

  // Check flow completion
  const hasClerkWebhook = entries.some(e => e.event === 'CLERK_WEBHOOK');
  const hasUserCreated = entries.some(e => e.event === 'USER_CREATED');
  const hasStripeWebhook = entries.some(e => e.event === 'STRIPE_WEBHOOK');
  const hasOnboardingComplete = entries.some(e => e.event === 'ONBOARDING_COMPLETE');
  const hasPaymentSuccess = entries.some(e => e.event === 'PAYMENT_SUCCESS');
  const hasError = entries.some(e => e.event === 'ERROR');

  console.log('\n📋 FLOW STATUS:\n');
  console.log(`   ${hasClerkWebhook ? '✅' : '⬜'} Clerk webhook received`);
  console.log(`   ${hasUserCreated ? '✅' : '⬜'} User created in database`);
  console.log(`   ${hasStripeWebhook ? '✅' : '⬜'} Stripe webhook received`);
  console.log(`   ${hasOnboardingComplete ? '✅' : '⬜'} Onboarding completed`);
  console.log(`   ${hasPaymentSuccess ? '✅' : '⬜'} Payment successful`);

  if (hasError) {
    console.log(`\n   🚨 ERRORS DETECTED - Check timeline above`);
  }

  if (hasPaymentSuccess) {
    console.log(`\n   🎉 User is fully onboarded!`);
  } else if (hasStripeWebhook) {
    console.log(`\n   ⏳ Stripe webhook received but onboarding not complete`);
  } else if (hasUserCreated) {
    console.log(`\n   ⏳ User created but payment not received yet`);
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

function getEventIcon(event: string): string {
  const icons: Record<string, string> = {
    'SESSION_START': '🚀',
    'CLERK_WEBHOOK': '👤',
    'USER_CREATED': '✨',
    'PLAN_SELECTED': '📋',
    'STRIPE_CHECKOUT': '💳',
    'STRIPE_WEBHOOK': '💰',
    'USER_ENSURED': '🔄',
    'PAYMENT_SUCCESS': '✅',
    'PAYMENT_FAILED': '❌',
    'ONBOARDING_COMPLETE': '🎉',
    'TRIAL_STARTED': '⏱️',
    'ERROR': '🚨',
  };
  return icons[event] || '📌';
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--list') {
  listUsers();
} else {
  viewUserLogs(args[0]);
}
