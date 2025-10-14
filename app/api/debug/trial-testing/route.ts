import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { updateUserProfile } from '@/lib/db/queries/user-queries';
import { getTrialStatus } from '@/lib/trial/trial-service';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthOrTest();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, testDate } = await req.json();
    
    console.log('🧪 [TRIAL-TESTING] Action:', action, 'Test Date:', testDate);

    switch (action) {
      case 'set_trial_near_expiry':
        // Set trial to expire in 1 hour
        const nearExpiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
        
        await updateUserProfile(userId, {
          trialStartDate: startDate,
          trialEndDate: nearExpiryDate,
          trialStatus: 'active',
          subscriptionStatus: 'trialing'
        });
          
        console.log('🧪 [TRIAL-TESTING] Set trial to expire in 1 hour');
        break;

      case 'set_trial_expired':
        // Set trial as expired (1 hour ago)
        const expiredDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const expiredStartDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
        
        await updateUserProfile(userId, {
          trialStartDate: expiredStartDate,
          trialEndDate: expiredDate,
          trialStatus: 'expired',
          subscriptionStatus: 'canceled'
        });
          
        console.log('🧪 [TRIAL-TESTING] Set trial as expired 1 hour ago');
        break;

      case 'simulate_day':
        // Simulate specific day (0-7)
        const day = parseInt(testDate) || 3;
        const simulatedStart = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
        const simulatedEnd = new Date(simulatedStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        await updateUserProfile(userId, {
          trialStartDate: simulatedStart,
          trialEndDate: simulatedEnd,
          trialStatus: 'active',
          subscriptionStatus: 'trialing'
        });
          
        console.log(`🧪 [TRIAL-TESTING] Simulated day ${day} of trial`);
        break;

      case 'reset_trial':
        // Reset to fresh 7-day trial
        const resetStart = new Date();
        const resetEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        await updateUserProfile(userId, {
          trialStartDate: resetStart,
          trialEndDate: resetEnd,
          trialStatus: 'active',
          subscriptionStatus: 'trialing'
        });
          
        console.log('🧪 [TRIAL-TESTING] Reset to fresh 7-day trial');
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get updated trial status
    const updatedTrialStatus = await getTrialStatus(userId);
    
    return NextResponse.json({
      success: true,
      action,
      trialStatus: updatedTrialStatus,
      message: `Trial testing action '${action}' completed successfully`,
      debug: {
        now: new Date().toISOString(),
        trialStart: updatedTrialStatus?.trialStartDate?.toISOString(),
        trialEnd: updatedTrialStatus?.trialEndDate?.toISOString(),
        daysRemaining: updatedTrialStatus?.daysRemaining,
        progressPercentage: updatedTrialStatus?.progressPercentage,
        isExpired: updatedTrialStatus?.isExpired
      }
    });

  } catch (error) {
    console.error('❌ [TRIAL-TESTING] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute trial testing action' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getAuthOrTest();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current trial status for debugging
    const trialStatus = await getTrialStatus(userId);
    
    return NextResponse.json({
      currentTrialStatus: trialStatus,
      testingOptions: [
        {
          action: 'set_trial_near_expiry',
          description: 'Set trial to expire in 1 hour (test urgency UI)',
        },
        {
          action: 'set_trial_expired', 
          description: 'Set trial as expired (test expired state)',
        },
        {
          action: 'simulate_day',
          description: 'Simulate specific day of trial (0-7)',
          parameter: 'testDate (day number)'
        },
        {
          action: 'reset_trial',
          description: 'Reset to fresh 7-day trial',
        }
      ]
    });

  } catch (error) {
    console.error('❌ [TRIAL-TESTING] Error getting status:', error);
    return NextResponse.json(
      { error: 'Failed to get trial testing status' },
      { status: 500 }
    );
  }
}