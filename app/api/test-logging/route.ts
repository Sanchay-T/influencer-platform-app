import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Test various logging methods
  structuredConsole.log('\n\n====== TEST LOGGING API CALLED ======');
  structuredConsole.log('Standard structuredConsole.log test at', new Date().toISOString());
  structuredConsole.warn('Console warn test');
  structuredConsole.error('Console error test');
  
  // Test process.stdout directly
  process.stdout.write('Direct stdout write test\n');
  process.stderr.write('Direct stderr write test\n');
  
  // Test JSON logging
  structuredConsole.log(JSON.stringify({
    message: 'JSON log test',
    timestamp: new Date().toISOString()
  }));
  
  return NextResponse.json({ status: 'Logging test executed' });
} 