import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { isAdminUser, getCurrentUserAdminInfo } from '@/lib/auth/admin-utils';

export async function POST(req: NextRequest) {
  try {
    // Critical: Check if user is admin
    if (!(await isAdminUser())) {
      console.error('❌ [ADMIN-EMAIL] Unauthorized - Not an admin user');
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      userId: targetUserId, 
      emailType, 
      delay, 
      userEmail, 
      templateProps 
    } = body;

    // Validation
    if (!targetUserId || !emailType || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, emailType, userEmail' },
        { status: 400 }
      );
    }

    // Get current admin user info for logging
    const { user: adminUser } = await getCurrentUserAdminInfo();
    
    console.log('🚀 [ADMIN-EMAIL] Scheduling admin test email:', {
      targetUserId,
      emailType,
      delay: delay || '30s',
      userEmail,
      adminUserId: adminUser?.id,
      adminEmail: adminUser?.email
    });

    // Initialize QStash client
    const qstash = new Client({
      token: process.env.QSTASH_TOKEN!,
    });

    // Prepare email payload
    const emailPayload = {
      userId: targetUserId,
      emailType,
      userEmail,
      templateProps: {
        fullName: templateProps?.fullName || 'Admin Test User',
        businessName: templateProps?.businessName || 'Test Business',
        dashboardUrl: templateProps?.dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/campaigns`,
        ...templateProps
      },
      source: 'admin-testing',
      adminUserId: adminUser?.id,
      timestamp: new Date().toISOString()
    };

    // Schedule the email with QStash
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send-scheduled`;
    
    const response = await qstash.publishJSON({
      url: callbackUrl,
      body: emailPayload,
      delay: delay || '30s'
    });

    console.log('✅ [ADMIN-EMAIL] Email scheduled successfully:', {
      messageId: response.messageId,
      emailType,
      targetUser: userEmail,
      delay: delay || '30s'
    });

    return NextResponse.json({
      success: true,
      messageId: response.messageId,
      emailType,
      delay: delay || '30s',
      targetUserId,
      targetEmail: userEmail,
      scheduledAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN-EMAIL] Error scheduling email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to schedule email', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}