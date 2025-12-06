'use client';

import { LogCategory, LogContext, LogLevel } from '../types';
import { emitClientLog, getClientLogGates, mergeContext, safeSerialize } from './helpers';

// Breadcrumb: createConsoleReplacement -> replaces ad-hoc console usage -> funnels through central logger.

function formatConsolePayload(message: any, args: any[]): string {
  if (typeof message === 'string') {
    if (args.length === 0) {
      return message;
    }
    const serializedArgs = args.map((arg) => safeSerialize(arg, 120) ?? String(arg));
    return `${message} ${serializedArgs.join(' ')}`.trim();
  }

  return safeSerialize(message, 200) ?? String(message);
}

export function createConsoleReplacement(componentName?: string, category?: LogCategory) {
  const { debug: canLogDebug, info: canLogInfo, warn: canLogWarn, error: canLogError } = getClientLogGates();
  const baseContext: LogContext = componentName ? { componentName } : {};
  const logCategory = category || LogCategory.UI;

  return {
    log: (message: any, ...args: any[]) => {
      if (!canLogDebug) {
        return;
      }

      emitClientLog(
        LogLevel.DEBUG,
        () => formatConsolePayload(message, args),
        () => mergeContext(baseContext, {}),
        logCategory
      );
    },
    info: (message: any, ...args: any[]) => {
      if (!canLogInfo) {
        return;
      }

      emitClientLog(
        LogLevel.INFO,
        () => formatConsolePayload(message, args),
        () => mergeContext(baseContext, {}),
        logCategory
      );
    },
    warn: (message: any, ...args: any[]) => {
      if (!canLogWarn) {
        return;
      }

      emitClientLog(
        LogLevel.WARN,
        () => formatConsolePayload(message, args),
        () => mergeContext(baseContext, {}),
        logCategory
      );
    },
    error: (message: any, ...args: any[]) => {
      if (!canLogError) {
        return;
      }

      const errorInstance = message instanceof Error ? message : undefined;
      emitClientLog(
        LogLevel.ERROR,
        () => formatConsolePayload(message, args),
        () => mergeContext(baseContext, {}),
        logCategory,
        errorInstance
      );
    }
  };
}
