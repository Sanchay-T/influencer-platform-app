import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }
    
    console.log('🧪 [TEST] Manually triggering job processing for:', jobId);
    
    // Call the QStash processing endpoint directly
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/qstash/process-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': 'localhost:3000' // Bypass ngrok host checking
      },
      body: JSON.stringify({ jobId })
    });
    
    const result = await response.json();
    
    console.log('🧪 [TEST] Job processing result:', result);
    
    return NextResponse.json({
      success: true,
      jobId,
      result,
      status: response.status
    });
    
  } catch (error: any) {
    console.error('🧪 [TEST] Error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
}