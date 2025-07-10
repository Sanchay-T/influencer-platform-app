import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Find or create user profile
    const existing = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (existing) {
      await db.update(userProfiles)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId));
    } else {
      await db.insert(userProfiles).values({
        userId,
        isAdmin: true,
        onboardingStep: 'pending'
      });
    }

    return NextResponse.json({ success: true, message: 'User promoted to admin' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to promote user' }, { status: 500 });
  }
}