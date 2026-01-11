import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { SystemConfig } from '@/lib/config/system-config';
import { structuredConsole } from '@/lib/logging/console-proxy';

export const maxDuration = 30;

// POST - Initialize default configurations
export async function POST(request: Request) {
	structuredConsole.log('\n\n====== ADMIN CONFIG INIT API POST CALLED ======');
	structuredConsole.log(
		'🔄 [ADMIN-CONFIG-INIT] POST request received at:',
		new Date().toISOString()
	);

	try {
		// Check admin permissions
		if (!(await isAdminUser())) {
			structuredConsole.error('❌ [ADMIN-CONFIG-INIT] Unauthorized - Not an admin user');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		structuredConsole.log('🔄 [ADMIN-CONFIG-INIT] Initializing default configurations...');

		await SystemConfig.initializeDefaults();

		structuredConsole.log('✅ [ADMIN-CONFIG-INIT] Default configurations initialized successfully');

		return NextResponse.json({
			success: true,
			message: 'Default configurations initialized successfully',
			timestamp: new Date().toISOString(),
		});
	} catch (error: unknown) {
		structuredConsole.error('💥 [ADMIN-CONFIG-INIT] Error initializing defaults:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{ error: 'Internal Server Error', details: errorMessage },
			{ status: 500 }
		);
	}
}

// GET - Check initialization status
export async function GET(request: Request) {
	structuredConsole.log('\n\n====== ADMIN CONFIG INIT API GET CALLED ======');
	structuredConsole.log(
		'🔍 [ADMIN-CONFIG-INIT] GET request received at:',
		new Date().toISOString()
	);

	try {
		// Check admin permissions
		if (!(await isAdminUser())) {
			structuredConsole.error('❌ [ADMIN-CONFIG-INIT] Unauthorized - Not an admin user');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		structuredConsole.log('🔍 [ADMIN-CONFIG-INIT] Checking initialization status...');

		const configs = await SystemConfig.getAll();
		const categories = SystemConfig.getCategories();

		const isInitialized = categories.every(
			(category) => configs[category] && configs[category].length > 0
		);

		structuredConsole.log(
			`✅ [ADMIN-CONFIG-INIT] Initialization status: ${isInitialized ? 'INITIALIZED' : 'NOT INITIALIZED'}`
		);

		return NextResponse.json({
			isInitialized,
			configuredCategories: Object.keys(configs),
			expectedCategories: categories,
			totalConfigurations: Object.values(configs).reduce(
				(sum, catConfigs) => sum + catConfigs.length,
				0
			),
		});
	} catch (error: unknown) {
		structuredConsole.error('💥 [ADMIN-CONFIG-INIT] Error checking initialization status:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{ error: 'Internal Server Error', details: errorMessage },
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
