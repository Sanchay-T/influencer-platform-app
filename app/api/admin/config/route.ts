import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';
import { SystemConfig } from '@/lib/config/system-config';
import { isAdminUser } from '@/lib/auth/admin-utils';

export const maxDuration = 30;

// GET - Retrieve all configurations
export async function GET(request: Request) {
  structuredConsole.log('\n\n====== ADMIN CONFIG API GET CALLED ======');
  structuredConsole.log('🔍 [ADMIN-CONFIG] GET request received at:', new Date().toISOString());
  
  try {
    // Check admin permissions
    if (!(await isAdminUser())) {
      structuredConsole.error('❌ [ADMIN-CONFIG] Unauthorized - Not an admin user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const key = url.searchParams.get('key');
    
    if (category && key) {
      // Get specific configuration
      structuredConsole.log(`🔍 [ADMIN-CONFIG] Getting specific config: ${category}.${key}`);
      const value = await SystemConfig.get(category, key);
      return NextResponse.json({ category, key, value });
    } else {
      // Get all configurations
      structuredConsole.log('🔍 [ADMIN-CONFIG] Getting all configurations');
      const configs = await SystemConfig.getAll();
      const categories = SystemConfig.getCategories();
      
      structuredConsole.log(`✅ [ADMIN-CONFIG] Retrieved ${Object.keys(configs).length} configuration categories`);
      
      return NextResponse.json({
        configurations: configs,
        categories,
        totalCount: Object.values(configs).reduce((sum, catConfigs) => sum + catConfigs.length, 0)
      });
    }
  } catch (error: any) {
    structuredConsole.error('💥 [ADMIN-CONFIG] Error in GET:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update configuration
export async function POST(request: Request) {
  structuredConsole.log('\n\n====== ADMIN CONFIG API POST CALLED ======');
  structuredConsole.log('📝 [ADMIN-CONFIG] POST request received at:', new Date().toISOString());
  
  try {
    // Check admin permissions
    if (!(await isAdminUser())) {
      structuredConsole.error('❌ [ADMIN-CONFIG] Unauthorized - Not an admin user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { category, key, value, valueType, description } = body;
    
    structuredConsole.log('📥 [ADMIN-CONFIG] Configuration data received:', {
      category,
      key,
      value,
      valueType,
      description
    });
    
    // Validate required fields
    if (!category || !key || !value || !valueType) {
      structuredConsole.error('❌ [ADMIN-CONFIG] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: category, key, value, valueType' },
        { status: 400 }
      );
    }
    
    // Update configuration
    await SystemConfig.set(category, key, value, valueType, description);
    
    // Clear cache to ensure immediate effect
    SystemConfig.clearCache();
    
    structuredConsole.log(`✅ [ADMIN-CONFIG] Configuration updated: ${category}.${key} = ${value}`);
    
    return NextResponse.json({
      success: true,
      message: `Configuration ${category}.${key} updated successfully`,
      category,
      key,
      value
    });
    
  } catch (error: any) {
    structuredConsole.error('💥 [ADMIN-CONFIG] Error in POST:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Bulk update configurations
export async function PUT(request: Request) {
  structuredConsole.log('\n\n====== ADMIN CONFIG API PUT CALLED ======');
  structuredConsole.log('🔄 [ADMIN-CONFIG] PUT request received at:', new Date().toISOString());
  
  try {
    // Check admin permissions
    if (!(await isAdminUser())) {
      structuredConsole.error('❌ [ADMIN-CONFIG] Unauthorized - Not an admin user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { configurations } = body;
    
    if (!Array.isArray(configurations)) {
      structuredConsole.error('❌ [ADMIN-CONFIG] Invalid configurations format');
      return NextResponse.json(
        { error: 'Configurations must be an array' },
        { status: 400 }
      );
    }
    
    structuredConsole.log(`🔄 [ADMIN-CONFIG] Bulk updating ${configurations.length} configurations`);
    
    // Process each configuration
    const results = [];
    for (const config of configurations) {
      try {
        await SystemConfig.set(
          config.category,
          config.key,
          config.value,
          config.valueType,
          config.description
        );
        results.push({ success: true, key: `${config.category}.${config.key}` });
      } catch (error: any) {
        structuredConsole.error(`❌ [ADMIN-CONFIG] Error updating ${config.category}.${config.key}:`, error);
        results.push({ 
          success: false, 
          key: `${config.category}.${config.key}`, 
          error: error.message 
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    // Clear cache after bulk updates
    if (successCount > 0) {
      SystemConfig.clearCache();
    }
    
    structuredConsole.log(`✅ [ADMIN-CONFIG] Bulk update completed: ${successCount}/${configurations.length} successful`);
    
    return NextResponse.json({
      success: true,
      message: `Bulk update completed: ${successCount}/${configurations.length} configurations updated`,
      results
    });
    
  } catch (error: any) {
    structuredConsole.error('💥 [ADMIN-CONFIG] Error in PUT:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete configuration
export async function DELETE(request: Request) {
  structuredConsole.log('\n\n====== ADMIN CONFIG API DELETE CALLED ======');
  structuredConsole.log('🗑️ [ADMIN-CONFIG] DELETE request received at:', new Date().toISOString());
  
  try {
    // Check admin permissions
    if (!(await isAdminUser())) {
      structuredConsole.error('❌ [ADMIN-CONFIG] Unauthorized - Not an admin user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const key = url.searchParams.get('key');
    
    if (!category || !key) {
      structuredConsole.error('❌ [ADMIN-CONFIG] Missing category or key parameters');
      return NextResponse.json(
        { error: 'Missing required parameters: category, key' },
        { status: 400 }
      );
    }
    
    structuredConsole.log(`🗑️ [ADMIN-CONFIG] Deleting configuration: ${category}.${key}`);
    
    await SystemConfig.delete(category, key);
    
    structuredConsole.log(`✅ [ADMIN-CONFIG] Configuration deleted: ${category}.${key}`);
    
    return NextResponse.json({
      success: true,
      message: `Configuration ${category}.${key} deleted successfully (will fall back to default)`,
      category,
      key
    });
    
  } catch (error: any) {
    structuredConsole.error('💥 [ADMIN-CONFIG] Error in DELETE:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}