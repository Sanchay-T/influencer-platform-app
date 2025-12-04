import { structuredConsole } from '@/lib/logging/console-proxy';

/**
 * Deployment Validation Endpoint for Phase 5
 * Comprehensive pre-deployment and post-deployment validation
 */

import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { generateValidationReport, validateEnvironment } from '@/lib/config/environment-validator';
import { validateLoggingConfig } from '@/lib/config/logging-config';
import { validateMonitoringConfig } from '@/lib/config/monitoring-config';

/**
 * POST /api/validate-deployment - Run comprehensive deployment validation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	const startTime = Date.now();

	try {
		const body = await request.json().catch(() => ({}));
		const {
			type = 'pre-deployment',
			environment,
			includeReport = false,
			skipSlowChecks = false,
		} = body;

		structuredConsole.log(`🚀 [DEPLOYMENT-VALIDATION] Starting ${type} validation...`);

		// Run comprehensive validation
		const results = await runDeploymentValidation({
			type,
			environment,
			skipSlowChecks,
		});

		// Generate report if requested
		let report: string | undefined;
		if (includeReport) {
			try {
				report = await generateValidationReport();
			} catch (error) {
				structuredConsole.warn('[DEPLOYMENT-VALIDATION] Failed to generate report:', error);
			}
		}

		const response = {
			...results,
			validationDuration: Date.now() - startTime,
			timestamp: new Date().toISOString(),
			report: report || undefined,
		};

		// Log results
		if (results.deploymentReady) {
			structuredConsole.log(
				`✅ [DEPLOYMENT-VALIDATION] Deployment validation passed for ${results.environment}`
			);
		} else {
			structuredConsole.error(`❌ [DEPLOYMENT-VALIDATION] Deployment validation failed:`, {
				criticalIssues: results.criticalIssues,
				environment: results.environment,
			});

			// Send critical failures to Sentry
			Sentry.captureMessage(`Deployment validation failed for ${results.environment}`, {
				level: 'error',
				tags: {
					component: 'deployment-validation',
					environment: results.environment,
					type,
				},
				extra: {
					criticalIssues: results.criticalIssues,
					summary: results.summary,
				},
			});
		}

		return NextResponse.json(response, {
			status: results.deploymentReady ? 200 : 400,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache',
			},
		});
	} catch (error) {
		structuredConsole.error('[DEPLOYMENT-VALIDATION] Validation failed:', error);

		Sentry.captureException(error, {
			tags: {
				component: 'deployment-validation',
				endpoint: '/api/validate-deployment',
			},
		});

		return NextResponse.json(
			{
				deploymentReady: false,
				environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'unknown',
				summary: {
					totalChecks: 0,
					passed: 0,
					failed: 1,
					warnings: 0,
				},
				criticalIssues: [
					`Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				],
				recommendations: ['Check system logs and retry validation'],
				validationDuration: Date.now() - startTime,
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/validate-deployment - Get validation status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
	const searchParams = request.nextUrl.searchParams;
	const format = searchParams.get('format') || 'json';
	const environment = searchParams.get('environment');

	try {
		if (format === 'report') {
			// Return markdown report
			const report = await generateValidationReport();

			return new NextResponse(report, {
				headers: {
					'Content-Type': 'text/markdown',
					'Content-Disposition': `attachment; filename="deployment-validation-${new Date().toISOString().split('T')[0]}.md"`,
				},
			});
		}

		// Return JSON summary
		const results = await runDeploymentValidation({
			type: 'status-check',
			environment,
			skipSlowChecks: true,
		});

		return NextResponse.json({
			...results,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		structuredConsole.error('[DEPLOYMENT-VALIDATION] Status check failed:', error);

		return NextResponse.json(
			{
				deploymentReady: false,
				environment: environment || 'unknown',
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}

/**
 * Core deployment validation logic
 */
interface ValidationOptions {
	type: 'pre-deployment' | 'post-deployment' | 'status-check';
	environment?: string;
	skipSlowChecks: boolean;
}

interface DeploymentValidationResult {
	deploymentReady: boolean;
	environment: string;
	summary: {
		totalChecks: number;
		passed: number;
		failed: number;
		warnings: number;
	};
	criticalIssues: string[];
	warnings: string[];
	recommendations: string[];
	categories: {
		environment: ValidationCategoryResult;
		logging: ValidationCategoryResult;
		monitoring: ValidationCategoryResult;
		security: ValidationCategoryResult;
		performance: ValidationCategoryResult;
	};
}

