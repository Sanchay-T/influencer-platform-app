import { structuredConsole } from '@/lib/logging/console-proxy';
import { getLoggingConfig, validateLoggingConfig } from './logging-config';
import { validateMonitoringConfig } from './monitoring-config';
import SystemConfig from './system-config';

/**
 * Environment validation result
 */
export interface ValidationResult {
  valid: boolean;
  environment: string;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  checks: ValidationCheck[];
}

/**
 * Individual validation check result
 */
export interface ValidationCheck {
  name: string;
  category: 'environment' | 'logging' | 'monitoring' | 'security' | 'performance';
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
  recommendation?: string;
}

/**
 * Simple environment validator
 */
export class EnvironmentValidator {
  private environment: string;
  private checks: ValidationCheck[] = [];
  private errors: string[] = [];
  private warnings: string[] = [];
  private recommendations: string[] = [];
  
  constructor() {
    this.environment = this.getCurrentEnvironment();
  }
  
  async validate(): Promise<ValidationResult> {
    structuredConsole.log(`🔍 [ENV-VALIDATOR] Starting validation for environment: ${this.environment}`);
    
    // Reset state
    this.checks = [];
    this.errors = [];
    this.warnings = [];
    this.recommendations = [];
    
    // Run basic validation checks
    await this.validateBasicEnvironment();
    
    const result: ValidationResult = {
      valid: this.errors.length === 0,
      environment: this.environment,
      errors: this.errors,
      warnings: this.warnings,
      recommendations: this.recommendations,
      checks: this.checks
    };
    
    structuredConsole.log(`✅ [ENV-VALIDATOR] Validation complete. Status: ${result.valid ? 'PASS' : 'FAIL'}`);
    
    return result;
  }
  
  private async validateBasicEnvironment(): Promise<void> {
    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv) {
      this.addCheck({
        name: 'NODE_ENV',
        category: 'environment',
        status: 'pass',
        message: `NODE_ENV is set to: ${nodeEnv}`
      });
    } else {
      this.addCheck({
        name: 'NODE_ENV',
        category: 'environment',
        status: 'warn',
        message: 'NODE_ENV is not set',
        recommendation: 'Set NODE_ENV to development, production, or test'
      });
    }
  }
  
  private addCheck(check: ValidationCheck): void {
    this.checks.push(check);
    
    if (check.status === 'fail') {
      this.errors.push(check.message);
      if (check.recommendation) {
        this.recommendations.push(check.recommendation);
      }
    } else if (check.status === 'warn') {
      this.warnings.push(check.message);
    }
  }
  
  private getCurrentEnvironment(): string {
    const sentryEnv = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
    if (sentryEnv && sentryEnv !== 'development') {
      return sentryEnv;
    }
    
    if (process.env.NODE_ENV === 'production') {
      return 'production';
    }
    
    if (process.env.NODE_ENV === 'test') {
      return 'test';
    }
    
    return 'development';
  }
  
  static async generateReport(): Promise<string> {
    const validator = new EnvironmentValidator();
    const result = await validator.validate();
    
    const report = [
      `# Environment Validation Report`,
      ``,
      `**Environment:** ${result.environment}`,
      `**Status:** ${result.valid ? '✅ PASS' : '❌ FAIL'}`,
      `**Timestamp:** ${new Date().toISOString()}`,
      ``,
      `## Summary`,
      ``,
      `- **Total Checks:** ${result.checks.length}`,
      `- **Passed:** ${result.checks.filter(c => c.status === 'pass').length}`,
      `- **Failed:** ${result.checks.filter(c => c.status === 'fail').length}`,
      `- **Warnings:** ${result.checks.filter(c => c.status === 'warn').length}`,
      ``
    ];
    
    return report.join('\n');
  }
}

// Export convenience functions
export const validateEnvironment = () => new EnvironmentValidator().validate();
export const generateValidationReport = () => EnvironmentValidator.generateReport();

export default EnvironmentValidator;