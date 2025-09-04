interface OnboardingLogEntry {
  timestamp: string;
  step: string;
  action: string;
  description: string;
  userId?: string;
  data?: any;
  sessionId?: string;
}

export class OnboardingLogger {
  // Note: Do NOT compute file paths or import Node modules at top level,
  // as this file is used in both server and client contexts.
  
  /**
   * Formats the current timestamp for logging
   */
  private static getTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
  }

  /**
   * Generates a unique session ID for tracking user journeys
   */
  public static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Main logging function - writes to file with error handling
   */
  public static async log(entry: Omit<OnboardingLogEntry, 'timestamp'>): Promise<void> {
    const timestamp = this.getTimestamp();
    const logEntry: OnboardingLogEntry = { timestamp, ...entry };
    const logLine = this.formatLogLine(logEntry);

    // If we're in the browser, POST to the server API to persist logs
    if (typeof window !== 'undefined') {
      try {
        navigator.sendBeacon?.('/api/logs/onboarding', new Blob([JSON.stringify(logEntry)], { type: 'application/json' }));
        // Fallback to fetch if sendBeacon isn't available
        if (!navigator.sendBeacon) {
          await fetch('/api/logs/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logEntry)
          });
        }
      } catch (clientErr) {
        // Swallow client logging errors; still print to console
        console.warn('⚠️ [ONBOARDING-LOG] Client log POST failed:', clientErr);
      } finally {
        console.log(`📝 [ONBOARDING-LOG] ${logLine}`);
      }
      return;
    }

    // Server-side: append directly to file using dynamic imports
    try {
      const { promises: fs } = await import('fs');
      const logFilePath = `${process.cwd()}/onboarding-logs`;
      await fs.appendFile(logFilePath, logLine + '\n', 'utf8');
      console.log(`📝 [ONBOARDING-LOG] ${logLine}`);
    } catch (error) {
      console.error('❌ [ONBOARDING-LOG] Failed to write to log file:', error);
      console.log(`📝 [ONBOARDING-LOG-FALLBACK] [${this.getTimestamp()}] [${entry.step}] [${entry.action}] - ${entry.description}`);
    }
  }

  /**
   * Formats the log entry into a readable line
   */
  private static formatLogLine(entry: OnboardingLogEntry): string {
    let logLine = `[${entry.timestamp}] [${entry.step}] [${entry.action}] - ${entry.description}`;
    
    if (entry.userId) {
      logLine += ` | UserId: ${entry.userId}`;
    }
    
    if (entry.sessionId) {
      logLine += ` | SessionId: ${entry.sessionId}`;
    }
    
    if (entry.data && Object.keys(entry.data).length > 0) {
      logLine += ` | Data: ${JSON.stringify(entry.data)}`;
    }
    
    return logLine;
  }

  /**
   * Convenience methods for different log types
   */
  
  // Step 1: User Input
  public static async logStep1(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'STEP-1', action, description, userId, data, sessionId });
  }

  // Step 2: Brand Description
  public static async logStep2(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'STEP-2', action, description, userId, data, sessionId });
  }

  // Step 3: Plan Selection & Payment
  public static async logStep3(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'STEP-3', action, description, userId, data, sessionId });
  }

  // Step 4: Completion
  public static async logStep4(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'STEP-4', action, description, userId, data, sessionId });
  }

  // API Calls
  public static async logAPI(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'API', action, description, userId, data, sessionId });
  }

  // Navigation
  public static async logNavigation(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'NAVIGATION', action, description, userId, data, sessionId });
  }

  // Errors
  public static async logError(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'ERROR', action, description, userId, data, sessionId });
  }

  // Stripe/Payment
  public static async logPayment(action: string, description: string, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ step: 'PAYMENT', action, description, userId, data, sessionId });
  }

  /**
   * Utility method to log modal lifecycle events
   */
  public static async logModalEvent(event: 'OPEN' | 'CLOSE' | 'STEP_CHANGE', step: number, userId?: string, data?: any, sessionId?: string): Promise<void> {
    await this.log({ 
      step: 'MODAL', 
      action: event, 
      description: event === 'STEP_CHANGE' ? `Modal moved to step ${step}` : `Modal ${event.toLowerCase()}ed`,
      userId, 
      data: { ...data, currentStep: step }, 
      sessionId 
    });
  }

  /**
   * Utility method to log form submissions
   */
  public static async logFormSubmission(step: number, success: boolean, userId?: string, data?: any, sessionId?: string): Promise<void> {
    const action = success ? 'FORM-SUCCESS' : 'FORM-ERROR';
    const description = `Step ${step} form ${success ? 'submitted successfully' : 'submission failed'}`;
    await this.log({ step: `STEP-${step}`, action, description, userId, data, sessionId });
  }

  /**
   * Utility method to log user input changes
   */
  public static async logUserInput(step: number, fieldName: string, value: any, userId?: string, sessionId?: string): Promise<void> {
    const data = { fieldName, value: typeof value === 'string' ? value.substring(0, 100) + '...' : value };
    await this.log({ 
      step: `STEP-${step}`, 
      action: 'USER-INPUT', 
      description: `User entered data in field: ${fieldName}`,
      userId, 
      data, 
      sessionId 
    });
  }

  /**
   * Read recent logs (for debugging)
   */
  public static async getRecentLogs(lines: number = 50): Promise<string[]> {
    // Client: fetch from API; Server: read from file
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/logs/onboarding?lines=${lines}`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.lines) ? data.lines : [];
      } catch {
        return [];
      }
    }
    try {
      const { promises: fs } = await import('fs');
      const logFilePath = `${process.cwd()}/onboarding-logs`;
      const content = await fs.readFile(logFilePath, 'utf8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines);
    } catch (error) {
      console.error('❌ [ONBOARDING-LOG] Failed to read log file:', error);
      return [];
    }
  }

  /**
   * Clear logs (for development/testing)
   */
  public static async clearLogs(): Promise<void> {
    if (typeof window !== 'undefined') {
      try { await fetch('/api/logs/onboarding', { method: 'DELETE' }); } catch {}
      return;
    }
    try {
      const { promises: fs } = await import('fs');
      const logFilePath = `${process.cwd()}/onboarding-logs`;
      await fs.writeFile(logFilePath, '', 'utf8');
      console.log('✅ [ONBOARDING-LOG] Logs cleared successfully');
    } catch (error) {
      console.error('❌ [ONBOARDING-LOG] Failed to clear logs:', error);
    }
  }
}

// Export default for convenience
export default OnboardingLogger;
