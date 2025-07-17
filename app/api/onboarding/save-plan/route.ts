import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { selectedPlan } = await req.json();

    if (!selectedPlan) {
      return NextResponse.json({ error: 'Selected plan is required' }, { status: 400 });
    }

    // Update user profile with selected plan
    await db.update(userProfiles)
      .set({
        currentPlan: selectedPlan,
        billingSyncStatus: 'plan_selected',
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ [SAVE-PLAN] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save plan selection' },
      { status: 500 }
    );
  }
}