interface ValidationCategoryResult {
	status: 'pass' | 'fail' | 'warn';
	message: string;
	details?: any;
}

async function runDeploymentValidation(
	options: ValidationOptions
): Promise<DeploymentValidationResult> {
	const { type, environment, skipSlowChecks } = options;

	structuredConsole.log(
		`🔍 [DEPLOYMENT-VALIDATION] Running ${type} validation (skipSlow: ${skipSlowChecks})`
	);

	const criticalIssues: string[] = [];
	const warnings: string[] = [];
	const recommendations: string[] = [];

	// 1. Environment Validation
	const environmentResult = await validateEnvironmentCategory(environment, skipSlowChecks);
	if (environmentResult.status === 'fail') {
		criticalIssues.push(...(environmentResult.details?.errors || [environmentResult.message]));
	}
	if (environmentResult.details?.warnings) {
		warnings.push(...environmentResult.details.warnings);
	}
	if (environmentResult.details?.recommendations) {
		recommendations.push(...environmentResult.details.recommendations);
	}

	// 2. Logging Configuration Validation
	const loggingResult = await validateLoggingCategory();
	if (loggingResult.status === 'fail') {
		criticalIssues.push(loggingResult.message);
	} else if (loggingResult.status === 'warn') {
		warnings.push(loggingResult.message);
	}

	// 3. Monitoring Configuration Validation
	const monitoringResult = await validateMonitoringCategory();
	if (monitoringResult.status === 'fail') {
		criticalIssues.push(monitoringResult.message);
	} else if (monitoringResult.status === 'warn') {
		warnings.push(monitoringResult.message);
	}

	// 4. Security Validation
	const securityResult = await validateSecurityCategory(environment);
	if (securityResult.status === 'fail') {
		criticalIssues.push(securityResult.message);
	} else if (securityResult.status === 'warn') {
		warnings.push(securityResult.message);
	}

	// 5. Performance Validation
	const performanceResult = await validatePerformanceCategory();
	if (performanceResult.status === 'fail') {
		criticalIssues.push(performanceResult.message);
	} else if (performanceResult.status === 'warn') {
		warnings.push(performanceResult.message);
	}

	// Calculate summary
	const categories = {
		environment: environmentResult,
		logging: loggingResult,
		monitoring: monitoringResult,
		security: securityResult,
		performance: performanceResult,
	};

	const totalChecks = Object.keys(categories).length;
	const passed = Object.values(categories).filter((c) => c.status === 'pass').length;
	const failed = Object.values(categories).filter((c) => c.status === 'fail').length;
	const warningCount = Object.values(categories).filter((c) => c.status === 'warn').length;

	const deploymentReady = failed === 0; // No critical failures

	return {
		deploymentReady,
		environment: environment || getCurrentEnvironment(),
		summary: {
			totalChecks,
			passed,
			failed,
			warnings: warningCount,
		},
		criticalIssues,
		warnings,
		recommendations,
		categories,
	};
}

/**
 * Validate environment configuration
 */
async function validateEnvironmentCategory(
	targetEnv?: string,
	skipSlow = false
): Promise<ValidationCategoryResult> {
	try {
		if (skipSlow) {
			// Quick environment checks only
			const currentEnv = getCurrentEnvironment();
			const nodeEnv = process.env.NODE_ENV;

			if (currentEnv === 'production' && nodeEnv !== 'production') {
				return {
					status: 'fail',
					message: 'NODE_ENV mismatch in production environment',
					details: { currentEnv, nodeEnv },
				};
			}

			return {
				status: 'pass',
				message: `Environment configuration appears valid (${currentEnv})`,
				details: { environment: currentEnv, quickCheck: true },
			};
		}

		// Full environment validation
		const validation = await validateEnvironment();

		return {
			status: validation.valid ? 'pass' : validation.errors.length > 0 ? 'fail' : 'warn',
			message: validation.valid
				? 'Environment validation passed'
				: `Environment validation found ${validation.errors.length} errors, ${validation.warnings.length} warnings`,
			details: {
				environment: validation.environment,
				errors: validation.errors,
				warnings: validation.warnings,
				recommendations: validation.recommendations,
				totalChecks: validation.checks.length,
			},
		};
	} catch (error) {
		return {
			status: 'fail',
			message: 'Environment validation failed',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		};
	}
}

