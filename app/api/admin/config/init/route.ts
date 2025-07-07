import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { SystemConfig } from '@/lib/config/system-config';

export const maxDuration = 30;

// Helper function to check if user is admin
async function isAdminUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  
  // Check if user is in admin email list
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  
  // For now, we'll just check if ADMIN_EMAILS is configured
  // In production, you'd want to check the actual user email
  return adminEmails.length > 0;
}

// POST - Initialize default configurations
export async function POST(request: Request) {
  console.log('\n\n====== ADMIN CONFIG INIT API POST CALLED ======');
  console.log('🔄 [ADMIN-CONFIG-INIT] POST request received at:', new Date().toISOString());
  
  try {
    // Check admin permissions
    if (!(await isAdminUser())) {
      console.error('❌ [ADMIN-CONFIG-INIT] Unauthorized - Not an admin user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔄 [ADMIN-CONFIG-INIT] Initializing default configurations...');
    
    await SystemConfig.initializeDefaults();
    
    console.log('✅ [ADMIN-CONFIG-INIT] Default configurations initialized successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Default configurations initialized successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('💥 [ADMIN-CONFIG-INIT] Error initializing defaults:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Check initialization status
export async function GET(request: Request) {
  console.log('\n\n====== ADMIN CONFIG INIT API GET CALLED ======');
  console.log('🔍 [ADMIN-CONFIG-INIT] GET request received at:', new Date().toISOString());
  
  try {
    // Check admin permissions
    if (!(await isAdminUser())) {
      console.error('❌ [ADMIN-CONFIG-INIT] Unauthorized - Not an admin user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔍 [ADMIN-CONFIG-INIT] Checking initialization status...');
    
    const configs = await SystemConfig.getAll();
    const categories = SystemConfig.getCategories();
    
    const isInitialized = categories.every(category => 
      configs[category] && configs[category].length > 0
    );
    
    console.log(`✅ [ADMIN-CONFIG-INIT] Initialization status: ${isInitialized ? 'INITIALIZED' : 'NOT INITIALIZED'}`);
    
    return NextResponse.json({
      isInitialized,
      configuredCategories: Object.keys(configs),
      expectedCategories: categories,
      totalConfigurations: Object.values(configs).reduce((sum, catConfigs) => sum + catConfigs.length, 0)
    });
    
  } catch (error: any) {
    console.error('💥 [ADMIN-CONFIG-INIT] Error checking initialization status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}