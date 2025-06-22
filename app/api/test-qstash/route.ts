import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  console.log('\n🧪 [TEST] QStash connectivity test endpoint called')
  console.log('📅 [TEST] Timestamp:', new Date().toISOString())
  console.log('🌐 [TEST] Request URL:', req.url)
  console.log('📋 [TEST] Request headers:', Object.fromEntries(req.headers.entries()))
  
  return NextResponse.json({
    success: true,
    message: 'QStash connectivity test successful',
    timestamp: new Date().toISOString(),
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })
}

export async function POST(req: Request) {
  console.log('\n🧪 [TEST] QStash POST test endpoint called')
  console.log('📅 [TEST] Timestamp:', new Date().toISOString())
  console.log('🌐 [TEST] Request URL:', req.url)
  
  const body = await req.text()
  console.log('📦 [TEST] Request body:', body)
  
  return NextResponse.json({
    success: true,
    message: 'QStash POST test successful',
    timestamp: new Date().toISOString(),
    receivedBody: body
  })
}