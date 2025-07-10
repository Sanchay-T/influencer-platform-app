/**
 * Frontend logging utility for comprehensive user flow tracking
 * This provides "insane logging" for production signup flows
 */

interface LogContext {
  userId?: string;
  userEmail?: string;
  step?: string;
  action?: string;
  data?: any;
  timing?: number;
  requestId?: string;
}

interface ApiCallOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export class FrontendLogger {
  private static sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  private static startTime = Date.now();

  /**
   * Log major step headers with visual separators
   */
  static logStepHeader(step: string, description: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const sessionTime = Date.now() - this.startTime;
    
    console.log('🚀🚀🚀 [FRONTEND] ===============================');
    console.log(`🚀🚀🚀 [FRONTEND] ${step.toUpperCase()}: ${description.toUpperCase()}`);
    console.log('🚀🚀🚀 [FRONTEND] ===============================');
    console.log(`📅 [FRONTEND] Timestamp: ${timestamp}`);
    console.log(`⏱️ [FRONTEND] Session time: ${sessionTime}ms`);
    console.log(`🆔 [FRONTEND] Session ID: ${this.sessionId}`);
    
    if (context) {
      console.log(`📊 [FRONTEND] Context:`, {
        userId: context.userId || 'N/A',
        userEmail: context.userEmail || 'N/A',
        step: context.step || step,
        ...context
      });
    }
  }

  /**
   * Log user actions with context
   */
  static logUserAction(action: string, details: any, context?: LogContext) {
    const timestamp = new Date().toISOString();
    
    console.log(`👤👤👤 [FRONTEND-USER] USER ACTION: ${action.toUpperCase()}`);
    console.log(`👤 [FRONTEND-USER] Timestamp: ${timestamp}`);
    console.log(`👤 [FRONTEND-USER] Action details:`, details);
    
    if (context) {
      console.log(`👤 [FRONTEND-USER] Context:`, context);
    }
  }

  /**
   * Log form interactions
   */
  static logFormAction(formName: string, action: 'submit' | 'validation' | 'error', data: any) {
    console.log(`📝📝📝 [FRONTEND-FORM] FORM ${action.toUpperCase()}: ${formName}`);
    console.log(`📝 [FRONTEND-FORM] Timestamp: ${new Date().toISOString()}`);
    console.log(`📝 [FRONTEND-FORM] Form data:`, {
      formName,
      action,
      data: this.sanitizeFormData(data),
      validation: action === 'validation' ? data : 'N/A'
    });
  }

