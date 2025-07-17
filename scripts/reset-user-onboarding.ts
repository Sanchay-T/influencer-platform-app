#!/usr/bin/env tsx

/**
 * Advanced User Reset Script for Development Testing
 * 
 * Features:
 * - Reset onboarding status
 * - Clear trial data
 * - Delete scheduled emails
 * - Optional: Reset to specific onboarding step
 * - Optional: Set custom trial expiry
 * - Optional: Preserve certain data
 * 
 * Usage:
 *   npm run reset-user -- <email> [options]
 *   
 * Examples:
 *   npm run reset-user -- user@example.com
 *   npm run reset-user -- user@example.com --step=step-2
 *   npm run reset-user -- user@example.com --preserve-campaigns
 *   npm run reset-user -- user@example.com --set-trial=3
 */

import { sql } from '@vercel/postgres';
import { clerkClient } from '@clerk/nextjs/server';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface ResetOptions {
  step?: 'pending' | 'step-1' | 'step-2' | 'completed';
  preserveCampaigns?: boolean;
  preserveJobs?: boolean;
  setTrial?: number;
  force?: boolean;
}

class UserOnboardingReset {
  private spinner = ora();

  async findUserByEmail(email: string) {
    this.spinner.start('Finding user in Clerk...');
    try {
      const users = await clerkClient.users.getUserList({ emailAddress: [email] });
      
      if (!users.data || users.data.length === 0) {
        this.spinner.fail(chalk.red(`No user found with email: ${email}`));
        return null;
      }
      
      this.spinner.succeed(chalk.green(`Found user: ${users.data[0].id}`));
      return users.data[0];
    } catch (error) {
      this.spinner.fail(chalk.red('Failed to find user'));
      throw error;
    }
  }