/**
 * Validate logging configuration
 */
async function validateLoggingCategory(): Promise<ValidationCategoryResult> {
	try {
		const validation = await validateLoggingConfig();

		return {
			status: validation.valid ? 'pass' : 'fail',
			message: validation.valid
				? 'Logging configuration is valid'
				: `Logging configuration errors: ${validation.errors.length}`,
			details:
				validation.errors.length > 0
					? {
							errors: validation.errors,
						}
					: undefined,
		};
	} catch (error) {
		return {
			status: 'fail',
			message: 'Logging configuration validation failed',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		};
	}
}

/**
 * Validate monitoring configuration
 */
async function validateMonitoringCategory(): Promise<ValidationCategoryResult> {
	try {
		const validation = await validateMonitoringConfig();

		return {
			status: validation.valid ? 'pass' : 'warn', // Monitoring issues are warnings, not critical
			message: validation.valid
				? 'Monitoring configuration is valid'
				: `Monitoring configuration issues: ${validation.errors.length}`,
			details:
				validation.errors.length > 0
					? {
							errors: validation.errors,
						}
					: undefined,
		};
	} catch (error) {
		return {
			status: 'warn',
			message: 'Monitoring configuration validation failed',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		};
	}
}

/**
 * Validate security configuration
 */
async function validateSecurityCategory(targetEnv?: string): Promise<ValidationCategoryResult> {
	const environment = targetEnv || getCurrentEnvironment();
	const issues: string[] = [];

	// Check HTTPS in production
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
	if (environment === 'production' && siteUrl && !siteUrl.startsWith('https://')) {
		issues.push('Production site URL should use HTTPS');
	}

	// Check for development settings in production
	if (environment === 'production') {
		if (process.env.ENABLE_TEST_AUTH === 'true') {
			issues.push('Test authentication enabled in production');
		}

		if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
			issues.push('Development mode enabled in production');
		}
	}

	// Check admin configuration
	const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
	if (!adminEmails && environment !== 'test') {
		issues.push('Admin emails not configured');
	}

	return {
		status: issues.length > 0 ? 'fail' : 'pass',
		message:
			issues.length > 0
				? `Security validation found ${issues.length} issues`
				: 'Security configuration is valid',
		details: issues.length > 0 ? { issues } : undefined,
	};
}

/**
 * Validate performance configuration
 */
async function validatePerformanceCategory(): Promise<ValidationCategoryResult> {
	const warnings: string[] = [];

	// Check memory usage
	const memoryUsage = process.memoryUsage();
	const rssInMB = memoryUsage.rss / 1024 / 1024;

	if (rssInMB > 200) {
		warnings.push(`High memory usage: ${rssInMB.toFixed(1)}MB RSS`);
	}

	// Check target results setting
	const targetResults = process.env.TEST_TARGET_RESULTS;
	if (targetResults && parseInt(targetResults, 10) > 100) {
		warnings.push(`High target results setting: ${targetResults}`);
	}

	// Check database connection pooling
	const dbUrl = process.env.DATABASE_URL;
	if (dbUrl && getCurrentEnvironment() === 'production' && !dbUrl.includes('pooler.supabase.com')) {
		warnings.push('Database connection pooling not detected');
	}

	return {
		status: warnings.length > 0 ? 'warn' : 'pass',
		message:
			warnings.length > 0
				? `Performance validation found ${warnings.length} warnings`
				: 'Performance configuration is optimal',
		details:
			warnings.length > 0
				? {
						warnings,
						memory: {
							rss: rssInMB,
							heapUsed: memoryUsage.heapUsed / 1024 / 1024,
						},
					}
				: undefined,
	};
}

/**
 * Get current environment
 */
function getCurrentEnvironment(): string {
	const sentryEnv = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
	if (sentryEnv && sentryEnv !== 'development') {
		return sentryEnv;
	}

	if (process.env.NODE_ENV === 'production') {
		if (
			process.env.VERCEL_ENV === 'preview' ||
			process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')
		) {
			return 'staging';
		}
		return 'production';
	}

	if (process.env.NODE_ENV === 'test') {
		return 'test';
	}

	return 'development';
}