  /**
   * Log API calls with comprehensive tracking
   */
  static async loggedApiCall(url: string, options: ApiCallOptions = {}, context?: LogContext): Promise<Response> {
    const startTime = Date.now();
    const requestId = `api_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`🌐🌐🌐 [FRONTEND-API] STARTING API CALL`);
    console.log(`🌐 [FRONTEND-API] URL: ${url}`);
    console.log(`🌐 [FRONTEND-API] Method: ${options.method || 'GET'}`);
    console.log(`🌐 [FRONTEND-API] Request ID: ${requestId}`);
    console.log(`🌐 [FRONTEND-API] Timestamp: ${new Date().toISOString()}`);
    
    if (options.body) {
      console.log(`🌐 [FRONTEND-API] Request body:`, this.sanitizeApiData(options.body));
    }
    
    if (context) {
      console.log(`🌐 [FRONTEND-API] Context:`, context);
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json();

      if (response.ok) {
        console.log(`✅✅✅ [FRONTEND-API] API CALL SUCCESSFUL`);
        console.log(`✅ [FRONTEND-API] Status: ${response.status} ${response.statusText}`);
        console.log(`✅ [FRONTEND-API] Duration: ${duration}ms`);
        console.log(`✅ [FRONTEND-API] Request ID: ${requestId}`);
        console.log(`✅ [FRONTEND-API] Response:`, responseData);
      } else {
        console.error(`❌❌❌ [FRONTEND-API] API CALL FAILED`);
        console.error(`❌ [FRONTEND-API] Status: ${response.status} ${response.statusText}`);
        console.error(`❌ [FRONTEND-API] Duration: ${duration}ms`);
        console.error(`❌ [FRONTEND-API] Request ID: ${requestId}`);
        console.error(`❌ [FRONTEND-API] Error response:`, responseData);
      }

      // Return response with data already parsed
      return {
        ...response,
        json: async () => responseData,
        _parsedData: responseData,
        _duration: duration,
        _requestId: requestId
      } as any;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`💥💥💥 [FRONTEND-API] API CALL EXCEPTION`);
      console.error(`💥 [FRONTEND-API] Duration: ${duration}ms`);
      console.error(`💥 [FRONTEND-API] Request ID: ${requestId}`);
      console.error(`💥 [FRONTEND-API] Error:`, error);
      
      throw error;
    }
  }

  /**
   * Log navigation actions
   */
  static logNavigation(from: string, to: string, reason: string, context?: LogContext) {
    console.log(`🧭🧭🧭 [FRONTEND-NAV] NAVIGATION: ${reason.toUpperCase()}`);
    console.log(`🧭 [FRONTEND-NAV] From: ${from}`);
    console.log(`🧭 [FRONTEND-NAV] To: ${to}`);
    console.log(`🧭 [FRONTEND-NAV] Reason: ${reason}`);
    console.log(`🧭 [FRONTEND-NAV] Timestamp: ${new Date().toISOString()}`);
    
    if (context) {
      console.log(`🧭 [FRONTEND-NAV] Context:`, context);
    }
  }

  /**
   * Log authentication events
   */
  static logAuth(event: 'login' | 'logout' | 'session_check' | 'user_loaded', data: any) {
    console.log(`🔐🔐🔐 [FRONTEND-AUTH] AUTH EVENT: ${event.toUpperCase()}`);
    console.log(`🔐 [FRONTEND-AUTH] Timestamp: ${new Date().toISOString()}`);
    console.log(`🔐 [FRONTEND-AUTH] Event data:`, {
      event,
      userId: data.userId || 'N/A',
      userEmail: data.userEmail || 'N/A',
      isLoaded: data.isLoaded,
      isSignedIn: data.isSignedIn,
      sessionId: this.sessionId
    });
  }

  /**
   * Log success states
   */
  static logSuccess(operation: string, result: any, context?: LogContext) {
    console.log(`🎉🎉🎉 [FRONTEND-SUCCESS] SUCCESS: ${operation.toUpperCase()}`);
    console.log(`🎉 [FRONTEND-SUCCESS] Timestamp: ${new Date().toISOString()}`);
    console.log(`🎉 [FRONTEND-SUCCESS] Result:`, result);
    
    if (context) {
      console.log(`🎉 [FRONTEND-SUCCESS] Context:`, context);
    }
  }

  /**
   * Log error states
   */
  static logError(operation: string, error: any, context?: LogContext) {
    console.error(`💥💥💥 [FRONTEND-ERROR] ERROR IN: ${operation.toUpperCase()}`);
    console.error(`💥 [FRONTEND-ERROR] Timestamp: ${new Date().toISOString()}`);
    console.error(`💥 [FRONTEND-ERROR] Error:`, {
      message: error.message || error,
      stack: error.stack,
      name: error.name
    });
    
    if (context) {
      console.error(`💥 [FRONTEND-ERROR] Context:`, context);
    }
  }

  /**
   * Log email/notification events
   */
  static logEmailEvent(type: 'scheduled' | 'sent' | 'failed', emailType: string, details: any) {
    console.log(`📧📧📧 [FRONTEND-EMAIL] EMAIL ${type.toUpperCase()}: ${emailType}`);
    console.log(`📧 [FRONTEND-EMAIL] Timestamp: ${new Date().toISOString()}`);
    console.log(`📧 [FRONTEND-EMAIL] Details:`, details);
  }

  /**
   * Log timing information
   */
  static logTiming(operation: string, startTime: number, context?: LogContext) {
    const duration = Date.now() - startTime;
    console.log(`⏱️⏱️⏱️ [FRONTEND-TIMING] OPERATION COMPLETED: ${operation.toUpperCase()}`);
    console.log(`⏱️ [FRONTEND-TIMING] Duration: ${duration}ms`);
    console.log(`⏱️ [FRONTEND-TIMING] Operation: ${operation}`);
    
    if (context) {
      console.log(`⏱️ [FRONTEND-TIMING] Context:`, context);
    }
  }

  /**
   * Sanitize form data to avoid logging sensitive information
   */
  private static sanitizeFormData(data: any): any {
    if (typeof data !== 'object' || !data) return data;
    
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Sanitize API data
   */
  private static sanitizeApiData(data: any): any {
    return this.sanitizeFormData(data);
  }

  /**
   * Get session info for debugging
   */
  static getSessionInfo() {
    return {
      sessionId: this.sessionId,
      sessionStartTime: this.startTime,
      sessionDuration: Date.now() - this.startTime,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
  }
}

// Export convenience methods
export const logStepHeader = FrontendLogger.logStepHeader.bind(FrontendLogger);
export const logUserAction = FrontendLogger.logUserAction.bind(FrontendLogger);
export const logFormAction = FrontendLogger.logFormAction.bind(FrontendLogger);
export const loggedApiCall = FrontendLogger.loggedApiCall.bind(FrontendLogger);
export const logNavigation = FrontendLogger.logNavigation.bind(FrontendLogger);
export const logAuth = FrontendLogger.logAuth.bind(FrontendLogger);
export const logSuccess = FrontendLogger.logSuccess.bind(FrontendLogger);
export const logError = FrontendLogger.logError.bind(FrontendLogger);
export const logEmailEvent = FrontendLogger.logEmailEvent.bind(FrontendLogger);
export const logTiming = FrontendLogger.logTiming.bind(FrontendLogger);