import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Test various logging methods
  console.log('\n\n====== TEST LOGGING API CALLED ======');
  console.log('Standard console.log test at', new Date().toISOString());
  console.warn('Console warn test');
  console.error('Console error test');
  
  // Test process.stdout directly
  process.stdout.write('Direct stdout write test\n');
  process.stderr.write('Direct stderr write test\n');
  
  // Test JSON logging
  console.log(JSON.stringify({
    message: 'JSON log test',
    timestamp: new Date().toISOString()
  }));
  
  return NextResponse.json({ status: 'Logging test executed' });
} 