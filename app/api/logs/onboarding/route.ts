import { NextRequest, NextResponse } from 'next/server';
import OnboardingLogger from '@/lib/utils/onboarding-logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // Normalize payload to expected shape
    const { step = 'UNKNOWN', action = 'CLIENT', description = 'Client log', userId, data, sessionId } = body || {};
    await OnboardingLogger.log({ step, action, description, userId, data, sessionId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ [ONBOARDING-LOGS] POST failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to write log' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const linesParam = Number(searchParams.get('lines') || '50');
    const lines = await OnboardingLogger.getRecentLogs(isNaN(linesParam) ? 50 : linesParam);
    return NextResponse.json({ lines });
  } catch (err) {
    console.error('❌ [ONBOARDING-LOGS] GET failed:', err);
    return NextResponse.json({ lines: [] }, { status: 200 });
  }
}

export async function DELETE() {
  try {
    await OnboardingLogger.clearLogs();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ [ONBOARDING-LOGS] DELETE failed:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