  async resetUserProfile(userId: string, options: ResetOptions) {
    this.spinner.start('Resetting user profile...');
    
    try {
      const client = await sql.connect();
      
      let query = `
        UPDATE "userProfiles"
        SET 
          "onboardingStep" = $1,
          "updatedAt" = NOW()
      `;
      
      const values: any[] = [options.step || 'pending'];
      let paramCount = 1;

      // Only reset personal data if going back to pending
      if (!options.step || options.step === 'pending') {
        query += `, "fullName" = NULL, "businessName" = NULL, "industry" = NULL, 
                   "targetAudience" = NULL, "campaignGoals" = NULL`;
      }

      // Handle trial settings
      if (options.setTrial !== undefined) {
        paramCount++;
        const trialDays = options.setTrial;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + trialDays);
        
        query += `, "trialStartedAt" = $${paramCount}, "trialExpiresAt" = $${paramCount + 1}, "trialStatus" = 'active'`;
        values.push(startDate.toISOString(), endDate.toISOString());
        paramCount += 2;
      } else if (!options.step || options.step === 'pending') {
        query += `, "trialStartedAt" = NULL, "trialExpiresAt" = NULL, "trialStatus" = 'inactive'`;
      }

      query += ` WHERE "userId" = $${paramCount + 1} RETURNING *;`;
      values.push(userId);

      const result = await client.query(query, values);
      
      if (result.rowCount > 0) {
        this.spinner.succeed(chalk.green('User profile reset successfully'));
        console.log(chalk.blue('  • Onboarding step:', options.step || 'pending'));
        if (options.setTrial !== undefined) {
          console.log(chalk.blue(`  • Trial set to ${options.setTrial} days`));
        }
      } else {
        this.spinner.warn(chalk.yellow('No user profile found - will be created on next login'));
      }
    } catch (error) {
      this.spinner.fail(chalk.red('Failed to reset user profile'));
      throw error;
    }
  }

  async deleteScheduledEmails(userId: string) {
    this.spinner.start('Deleting scheduled emails...');
    
    try {
      const client = await sql.connect();
      const result = await client`
        DELETE FROM "emailQueue"
        WHERE "userId" = ${userId}
        RETURNING *;
      `;
      
      this.spinner.succeed(chalk.green(`Deleted ${result.rowCount} scheduled emails`));
      
      if (result.rowCount > 0) {
        console.log(chalk.blue('  Deleted email types:'));
        result.rows.forEach(row => {
          console.log(chalk.blue(`  • ${row.emailType} (scheduled for ${new Date(row.scheduledFor).toLocaleString()})`));
        });
      }
    } catch (error) {
      this.spinner.fail(chalk.red('Failed to delete emails'));
      throw error;
    }
  }

  async handleCampaigns(userId: string, preserve: boolean) {
    this.spinner.start('Checking campaigns...');
    
    try {
      const client = await sql.connect();
      const countResult = await client`
        SELECT COUNT(*) as count FROM campaigns WHERE "userId" = ${userId};
      `;
      
      const count = parseInt(countResult.rows[0].count);
      
      if (count > 0) {
        if (preserve) {
          this.spinner.succeed(chalk.green(`Preserved ${count} campaigns`));
        } else {
          const deleteResult = await client`
            DELETE FROM campaigns WHERE "userId" = ${userId} RETURNING id;
          `;
          this.spinner.succeed(chalk.green(`Deleted ${deleteResult.rowCount} campaigns`));
        }
      } else {
        this.spinner.succeed(chalk.green('No campaigns found'));
      }
    } catch (error) {
      this.spinner.fail(chalk.red('Failed to handle campaigns'));
      throw error;
    }
  }

  async updateClerkMetadata(userId: string, user: any) {
    this.spinner.start('Updating Clerk metadata...');
    
    try {
      await clerkClient.users.updateUser(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          onboardingCompleted: false,
          trialStarted: false,
        },
      });
      this.spinner.succeed(chalk.green('Clerk metadata updated'));
    } catch (error) {
      this.spinner.warn(chalk.yellow('Could not update Clerk metadata (non-critical)'));
    }
  }

  async execute(email: string, options: ResetOptions) {
    console.log(chalk.cyan.bold('\n🔄 User Onboarding Reset Tool\n'));
    
    // Find user
    const user = await this.findUserByEmail(email);
    if (!user) return;
    
    // Confirm action if not forced
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to reset onboarding for ${chalk.yellow(email)}?`,
          default: false,
        },
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('\nReset cancelled'));
        return;
      }
    }
    
    console.log('');
    
    try {
      // Execute reset steps
      await this.resetUserProfile(user.id, options);
      await this.deleteScheduledEmails(user.id);
      
      if (!options.preserveCampaigns) {
        await this.handleCampaigns(user.id, false);
      }
      
      await this.updateClerkMetadata(user.id, user);
      
      // Success summary
      console.log(chalk.green.bold('\n✨ Reset Complete!\n'));
      console.log(chalk.cyan(`User ${email} has been reset:`));
      console.log(chalk.green('  ✓ Profile reset to:', options.step || 'pre-onboarding state'));
      console.log(chalk.green('  ✓ Scheduled emails deleted'));
      
      if (!options.preserveCampaigns) {
        console.log(chalk.green('  ✓ Campaigns deleted'));
      } else {
        console.log(chalk.blue('  ℹ Campaigns preserved'));
      }
      
      if (options.setTrial !== undefined) {
        console.log(chalk.green(`  ✓ Trial set to ${options.setTrial} days`));
      }
      
      console.log(chalk.yellow('\n📝 Next steps:'));
      console.log(chalk.blue('  1. User can sign in and continue from the reset point'));
      console.log(chalk.blue('  2. Onboarding will resume from:', options.step || 'beginning'));
      console.log(chalk.blue('  3. Email sequences will be rescheduled as needed\n'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Reset failed:'), error);
      process.exit(1);
    } finally {
      await sql.end();
    }
  }
}

// CLI setup
const program = new Command();

program
  .name('reset-user-onboarding')
  .description('Reset user onboarding for testing')
  .argument('<email>', 'User email address')
  .option('-s, --step <step>', 'Set specific onboarding step (pending, step-1, step-2, completed)')
  .option('-p, --preserve-campaigns', 'Preserve user campaigns')
  .option('-j, --preserve-jobs', 'Preserve scraping jobs')
  .option('-t, --set-trial <days>', 'Set trial to specific number of days', parseInt)
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (email, options) => {
    const reset = new UserOnboardingReset();
    await reset.execute(email, options);
  });

program.parse();